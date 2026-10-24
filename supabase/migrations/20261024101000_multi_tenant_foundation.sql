-- Shared catalog. A plan is a classification; the base modules are identical.
CREATE TABLE public.plans (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text NOT NULL
);
INSERT INTO public.plans VALUES
  ('start','QualiQ Start','Pequenas empresas'),
  ('pro','QualiQ Pro','Médias empresas'),
  ('corporate','QualiQ Corporate','Grandes empresas');
REVOKE ALL ON public.plans FROM PUBLIC, anon;
GRANT SELECT ON public.plans TO authenticated;

CREATE TABLE public.module_catalog (
  id text PRIMARY KEY,
  name text NOT NULL,
  is_base boolean NOT NULL,
  implemented boolean NOT NULL DEFAULT false
);
INSERT INTO public.module_catalog (id,name,is_base,implemented) VALUES
  ('dashboard','Dashboard',true,true),
  ('strategy','Matriz de Valor e Dimensões Estratégicas',true,true),
  ('indicators','Indicadores',true,true),
  ('processes','Processos e SIPOC',true,true),
  ('slas','Gestão e Painel de SLAs',true,true),
  ('risks','Gestão de Riscos',true,true),
  ('documents','Gestão de Documentos',true,true),
  ('incidents','Gestão de Notificações',true,true),
  ('action_plans','Planos de Ação (5W2H)',true,true),
  ('users','Usuários e Acessos',true,true),
  ('strategy_tools','Ferramentas Estratégicas',false,false),
  ('surveys','Pesquisa de Satisfação e NPS',false,false),
  ('education','Educação Continuada',false,false),
  ('helpdesk','Chamados (Helpdesk)',false,true),
  ('custom_dashboards','Personalização de Dashboards',false,false);
REVOKE ALL ON public.module_catalog FROM PUBLIC, anon;
GRANT SELECT ON public.module_catalog TO authenticated;

CREATE TABLE public.establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 200),
  legal_name text,
  registration_number text,
  contact_email text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','inactive')),
  plan_id text NOT NULL REFERENCES public.plans(id),
  ai_mode text NOT NULL DEFAULT 'disabled' CHECK (ai_mode IN ('disabled','enabled')),
  ai_monthly_limit integer NOT NULL DEFAULT 0 CHECK (ai_monthly_limit >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX establishments_registration_number_key ON public.establishments (lower(btrim(registration_number))) WHERE registration_number IS NOT NULL;
INSERT INTO public.establishments (id,name,plan_id,ai_mode,ai_monthly_limit)
VALUES ('00000000-0000-4000-8000-000000000001','Ambiente de Homologação','corporate','enabled',100000);

CREATE TABLE public.establishment_modules (
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  module_id text NOT NULL REFERENCES public.module_catalog(id),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (establishment_id,module_id)
);
INSERT INTO public.establishment_modules (establishment_id,module_id,enabled)
SELECT '00000000-0000-4000-8000-000000000001', id, true
FROM public.module_catalog WHERE NOT is_base AND implemented;

CREATE TABLE public.implantation_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id),
  establishment_id uuid REFERENCES public.establishments(id),
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.establishments, public.establishment_modules, public.implantation_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.establishments, public.establishment_modules TO authenticated;

ALTER TABLE public.profiles ADD COLUMN establishment_id uuid REFERENCES public.establishments(id);
UPDATE public.profiles SET establishment_id = '00000000-0000-4000-8000-000000000001'
WHERE role <> 'implantacao';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_establishment_role_check
CHECK ((role = 'implantacao' AND establishment_id IS NULL AND custom_role_id IS NULL)
    OR (role <> 'implantacao' AND establishment_id IS NOT NULL));
CREATE INDEX profiles_establishment_id_idx ON public.profiles(establishment_id);

CREATE OR REPLACE FUNCTION public.current_establishment_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.establishment_id FROM public.profiles p
  JOIN public.establishments e ON e.id = p.establishment_id
  WHERE p.id = auth.uid() AND p.is_active AND p.role <> 'implantacao' AND e.status = 'active';
$$;
REVOKE ALL ON FUNCTION public.current_establishment_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_establishment_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_implantation_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
    AND p.role = 'implantacao' AND p.is_active AND p.establishment_id IS NULL);
$$;
REVOKE ALL ON FUNCTION public.is_implantation_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_implantation_user() TO authenticated;

ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;
CREATE POLICY establishments_read ON public.establishments FOR SELECT TO authenticated
  USING (public.is_implantation_user() OR id=public.current_establishment_id());
ALTER TABLE public.establishment_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY establishment_modules_read ON public.establishment_modules FOR SELECT TO authenticated
  USING (public.is_implantation_user() OR establishment_id=public.current_establishment_id());

CREATE OR REPLACE FUNCTION public.establishment_has_module(p_module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.module_catalog c
    WHERE c.id = p_module AND c.implemented AND public.current_establishment_id() IS NOT NULL
      AND (c.is_base OR EXISTS (SELECT 1 FROM public.establishment_modules m
        WHERE m.establishment_id = public.current_establishment_id()
          AND m.module_id = c.id AND m.enabled)));
$$;
REVOKE ALL ON FUNCTION public.establishment_has_module(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.establishment_has_module(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_has_module_access(p_module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
    AND p.is_active AND p.role <> 'implantacao' AND p_module = ANY(p.module_access)
    AND public.establishment_has_module(p_module));
$$;
CREATE OR REPLACE FUNCTION public.user_can_edit(p_page text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
    AND p.is_active AND p.role <> 'implantacao' AND p_page = ANY(p.edit_access)
    AND public.establishment_has_module(
      CASE WHEN p_page = 'helpdesk' THEN 'helpdesk'
      WHEN p_page IN ('valor','dimensoes') THEN 'strategy'
      WHEN p_page LIKE 'indicadores/%' THEN 'indicators'
      WHEN p_page LIKE 'processos/slas/%' THEN 'slas'
      WHEN p_page LIKE 'processos/%' THEN 'processes'
      WHEN p_page LIKE 'riscos/%' THEN 'risks'
      WHEN p_page LIKE 'documentos/%' THEN 'documents'
      WHEN p_page LIKE 'incidentes/%' THEN 'incidents'
      WHEN p_page = 'planos-acao' THEN 'action_plans'
      WHEN p_page = 'usuarios' THEN 'users' ELSE p_page END));
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT p.role FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active
    AND (p.role='implantacao' OR public.current_establishment_id() IS NOT NULL);
$$;

-- All operational tables, including tenant settings, histories and joins, receive
-- a persisted tenant key. Internal code counters remain shared infrastructure.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname NOT IN
    ('plans','module_catalog','establishments','establishment_modules','implantation_audit',
     'profiles','process_code_counters','module_code_counters','document_code_counters',
     'operation_code_counters')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=c.oid AND d.deptype='e')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN establishment_id uuid REFERENCES public.establishments(id)',t.name);
    -- Backfill is a metadata migration, not an operational edit. Existing
    -- workflow/audit triggers require a user justification and must not fire.
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER',t.name);
    EXECUTE format('UPDATE public.%I SET establishment_id = %L',t.name,'00000000-0000-4000-8000-000000000001');
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER',t.name);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN establishment_id SET NOT NULL',t.name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(establishment_id)', left(t.name,48)||'_establishment_idx',t.name);
  END LOOP;
END $$;

-- Strategic tools are an add-on even though their editor shares the existing
-- strategic-dimensions route.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['swot_analyses','swot_items','pestel_analyses','pestel_items',
    'porter_analyses','porter_forces','environmental_analyses','environmental_tools'] LOOP
    IF to_regclass(format('public.%I',t)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('CREATE POLICY strategic_tools_read ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.establishment_has_module(''strategy_tools''))',t);
    EXECUTE format('CREATE POLICY strategic_tools_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.establishment_has_module(''strategy_tools''))',t);
    EXECUTE format('CREATE POLICY strategic_tools_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.establishment_has_module(''strategy_tools'')) WITH CHECK (public.establishment_has_module(''strategy_tools''))',t);
    EXECUTE format('CREATE POLICY strategic_tools_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.establishment_has_module(''strategy_tools''))',t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_tenant_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE tenant uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  tenant := public.current_establishment_id();
  IF tenant IS NULL THEN RAISE EXCEPTION 'Estabelecimento indisponível' USING ERRCODE='42501'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.establishment_id IS DISTINCT FROM tenant THEN
    RAISE EXCEPTION 'Registro de outro estabelecimento' USING ERRCODE='42501';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.establishment_id IS NULL THEN NEW.establishment_id := tenant; END IF;
  IF NEW.establishment_id IS DISTINCT FROM tenant THEN
    RAISE EXCEPTION 'Estabelecimento inválido' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME IN ('swot_analyses','swot_items','pestel_analyses','pestel_items',
    'porter_analyses','porter_forces','environmental_analyses','environmental_tools')
    AND NOT public.establishment_has_module('strategy_tools') THEN
    RAISE EXCEPTION 'Módulo adicional desabilitado' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_tenant_row() FROM PUBLIC,anon,authenticated;

-- Restrictive policies compose with every older role/page policy, including
-- policies added for auditors. Triggers also cover SECURITY DEFINER writes.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='establishment_id' AND NOT a.attisdropped
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname NOT IN
      ('profiles','establishment_modules','implantation_audit')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.name);
    EXECUTE format('CREATE POLICY tenant_read ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (establishment_id = public.current_establishment_id())',t.name);
    EXECUTE format('CREATE POLICY tenant_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (establishment_id = public.current_establishment_id())',t.name);
    EXECUTE format('CREATE POLICY tenant_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (establishment_id = public.current_establishment_id()) WITH CHECK (establishment_id = public.current_establishment_id())',t.name);
    EXECUTE format('CREATE POLICY tenant_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (establishment_id = public.current_establishment_id())',t.name);
    EXECUTE format('CREATE TRIGGER tenant_row_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_row()',t.name);
  END LOOP;
END $$;

CREATE POLICY tenant_profiles_read ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
USING (id=auth.uid() OR (establishment_id IS NOT NULL AND establishment_id=public.current_establishment_id()));
CREATE OR REPLACE FUNCTION public.guard_profile_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND TG_OP='UPDATE' AND OLD.establishment_id IS DISTINCT FROM NEW.establishment_id THEN
    RAISE EXCEPTION 'Não é permitido transferir usuários entre estabelecimentos' USING ERRCODE='42501';
  END IF;
  IF auth.uid() IS NOT NULL AND TG_OP='UPDATE' AND OLD.role='implantacao' AND NEW.role<>'implantacao' THEN
    RAISE EXCEPTION 'Papel global protegido' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_profile_tenant() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_profile_tenant BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_tenant();

-- Composite foreign keys prevent references to records of another tenant.
-- Existing single-column FKs retain their original delete behavior.
DO $$ DECLARE t record; f record; BEGIN
  FOR t IN SELECT c.oid,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND EXISTS
      (SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='establishment_id')
      AND EXISTS (SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid=c.oid
        AND a.attnum=i.indkey[0] WHERE i.indrelid=c.oid AND i.indisunique
        AND i.indnkeyatts=1 AND a.attname='id')
  LOOP
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I(establishment_id,id)',left(t.name,43)||'_tenant_id_uidx',t.name);
  END LOOP;
  FOR f IN SELECT con.conname, child.relname AS child_name, parent.relname AS parent_name,
      child_col.attname AS child_column
    FROM pg_constraint con
    JOIN pg_class child ON child.oid=con.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid=child.relnamespace
    JOIN pg_class parent ON parent.oid=con.confrelid
    JOIN pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace
    JOIN pg_attribute child_col ON child_col.attrelid=child.oid AND child_col.attnum=con.conkey[1]
    JOIN pg_attribute parent_col ON parent_col.attrelid=parent.oid AND parent_col.attnum=con.confkey[1]
    WHERE con.contype='f' AND cardinality(con.conkey)=1 AND child_ns.nspname='public'
      AND parent_ns.nspname='public' AND parent_col.attname='id'
      AND child_col.attname<>'establishment_id'
      AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=child.oid AND a.attname='establishment_id')
      AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=parent.oid AND a.attname='establishment_id')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (establishment_id,%I) REFERENCES public.%I(establishment_id,id)',
      f.child_name,left(f.child_name||'_'||f.child_column||'_tenant_fk',63),f.child_column,f.parent_name);
  END LOOP;
END $$;

-- A global role is granted only by a privileged database operation. The
-- UUID arrays used by workflow APIs are not normal foreign keys. Validate
-- each element against its owning tenant as well.
CREATE OR REPLACE FUNCTION public.guard_tenant_uuid_array()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ids uuid[]; referenced uuid; referenced_tenant uuid;
BEGIN
  EXECUTE format('SELECT ($1).%I',TG_ARGV[0]) INTO ids USING NEW;
  FOREACH referenced IN ARRAY coalesce(ids,'{}'::uuid[]) LOOP
    EXECUTE format('SELECT establishment_id FROM public.%I WHERE id=$1',TG_ARGV[1])
      INTO referenced_tenant USING referenced;
    IF referenced_tenant IS DISTINCT FROM coalesce(NEW.establishment_id,public.current_establishment_id()) THEN
      RAISE EXCEPTION 'Referência entre estabelecimentos' USING ERRCODE='23503';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_tenant_uuid_array() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('processes','participant_ids','profiles'),
    ('action_plans','participant_ids','profiles'),
    ('documents','approver_ids','profiles'),
    ('sla_approvals','process_ids','processes'),
    ('indicator_result_analyses','action_plan_ids','action_plans')
  ) AS refs(table_name,column_name,parent_name) LOOP
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name=item.table_name AND column_name=item.column_name) THEN
      EXECUTE format('CREATE TRIGGER tenant_array_guard_%I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_tenant_uuid_array(%L,%L)',
        item.column_name,item.table_name,item.column_name,item.parent_name);
    END IF;
  END LOOP;
END $$;

-- A global role is granted only by a privileged database operation. The
-- user-management Edge Function never accepts it as an assignable role.
CREATE OR REPLACE FUNCTION public.assign_implantation_role(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE previous jsonb;
BEGIN
  IF current_user NOT IN ('postgres','service_role') THEN
    RAISE EXCEPTION 'Privileged database operation required' USING ERRCODE='42501';
  END IF;
  SELECT to_jsonb(p) INTO previous FROM public.profiles p WHERE p.id=p_user;
  UPDATE public.profiles SET role='implantacao', establishment_id=NULL,
    custom_role_id=NULL, module_access='{}', edit_access='{}'
  WHERE id=p_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  INSERT INTO public.implantation_audit(actor_id,action,before_data,after_data)
  VALUES (auth.uid(),'assign_implantation_role',previous,jsonb_build_object('user_id',p_user));
END $$;
REVOKE ALL ON FUNCTION public.assign_implantation_role(uuid) FROM PUBLIC,anon,authenticated;
