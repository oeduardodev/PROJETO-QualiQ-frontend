import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
import sanitizeHtml from 'npm:sanitize-html@2.13.1';

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

function base64url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function googleToken(): Promise<string> {
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const pem = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  if (!email || !pem) throw new Error('Integração Google Docs não configurada.');
  const keyBytes = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, '')), (c) =>
    c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const issued = Math.floor(Date.now() / 1000);
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims: Record<string, unknown> = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: issued,
    exp: issued + 3600,
  };
  const delegated = Deno.env.get('GOOGLE_IMPERSONATE_USER');
  if (delegated) claims['sub'] = delegated;
  const assertion = `${header}.${base64url(new TextEncoder().encode(JSON.stringify(claims)))}`;
  const signature = base64url(
    new Uint8Array(
      await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(assertion)),
    ),
  );
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${assertion}.${signature}`,
    }),
  });
  if (!response.ok) throw new Error('Não foi possível autenticar a conta de serviço no Google.');
  const body = await response.json();
  return body.access_token;
}

async function driveFile(id: string, token: string, mime?: string) {
  const url = mime
    ? `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(mime)}`
    : `https://www.googleapis.com/drive/v3/files/${id}?fields=id,mimeType,modifiedTime,name`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok)
    throw new Error(
      `Google Drive recusou o acesso ao documento (${response.status}). Compartilhe o arquivo com a conta de serviço.`,
    );
  return response;
}

function documentId(link: string): string {
  const match = link.match(/^https:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
  if (!match) throw new Error('Link do Google Docs inválido.');
  return match[1];
}

function cleanDocument(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'p',
      'br',
      'strong',
      'em',
      'b',
      'i',
      'u',
      'ul',
      'ol',
      'li',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'blockquote',
      'hr',
      'span',
      'div',
      'sup',
      'sub',
    ],
    allowedAttributes: { '*': ['colspan', 'rowspan'] },
    disallowedTagsMode: 'discard',
  });
}

async function syncDocument(id: string, expected: string, userId: string) {
  const { data: document, error } = await admin.from('documents').select('*').eq('id', id).single();
  if (error || !document || document.updated_at !== expected)
    throw new Error('Documento alterado. Recarregue a página.');
  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single();
  if (
    !profile ||
    (profile.role.toLowerCase() !== 'admin' && document.owner_id !== userId) ||
    !['rascunho', 'em_revisao'].includes(document.status)
  )
    throw new Error('Sincronização não autorizada.');
  const googleId = documentId(document.drive_link ?? '');
  const token = await googleToken();
  const before = await (await driveFile(googleId, token)).json();
  if (before.mimeType !== 'application/vnd.google-apps.document')
    throw new Error('O arquivo precisa ser um Google Docs nativo.');
  const [htmlResponse, pdfResponse] = await Promise.all([
    driveFile(googleId, token, 'text/html'),
    driveFile(googleId, token, 'application/pdf'),
  ]);
  const html = cleanDocument(await htmlResponse.text());
  const pdf = await pdfResponse.arrayBuffer();
  if (!html.trim() || pdf.byteLength < 100 || pdf.byteLength > 10485760)
    throw new Error('Exportação do documento vazia ou acima de 10 MB.');
  const after = await (await driveFile(googleId, token)).json();
  if (before.modifiedTime !== after.modifiedTime)
    throw new Error('O Google Docs foi alterado durante a sincronização. Tente novamente.');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pdf));
  const checksum = [...digest].map((n) => n.toString(16).padStart(2, '0')).join('');
  const path = `${id}/${document.version}/${checksum}.pdf`;
  const uploaded = await admin.storage
    .from('document-versions')
    .upload(path, pdf, { contentType: 'application/pdf', upsert: false });
  if (uploaded.error && !uploaded.error.message.includes('already exists')) throw uploaded.error;
  const { data: saved, error: syncError } = await admin.rpc('sync_operation_document', {
    p_id: id,
    p_expected_updated_at: expected,
    p_actor: userId,
    p_html: html,
    p_pdf_path: path,
  });
  if (syncError) throw syncError;
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
    if (body.action === 'sync')
      return json(
        { document: await syncDocument(body.document_id, body.expected_updated_at, user.id) },
        200,
        origin,
      );
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
