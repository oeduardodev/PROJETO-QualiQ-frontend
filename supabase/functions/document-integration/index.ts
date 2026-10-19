import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
import { pdfDefinition } from '../_shared/document-format.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const appOrigin = Deno.env.get('PUBLIC_APP_ORIGIN') ?? '';
const admin = createClient(supabaseUrl, serviceKey);

function normalizedOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const allowedOrigins = new Set(
  appOrigin
    .split(',')
    .map((value) => normalizedOrigin(value.trim()))
    .filter((value): value is string => value !== null),
);

function cors(origin: string | null) {
  const normalizedRequestOrigin = origin ? normalizedOrigin(origin) : null;
  const allowedOrigin =
    normalizedRequestOrigin && allowedOrigins.has(normalizedRequestOrigin)
      ? normalizedRequestOrigin
      : '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(value: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json' },
  });
}

function base64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function submitNative(
  id: string,
  expected: string,
  reason: string,
  userId: string,
  authorization: string,
) {
  if (typeof reason !== 'string' || !reason.trim()) throw new Error('Informe a justificativa.');
  const { data: document, error } = await admin.from('documents').select('*').eq('id', id).single();
  if (error || !document || document.updated_at !== expected)
    throw new Error('Documento alterado. Recarregue a página.');
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single();
  if (
    !profile ||
    (profile.role.toLowerCase() !== 'admin' && document.owner_id !== userId) ||
    document.deleted_at ||
    !['rascunho', 'em_revisao'].includes(document.status)
  )
    throw new Error('Envio não autorizado.');
  if (document.content_origin !== 'native' || !document.content_json)
    throw new Error('Salve o conteúdo no editor nativo antes de enviar.');
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('npm:pdfmake@0.3.11/build/pdfmake.js'),
    import('npm:pdfmake@0.3.11/build/vfs_fonts.js'),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  const pdf = await pdfMake
    .createPdf(pdfDefinition(document.content_json, document.title) as unknown as Parameters<typeof pdfMake.createPdf>[0])
    .getBuffer();
  if (pdf.byteLength > 10485760) throw new Error('O PDF excede 10 MB. Reduza as imagens.');
  const path = `${userId}/${id}/${document.version}/${document.content_revision}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await admin.storage
    .from('document-versions')
    .upload(path, pdf, { contentType: 'application/pdf', upsert: false });
  if (uploadError) throw uploadError;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: saved, error: transitionError } = await userClient.rpc(
    'transition_operation_document',
    {
      p_id: id,
      p_expected_updated_at: expected,
      p_action: 'submit',
      p_reason: reason.trim(),
      p_pdf_path: path,
    },
  );
  if (transitionError) {
    await admin.storage.from('document-versions').remove([path]);
    throw transitionError;
  }
  return saved;
}

async function sendCopy(id: string, userId: string) {
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single();
  if (profile?.role?.toLowerCase() !== 'admin')
    throw new Error('Somente administradores podem enviar cópias.');
  const { data: copy, error } = await admin
    .from('controlled_copies')
    .select('*,documents(title,code)')
    .eq('id', id)
    .single();
  if (error || !copy || !['aprovada', 'entregue'].includes(copy.status) || copy.emailed_at)
    throw new Error('Cópia não aprovada ou já enviada.');
  const { data: recipient } = await admin.auth.admin.getUserById(copy.user_id);
  const address = recipient.user?.email;
  if (!address) throw new Error('Solicitante sem e-mail cadastrado.');
  const { data: version, error: versionError } = await admin
    .from('document_versions')
    .select('snapshot')
    .eq('document_id', copy.document_id)
    .eq('version', copy.document_version)
    .single();
  if (versionError || !version?.snapshot?.content_pdf_path)
    throw new Error('Versão PDF não disponível.');
  const download = await admin.storage
    .from('document-versions')
    .download(version.snapshot.content_pdf_path);
  if (download.error || !download.data) throw download.error ?? new Error('PDF indisponível.');
  const pdf = new Uint8Array(await download.data.arrayBuffer());
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const resendFrom = Deno.env.get('RESEND_FROM');
  if (!resendKey || !resendFrom) throw new Error('Envio de e-mail não configurado.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `orbis-copy-${copy.id}`,
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [address],
      subject: `Cópia controlada ${copy.documents.code ?? ''}`,
      text: `Documento: ${copy.documents.title}\nVersão: ${copy.document_version}\nUtilização até: ${copy.due_date}\nJustificativa: ${copy.justification}`,
      attachments: [
        { filename: `${copy.documents.code ?? copy.document_id}.pdf`, content: base64(pdf) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`O serviço de e-mail recusou o envio (${response.status}).`);
  const { error: markError } = await admin
    .from('controlled_copies')
    .update({ emailed_at: new Date().toISOString() })
    .eq('id', id)
    .is('emailed_at', null);
  if (markError) throw markError;
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== 'POST' || !request.headers.get('authorization')?.startsWith('Bearer '))
    return json({ error: 'Não autorizado.' }, 401, origin);
  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: request.headers.get('authorization')! } },
    });
    const {
      data: { user },
      error,
    } = await userClient.auth.getUser();
    if (error || !user) return json({ error: 'Sessão expirada.' }, 401, origin);
    const body = await request.json();
    if (body.action === 'submit') {
      return json(
        {
          document: await submitNative(
            body.document_id,
            body.expected_updated_at,
            body.reason,
            user.id,
            request.headers.get('authorization')!,
          ),
        },
        200,
        origin,
      );
    }
    if (body.action === 'email') {
      await sendCopy(body.copy_id, user.id);
      return json({ ok: true }, 200, origin);
    }
    return json({ error: 'Ação inválida.' }, 400, origin);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Erro na integração de documentos.' },
      400,
      origin,
    );
  }
});
