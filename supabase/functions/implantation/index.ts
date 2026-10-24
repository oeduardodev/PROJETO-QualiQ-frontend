import { createClient } from 'npm:@supabase/supabase-js@2.117.1';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const origins = new Set(
  [Deno.env.get('PUBLIC_APP_ORIGIN') ?? '', Deno.env.get('PUBLIC_APP_ADDITIONAL_ORIGINS') ?? '']
    .join(',')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean),
);
// The secondary local port is used when another QualiQ dev server owns 4200.
origins.add('http://localhost:4300');
const admin = createClient(url, serviceKey);
const baseModules = [
  'dashboard',
  'strategy',
  'indicators',
  'processes',
  'slas',
  'risks',
  'documents',
  'incidents',
  'action_plans',
  'users',
];
const adminPages = [
  'dashboard',
  'valor',
  'dimensoes',
  'indicadores/painel',
  'indicadores/alimentacao',
  'indicadores/cadastro',
  'processos/gerenciamento',
  'processos/sipoc',
  'processos/slas/painel',
  'processos/slas/gerenciamento',
  'riscos/painel',
  'riscos/gerenciamento',
  'documentos/painel',
  'documentos/hierarquia',
  'documentos/gerenciamento',
  'documentos/copias',
  'incidentes/realizacao',
  'incidentes/painel',
  'incidentes/parametrizacao',
  'planos-acao',
  'usuarios',
];

function response(body: unknown, status: number, origin: string | null): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin && origins.has(origin.replace(/\/$/, '')) ? origin : '',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    },
  });
}

function text(value: unknown, label: string, max: number, required = false): string | null {
  if (value === null || value === undefined || value === '') {
    if (required) throw new Error(`Informe ${label}.`);
    return null;
  }
  if (
    typeof value !== 'string' ||
    value.trim().length > max ||
    (required && value.trim().length < 2)
  )
    throw new Error(`${label} inválido.`);
  return value.trim();
}

function uuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
    throw new Error('Estabelecimento inválido.');
  return value;
}

async function audit(
  actor: string,
  establishment: string,
  action: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  const { error } = await admin
    .from('implantation_audit')
    .insert({
      actor_id: actor,
      establishment_id: establishment,
      action,
      before_data: before,
      after_data: after,
    });
  if (error) throw error;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return response({}, 204, origin);
  if (request.method !== 'POST') return response({ error: 'Método não permitido.' }, 405, origin);
  const bearer = request.headers.get('authorization');
  if (!bearer?.startsWith('Bearer '))
    return response({ error: 'Sessão obrigatória.' }, 401, origin);
  const client = createClient(url, anonKey, { global: { headers: { Authorization: bearer } } });
  const { data: auth, error: authError } = await client.auth.getUser(bearer.slice(7));
  if (authError || !auth.user) return response({ error: 'Sessão expirada.' }, 401, origin);
  const actorId = auth.user.id;
  const { data: actor } = await admin
    .from('profiles')
    .select('role,is_active,establishment_id')
    .eq('id', actorId)
    .maybeSingle();
  if (!actor?.is_active || actor.role !== 'implantacao' || actor.establishment_id !== null)
    return response({ error: 'Acesso negado.' }, 403, origin);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === 'list') {
      const [
        { data: establishments, error: e },
        { data: modules, error: m },
        { data: catalog, error: c },
        { data: plans, error: p },
      ] = await Promise.all([
        admin.from('establishments').select('*').order('name'),
        admin.from('establishment_modules').select('*'),
        admin.from('module_catalog').select('*').order('name'),
        admin.from('plans').select('*'),
      ]);
      if (e || m || c || p) throw e ?? m ?? c ?? p;
      return response({ establishments, modules, catalog, plans }, 200, origin);
    }
    if (body.action === 'users') {
      const establishmentId = uuid(body.establishment_id);
      const { data, error } = await admin
        .from('profiles')
        .select('id,name,email,role,is_active,created_at')
        .eq('establishment_id', establishmentId)
        .order('name');
      if (error) throw error;
      return response({ users: data ?? [] }, 200, origin);
    }
    if (body.action === 'save') {
      const name = text(body.name, 'o nome', 200, true);
      const planId = text(body.plan_id, 'o plano', 30, true);
      if (!['start', 'pro', 'corporate'].includes(planId ?? '')) throw new Error('Plano inválido.');
      const status = text(body.status, 'o status', 20, true);
      if (!['active', 'suspended', 'inactive'].includes(status ?? ''))
        throw new Error('Status inválido.');
      const aiMode = text(body.ai_mode, 'a modalidade de IA', 20, true);
      if (!['disabled', 'enabled'].includes(aiMode ?? ''))
        throw new Error('Modalidade de IA inválida.');
      const monthlyLimit = Number(body.ai_monthly_limit);
      if (!Number.isSafeInteger(monthlyLimit) || monthlyLimit < 0 || monthlyLimit > 1_000_000)
        throw new Error('Limite mensal inválido.');
      const values = {
        name,
        legal_name: text(body.legal_name, 'a razão social', 200),
        registration_number: text(body.registration_number, 'o documento', 80),
        contact_email: text(body.contact_email, 'o e-mail', 254),
        status,
        plan_id: planId,
        ai_mode: aiMode,
        ai_monthly_limit: monthlyLimit,
        updated_at: new Date().toISOString(),
      };
      if (body.id) {
        const id = uuid(body.id);
        const { data: before, error: beforeError } = await admin
          .from('establishments')
          .select('*')
          .eq('id', id)
          .single();
        if (beforeError) throw beforeError;
        const { data, error } = await admin
          .from('establishments')
          .update(values)
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw error;
        await audit(actorId, id, 'update_establishment', before, data);
        return response({ establishment: data }, 200, origin);
      }
      const { data, error } = await admin
        .from('establishments')
        .insert(values)
        .select('*')
        .single();
      if (error) throw error;
      await audit(actorId, data.id, 'create_establishment', null, data);
      return response({ establishment: data }, 200, origin);
    }
    if (body.action === 'module') {
      const establishmentId = uuid(body.establishment_id);
      const moduleId = text(body.module_id, 'o módulo', 80, true);
      const { data: catalog, error: catalogError } = await admin
        .from('module_catalog')
        .select('is_base')
        .eq('id', moduleId)
        .single();
      if (catalogError || catalog.is_base) throw new Error('Módulo adicional inválido.');
      const { data: before } = await admin
        .from('establishment_modules')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('module_id', moduleId)
        .maybeSingle();
      const { data, error } = await admin
        .from('establishment_modules')
        .upsert({
          establishment_id: establishmentId,
          module_id: moduleId,
          enabled: body.enabled === true,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) throw error;
      await audit(actorId, establishmentId, 'set_module', before, data);
      return response({ module: data }, 200, origin);
    }
    if (body.action === 'create_admin') {
      const establishmentId = uuid(body.establishment_id);
      const { data: establishment, error: establishmentError } = await admin
        .from('establishments')
        .select('id,status')
        .eq('id', establishmentId)
        .single();
      if (establishmentError || establishment.status !== 'active')
        throw new Error('Ative o estabelecimento antes de criar o administrador.');
      const { count, error: countError } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('establishment_id', establishmentId);
      if (countError) throw countError;
      if (count !== 0) throw new Error('O estabelecimento já possui usuários.');
      const name = text(body.name, 'o nome', 200, true)!;
      const email = text(body.email, 'o e-mail', 254, true)!.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido.');
      const shortName = name.split(' ')[0];
      const { data: enabled } = await admin
        .from('establishment_modules')
        .select('module_id')
        .eq('establishment_id', establishmentId)
        .eq('enabled', true);
      const addOns = (enabled ?? [])
        .map((item) => item.module_id)
        .filter((id) => id === 'helpdesk');
      const requestOrigin = origin?.replace(/\/$/, '') ?? '';
      const inviteOrigin = origins.has(requestOrigin) ? requestOrigin : [...origins][0];
      const redirectTo = inviteOrigin ? `${inviteOrigin}/definir-senha` : undefined;
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        email,
        { data: { name, short_name: shortName }, ...(redirectTo ? { redirectTo } : {}) },
      );
      if (inviteError || !invited.user) throw inviteError ?? new Error('Convite não enviado.');
      try {
        const { error } = await admin
          .from('profiles')
          .insert({
            id: invited.user.id,
            establishment_id: establishmentId,
            name,
            short_name: shortName,
            email,
            registration_code:
              text(body.registration_code, 'a matrícula', 80) ?? `admin-${invited.user.id}`,
            role: 'admin',
            is_active: true,
            module_access: [...baseModules, ...addOns],
            edit_access: [...adminPages, ...(addOns.includes('helpdesk') ? ['helpdesk'] : [])],
          });
        if (error) throw error;
        await audit(actorId, establishmentId, 'create_initial_admin', null, {
          user_id: invited.user.id,
          email,
        });
      } catch (error) {
        await admin.auth.admin.deleteUser(invited.user.id);
        throw error;
      }
      return response({ id: invited.user.id }, 200, origin);
    }
    return response({ error: 'Ação inválida.' }, 400, origin);
  } catch (error) {
    return response(
      { error: error instanceof Error ? error.message : 'Falha na operação.' },
      400,
      origin,
    );
  }
});
