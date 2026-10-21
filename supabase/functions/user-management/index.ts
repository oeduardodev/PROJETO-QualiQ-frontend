import { createClient } from 'npm:@supabase/supabase-js@2.117.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const appOrigins = (Deno.env.get('PUBLIC_APP_ORIGIN') ?? '')
  .split(',')
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);
const admin = createClient(supabaseUrl, serviceKey);
const roles = new Set(['admin', 'gestor', 'operador', 'analista', 'auditor', 'visualizador']);
const modules = new Set([
  'dashboard',
  'strategy',
  'indicators',
  'processes',
  'slas',
  'risks',
  'documents',
  'incidents',
  'helpdesk',
  'action_plans',
]);
const inactiveBan = '876000h';

function cors(origin: string | null) {
  const allowedOrigin = origin && appOrigins.includes(origin.replace(/\/$/, '')) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json' },
  });
}

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`Informe ${label} (até ${maxLength} caracteres).`);
  }
  return value.trim();
}

function optionalDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Informe uma data de nascimento válida.');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Informe uma data de nascimento válida.');
  }
  return value;
}

function stringArray(value: unknown, allowed?: Set<string>): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error('Seleção inválida.');
  }
  const result = [...new Set(value.map((item) => item.trim()).filter(Boolean))];
  if (allowed && result.some((item) => !allowed.has(item))) throw new Error('Seleção inválida.');
  return result;
}

async function main(request: Request) {
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405, origin);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer '))
    return json({ error: 'Sessão inválida.' }, 401, origin);
  const token = authorization.slice('Bearer '.length);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !userData.user) return json({ error: 'Sessão expirada.' }, 401, origin);

  const { data: actor } = await admin
    .from('profiles')
    .select('role,is_active')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (!actor?.is_active) return json({ error: 'Usuário inativo.' }, 403, origin);

  try {
    const body = await request.json();
    if (body.action === 'update_self') {
      const name = requiredText(body.name, 'o nome completo', 200);
      const short_name = requiredText(body.short_name, 'o nome abreviado', 80);
      const birth_date = optionalDate(body.birth_date);
      const { error } = await admin
        .from('profiles')
        .update({
          name,
          short_name,
          birth_date,
          receive_email_alerts: body.receive_email_alerts === true,
        })
        .eq('id', userData.user.id);
      if (error) throw error;
      return json({ ok: true }, 200, origin);
    }

    if (body.action === 'get_self') {
      const { data: profile, error } = await admin
        .from('profiles')
        .select('*')
        .eq('id', userData.user.id)
        .single();
      if (error) throw error;
      const { data: assignments, error: assignmentError } = await admin
        .from('profile_processes')
        .select('process_id')
        .eq('profile_id', userData.user.id);
      if (assignmentError) throw assignmentError;
      return json(
        { ...profile, process_ids: (assignments ?? []).map((item) => item.process_id) },
        200,
        origin,
      );
    }

    if (actor.role !== 'admin')
      return json({ error: 'Somente administradores podem gerir usuários.' }, 403, origin);
    if (body.action === 'list') {
      const [
        { data: profiles, error: profileError },
        { data: assignments, error: assignmentError },
      ] = await Promise.all([
        admin.from('profiles').select('*').order('name'),
        admin.from('profile_processes').select('profile_id,process_id'),
      ]);
      if (profileError) throw profileError;
      if (assignmentError) throw assignmentError;
      const assigned = new Map<string, string[]>();
      for (const item of assignments ?? []) {
        const ids = assigned.get(item.profile_id) ?? [];
        ids.push(item.process_id);
        assigned.set(item.profile_id, ids);
      }
      return json(
        {
          users: (profiles ?? []).map((profile) => ({
            ...profile,
            process_ids: assigned.get(profile.id) ?? [],
          })),
        },
        200,
        origin,
      );
    }
    if (body.action !== 'create' && body.action !== 'update') {
      return json({ error: 'Ação inválida.' }, 400, origin);
    }

    const name = requiredText(body.name, 'o nome completo', 200);
    const short_name = requiredText(body.short_name, 'o nome abreviado', 80);
    const registration_code = requiredText(body.registration_code, 'a matrícula ou documento', 80);
    const email = requiredText(body.email, 'um e-mail válido', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
    const role = requiredText(body.role, 'um perfil de acesso', 30).toLowerCase();
    if (!roles.has(role)) throw new Error('Perfil de acesso inválido.');
    let category_id: string | null = null;
    if (role === 'gestor') {
      category_id = requiredText(body.category_id, 'a área do gestor', 60);
      const { data: category, error } = await admin
        .from('value_chain_categories')
        .select('id')
        .eq('id', category_id)
        .maybeSingle();
      if (error) throw error;
      if (!category) throw new Error('A área selecionada não existe.');
    }
    const is_active = body.is_active !== false;
    const receive_email_alerts = body.receive_email_alerts !== false;
    const is_department_head = body.is_department_head === true;
    const birth_date = optionalDate(body.birth_date);
    const process_ids = stringArray(body.process_ids);
    let module_access = stringArray(body.module_access, modules);
    if (role === 'admin') module_access = [...modules];
    if (role === 'visualizador') module_access = ['dashboard'];
    if (!module_access.includes('dashboard')) module_access.unshift('dashboard');

    if (process_ids.length) {
      const { data: processes, error } = await admin
        .from('processes')
        .select('id')
        .in('id', process_ids);
      if (error) throw error;
      if ((processes ?? []).length !== process_ids.length)
        throw new Error('Um ou mais processos selecionados não existem.');
    }

    const { data: codeMatch, error: codeError } = await admin
      .from('profiles')
      .select('id')
      .ilike('registration_code', registration_code)
      .neq('id', body.id ?? '00000000-0000-0000-0000-000000000000')
      .maybeSingle();
    if (codeError) throw codeError;
    if (codeMatch) throw new Error('Esta matrícula ou documento já está em uso.');

    const profileValues = {
      email,
      name,
      short_name,
      registration_code,
      birth_date,
      role,
      category_id,
      is_active,
      receive_email_alerts,
      is_department_head,
      module_access,
    };

    if (body.action === 'create') {
      const redirectTo = appOrigins[0] ? `${appOrigins[0]}/definir-senha` : undefined;
      const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { name, short_name },
        ...(redirectTo ? { redirectTo } : {}),
      });
      if (error || !invited.user) throw error ?? new Error('Não foi possível criar a conta.');

      try {
        const { error: profileError } = await admin.from('profiles').insert({
          id: invited.user.id,
          ...profileValues,
          category_id: null,
        });
        if (profileError) throw profileError;
        if (process_ids.length) {
          const { error: processError } = await admin
            .from('profile_processes')
            .insert(process_ids.map((process_id) => ({ profile_id: invited.user.id, process_id })));
          if (processError) throw processError;
        }
        if (!is_active) {
          const { error: banError } = await admin.auth.admin.updateUserById(invited.user.id, {
            ban_duration: inactiveBan,
          });
          if (banError) throw banError;
        }
      } catch (error) {
        await admin.auth.admin.deleteUser(invited.user.id);
        throw error;
      }
      return json({ ok: true, id: invited.user.id }, 200, origin);
    }

    if (typeof body.id !== 'string') throw new Error('Usuário inválido.');
    const { data: current, error: currentError } = await admin
      .from('profiles')
      .select('email')
      .eq('id', body.id)
      .single();
    if (currentError) throw currentError;

    const emailChanged = (current.email ?? '').toLowerCase() !== email;
    if (emailChanged) {
      const { error } = await admin.auth.admin.updateUserById(body.id, {
        email,
        email_confirm: false,
        ban_duration: is_active ? 'none' : inactiveBan,
      });
      if (error) throw error;
    } else {
      const { error } = await admin.auth.admin.updateUserById(body.id, {
        ban_duration: is_active ? 'none' : inactiveBan,
      });
      if (error) throw error;
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update(profileValues)
      .eq('id', body.id);
    if (profileError) throw profileError;
    const { error: clearError } = await admin
      .from('profile_processes')
      .delete()
      .eq('profile_id', body.id);
    if (clearError) throw clearError;
    if (process_ids.length) {
      const { error } = await admin
        .from('profile_processes')
        .insert(process_ids.map((process_id) => ({ profile_id: body.id, process_id })));
      if (error) throw error;
    }
    return json({ ok: true, id: body.id }, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível salvar o usuário.';
    return json({ error: message }, 400, origin);
  }
}

Deno.serve(main);
