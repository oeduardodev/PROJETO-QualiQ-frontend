-- Custom titles keep the existing database role for legacy workflows. A custom
-- title uses the admin workflow role; the per-page write guard below limits it.
CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 80),
  description text NOT NULL DEFAULT '',
  module_access text[] NOT NULL DEFAULT '{}',
  edit_access text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX custom_roles_name_unique ON public.custom_roles (lower(btrim(name)));
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY custom_roles_read ON public.custom_roles FOR SELECT TO authenticated
  USING (public.get_user_role() IS NOT NULL);
REVOKE ALL ON public.custom_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.custom_roles TO authenticated;

ALTER TABLE public.profiles
  ADD COLUMN custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE RESTRICT,
  ADD COLUMN edit_access text[] NOT NULL DEFAULT '{}',
  ADD COLUMN avatar_path text;

UPDATE public.profiles SET module_access = array_append(module_access, 'users')
WHERE role = 'admin' AND NOT ('users' = ANY(module_access));

-- Keep existing accounts' editing workflows available after deployment.
UPDATE public.profiles SET edit_access = CASE lower(role::text)
  WHEN 'admin' THEN ARRAY[
    'dashboard','valor','dimensoes','indicadores/painel','indicadores/alimentacao',
    'indicadores/cadastro','processos/gerenciamento','processos/sipoc',
    'processos/slas/painel','processos/slas/gerenciamento','riscos/painel',
    'riscos/gerenciamento','documentos/painel','documentos/hierarquia',
    'documentos/gerenciamento','documentos/copias','incidentes/realizacao',
    'incidentes/painel','incidentes/parametrizacao','helpdesk','planos-acao','usuarios'
  ]::text[]
  WHEN 'gestor' THEN ARRAY[
    'dashboard','valor','dimensoes','indicadores/painel','indicadores/alimentacao',
    'processos/sipoc','processos/slas/painel','processos/slas/gerenciamento',
    'riscos/painel','riscos/gerenciamento','documentos/hierarquia',
    'incidentes/realizacao','incidentes/painel','helpdesk','planos-acao'
  ]::text[]
  WHEN 'operador' THEN ARRAY['incidentes/realizacao','incidentes/painel','helpdesk']::text[]
  WHEN 'analista' THEN ARRAY['indicadores/alimentacao','incidentes/realizacao',
    'incidentes/painel','helpdesk','planos-acao']::text[]
  ELSE '{}'::text[]
END;

-- Read access follows the modules selected for each account.
CREATE OR REPLACE FUNCTION public.user_has_module_access(p_module text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_active
      AND p_module = ANY(p.module_access)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_edit(p_page text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_active AND p_page = ANY(p.edit_access)
  );
$$;
REVOKE ALL ON FUNCTION public.user_can_edit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_edit(text) TO authenticated;

-- These shared tables predate the module policy map. Dashboard and strategy
-- legitimately read process summaries without the Processes module.
CREATE POLICY assigned_process_read ON public.processes AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.user_has_module_access('processes') OR public.user_has_module_access('dashboard')
    OR public.user_has_module_access('strategy') OR public.user_has_module_access('users'));
CREATE POLICY assigned_sipoc_read ON public.sipoc_nodes AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.user_has_module_access('processes') OR public.user_has_module_access('strategy')
    OR public.user_has_module_access('indicators') OR public.user_has_module_access('users'));
CREATE POLICY assigned_category_read ON public.value_chain_categories AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.user_has_module_access('strategy') OR public.user_has_module_access('processes')
    OR public.user_has_module_access('users'));

-- Applies to direct table writes and SECURITY DEFINER workflows. The row's
-- owning area decides which page's edit switch is required.
CREATE OR REPLACE FUNCTION public.require_page_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (
    public.user_can_edit(TG_ARGV[0])
    OR (TG_TABLE_NAME = 'tickets' AND public.user_can_edit('incidentes/realizacao'))
    OR (TG_TABLE_NAME IN ('processes','process_history') AND public.user_can_edit('valor'))
    OR (TG_TABLE_NAME = 'indicators' AND public.user_can_edit('indicadores/alimentacao'))
  ) THEN
    RAISE EXCEPTION 'Edição não autorizada para este módulo' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.require_page_edit() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE item record;
DECLARE write_rule text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('value_chain_categories','valor'),('processes','processos/gerenciamento'),
    ('process_history','processos/gerenciamento'),('process_code_counters','processos/gerenciamento'),
    ('module_code_counters','processos/gerenciamento'),
    ('sipoc_nodes','processos/sipoc'),('sipoc_node_associations','processos/sipoc'),
    ('sipoc_step_associations','processos/sipoc'),('dimensions','dimensoes'),
    ('dimension_versions','dimensoes'),('dimension_links','dimensoes'),
    ('dimension_classifications','dimensoes'),('dimension_colors','dimensoes'),
    ('swot_analyses','dimensoes'),('swot_items','dimensoes'),
    ('pestel_analyses','dimensoes'),('pestel_items','dimensoes'),
    ('porter_analyses','dimensoes'),('porter_forces','dimensoes'),
    ('environmental_analyses','dimensoes'),('environmental_tools','dimensoes'),
    ('strategic_identity','dimensoes'),
    ('indicators','indicadores/cadastro'),('indicator_definition_history','indicadores/cadastro'),
    ('indicator_dependencies','indicadores/cadastro'),('indicator_statuses','indicadores/cadastro'),
    ('indicator_history','indicadores/alimentacao'),
    ('indicator_result_analyses','indicadores/alimentacao'),
    ('indicator_panel_observations','indicadores/painel'),
    ('slas','processos/slas/gerenciamento'),('sla_approvals','processos/slas/gerenciamento'),
    ('sla_history','processos/slas/gerenciamento'),('sla_statuses','processos/slas/gerenciamento'),
    ('risks','riscos/gerenciamento'),('risk_history','riscos/gerenciamento'),
    ('risk_factors','riscos/gerenciamento'),('risk_preventive_actions','riscos/gerenciamento'),
    ('risk_contingency_plans','riscos/gerenciamento'),('risk_statuses','riscos/gerenciamento'),
    ('risk_types','riscos/gerenciamento'),('risk_matrix_classifications','riscos/gerenciamento'),
    ('risk_preventive_action_statuses','riscos/gerenciamento'),
    ('risk_contingency_plan_statuses','riscos/gerenciamento'),
    ('documents','documentos/gerenciamento'),('document_versions','documentos/gerenciamento'),
    ('document_decisions','documentos/gerenciamento'),('document_workflows','documentos/gerenciamento'),
    ('document_types','documentos/hierarquia'),('document_levels','documentos/hierarquia'),
    ('document_type_history','documentos/hierarquia'),
    ('controlled_copies','documentos/copias'),
    ('tickets','incidentes/painel'),('ticket_history','incidentes/painel'),
    ('ticket_statuses','incidentes/parametrizacao'),
    ('notification_types','incidentes/parametrizacao'),
    ('notification_classifications','incidentes/parametrizacao'),
    ('notification_severities','incidentes/parametrizacao'),
    ('analysis_tools','incidentes/parametrizacao'),('form_field_types','incidentes/parametrizacao'),
    ('public_notification_links','incidentes/parametrizacao'),
    ('helpdesk_tickets','helpdesk'),('helpdesk_statuses','helpdesk'),
    ('helpdesk_categories','helpdesk'),('helpdesk_priorities','helpdesk'),
    ('action_plans','planos-acao'),('action_plan_history','planos-acao'),
    ('action_plan_comments','planos-acao'),('action_plan_evidence','planos-acao'),
    ('action_plan_statuses','planos-acao')
  ) AS entries(table_name, page_key) LOOP
    IF to_regclass(format('public.%I', item.table_name)) IS NULL THEN CONTINUE; END IF;
    write_rule := format('public.user_can_edit(%L)', item.page_key);
    IF item.table_name = 'tickets' THEN
      write_rule := write_rule || ' OR public.user_can_edit(''incidentes/realizacao'')';
    ELSIF item.table_name IN ('processes', 'process_history') THEN
      write_rule := write_rule || ' OR public.user_can_edit(''valor'')';
    ELSIF item.table_name = 'indicators' THEN
      write_rule := write_rule || ' OR public.user_can_edit(''indicadores/alimentacao'')';
    END IF;
    -- The older auditor guard was absolute. The page guard now decides writes.
    EXECUTE format('DROP TRIGGER IF EXISTS auditor_write_guard ON public.%I', item.table_name);
    EXECUTE format('CREATE TRIGGER page_edit_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.require_page_edit(%L)', item.table_name, item.page_key);
    EXECUTE format('CREATE POLICY assigned_page_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', item.table_name, write_rule);
    EXECUTE format('CREATE POLICY assigned_page_update ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', item.table_name, write_rule, write_rule);
    EXECUTE format('CREATE POLICY assigned_page_delete ON public.%I FOR DELETE TO authenticated USING (%s)', item.table_name, write_rule);
  END LOOP;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-avatars', 'profile-avatars', true, 2097152,
  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];
CREATE POLICY profile_avatars_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'profile-avatars');
CREATE POLICY profile_avatars_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY profile_avatars_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY profile_avatars_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS auditor_action_evidence_no_insert ON storage.objects;
CREATE POLICY assigned_action_evidence_insert ON storage.objects AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'action-evidence' OR public.user_can_edit('planos-acao'));
