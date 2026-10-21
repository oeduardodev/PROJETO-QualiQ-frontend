-- Extend the existing profiles table for user administration.
-- `name` is already the canonical full name throughout the application.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS registration_code text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receive_email_alerts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_department_head boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS module_access text[] NOT NULL DEFAULT ARRAY['dashboard']::text[];

UPDATE public.profiles p
SET email = u.email,
    short_name = COALESCE(NULLIF(btrim(p.short_name), ''), split_part(btrim(p.name), ' ', 1))
FROM auth.users u
WHERE u.id = p.id
  AND (p.email IS NULL OR p.short_name IS NULL OR btrim(p.short_name) = '');

-- Existing users keep the modules they could already access. New accounts receive
-- an explicit selection from the user management form.
UPDATE public.profiles
SET module_access = ARRAY[
  'dashboard', 'strategy', 'indicators', 'processes', 'slas', 'risks',
  'documents', 'incidents', 'helpdesk', 'action_plans'
]
WHERE module_access = ARRAY['dashboard']::text[];

UPDATE public.profiles
SET module_access = ARRAY['dashboard']::text[]
WHERE lower(role::text) = 'visualizador';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_uidx
  ON public.profiles (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_registration_code_lower_uidx
  ON public.profiles (lower(btrim(registration_code))) WHERE registration_code IS NOT NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_registration_code_not_blank
  CHECK (registration_code IS NULL OR btrim(registration_code) <> '');

CREATE TABLE IF NOT EXISTS public.profile_processes (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, process_id)
);

ALTER TABLE public.profile_processes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_processes_read ON public.profile_processes;
CREATE POLICY profile_processes_read ON public.profile_processes
  FOR SELECT TO authenticated USING (
    profile_id = auth.uid() OR lower(public.get_user_role()::text) IN ('admin', 'gestor')
  );
REVOKE ALL ON public.profile_processes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_processes TO authenticated;

-- Profile writes go through the user-management Edge Function. The old self-update
-- policy allowed users to change their own role and access flags.
DROP POLICY IF EXISTS update_own_profile ON public.profiles;
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, name, short_name, role, category_id, created_at, is_active)
  ON public.profiles TO authenticated;
DROP POLICY IF EXISTS operation_profile_read ON public.profiles;
DROP POLICY IF EXISTS profiles_basic_read ON public.profiles;
CREATE POLICY profiles_basic_read ON public.profiles FOR SELECT TO authenticated
  USING (public.get_user_role() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.is_active;
$$;

CREATE OR REPLACE FUNCTION public.user_has_module_access(p_module text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_active
      AND (p.role = 'admin' OR p_module = ANY(p.module_access))
  );
$$;
REVOKE ALL ON FUNCTION public.user_has_module_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_module_access(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_has_process_access(p_process uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT lower(public.get_user_role()::text) IS DISTINCT FROM 'analista'
    OR EXISTS (
      SELECT 1 FROM public.profile_processes pp
      WHERE pp.profile_id = auth.uid() AND pp.process_id = p_process
    );
$$;
REVOKE ALL ON FUNCTION public.user_has_process_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_process_access(uuid) TO authenticated;

-- Analistas can use the existing operator workflow for their own operational records.
DROP POLICY IF EXISTS users_processes_read ON public.processes;
CREATE POLICY users_processes_read ON public.processes FOR SELECT TO authenticated
  USING (lower(public.get_user_role()::text) IN ('admin', 'gestor', 'operador', 'analista', 'auditor', 'visualizador'));
DROP POLICY IF EXISTS analyst_process_scope ON public.processes;
CREATE POLICY analyst_process_scope ON public.processes AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.user_has_process_access(id));

DROP POLICY IF EXISTS users_sipoc_read ON public.sipoc_nodes;
CREATE POLICY users_sipoc_read ON public.sipoc_nodes FOR SELECT TO authenticated
  USING (lower(public.get_user_role()::text) IN ('admin', 'gestor', 'operador', 'analista', 'auditor'));
DROP POLICY IF EXISTS analyst_sipoc_scope ON public.sipoc_nodes;
CREATE POLICY analyst_sipoc_scope ON public.sipoc_nodes AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    lower(public.get_user_role()::text) <> 'analista'
    OR public.user_has_process_access(process_id)
    OR EXISTS (
      SELECT 1 FROM public.sipoc_node_associations a
      JOIN public.profile_processes pp ON pp.process_id = a.process_id
      WHERE a.node_id = sipoc_nodes.id AND pp.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS analyst_indicator_process_scope ON public.indicators;
CREATE POLICY analyst_indicator_process_scope ON public.indicators AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.user_has_process_access(process_id));
DROP POLICY IF EXISTS analyst_indicator_history_scope ON public.indicator_history;
CREATE POLICY analyst_indicator_history_scope ON public.indicator_history AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    lower(public.get_user_role()::text) <> 'analista'
    OR EXISTS (
      SELECT 1 FROM public.indicators i
      JOIN public.profile_processes pp ON pp.process_id = i.process_id
      WHERE i.id = indicator_history.indicator_id AND pp.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS analyst_ticket_read ON public.tickets;
CREATE POLICY analyst_ticket_read ON public.tickets FOR SELECT TO authenticated
  USING (lower(public.get_user_role()::text) = 'analista' AND created_by = auth.uid());
DROP POLICY IF EXISTS analyst_ticket_insert ON public.tickets;
CREATE POLICY analyst_ticket_insert ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (
    lower(public.get_user_role()::text) = 'analista' AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profile_processes pp
      WHERE pp.profile_id = auth.uid() AND pp.process_id = tickets.process_id
    )
  );
DROP POLICY IF EXISTS analyst_ticket_update ON public.tickets;
CREATE POLICY analyst_ticket_update ON public.tickets FOR UPDATE TO authenticated
  USING (lower(public.get_user_role()::text) = 'analista' AND created_by = auth.uid())
  WITH CHECK (
    lower(public.get_user_role()::text) = 'analista' AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profile_processes pp
      WHERE pp.profile_id = auth.uid() AND pp.process_id = tickets.process_id
    )
  );
DROP POLICY IF EXISTS analyst_ticket_delete ON public.tickets;
CREATE POLICY analyst_ticket_delete ON public.tickets FOR DELETE TO authenticated
  USING (lower(public.get_user_role()::text) = 'analista' AND created_by = auth.uid());

-- Dashboard-only access for the visualizador role (shown as Assistente in the UI).
DROP POLICY IF EXISTS visualizador_dashboard_processes ON public.processes;
CREATE POLICY visualizador_dashboard_processes ON public.processes FOR SELECT TO authenticated
  USING (lower(public.get_user_role()::text) = 'visualizador');
DROP POLICY IF EXISTS visualizador_dashboard_tickets ON public.tickets;
CREATE POLICY visualizador_dashboard_tickets ON public.tickets FOR SELECT TO authenticated
  USING (lower(public.get_user_role()::text) = 'visualizador');
DROP POLICY IF EXISTS visualizador_dashboard_indicators ON public.indicators;
CREATE POLICY visualizador_dashboard_indicators ON public.indicators FOR SELECT TO authenticated
  USING (lower(public.get_user_role()::text) = 'visualizador');
DROP POLICY IF EXISTS visualizador_dashboard_ticket_statuses ON public.ticket_statuses;
CREATE POLICY visualizador_dashboard_ticket_statuses ON public.ticket_statuses FOR SELECT TO authenticated
  USING (lower(public.get_user_role()::text) = 'visualizador');
DROP POLICY IF EXISTS visualizador_dashboard_indicator_statuses ON public.indicator_statuses;
CREATE POLICY visualizador_dashboard_indicator_statuses ON public.indicator_statuses FOR SELECT TO authenticated
  USING (lower(public.get_user_role()::text) = 'visualizador');

-- Analysts can record results for indicators on the processes assigned to them.
CREATE OR REPLACE FUNCTION public.record_indicator_result(
  p_indicator_id uuid,
  p_period date,
  p_value numeric,
  p_late_justification text DEFAULT NULL,
  p_analysis text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_indicator public.indicators;
  v_latest public.indicator_history;
  v_history public.indicator_history;
  v_due date;
  v_previous_due date;
  v_baseline date;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_role text := lower(public.get_user_role()::text);
BEGIN
  IF auth.uid() IS NULL OR v_role NOT IN ('admin', 'gestor', 'analista') THEN
    RAISE EXCEPTION 'Not authorized to record an indicator result' USING ERRCODE = '42501';
  END IF;
  SELECT i.* INTO v_indicator FROM public.indicators i
    WHERE i.id = p_indicator_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Indicator not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_role = 'gestor' AND NOT EXISTS (
    SELECT 1 FROM public.processes p WHERE p.id = v_indicator.process_id
      AND p.category_id = public.get_user_category_id()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this indicator' USING ERRCODE = '42501';
  END IF;
  IF v_role = 'analista' AND NOT EXISTS (
    SELECT 1 FROM public.profile_processes pp
    WHERE pp.profile_id = auth.uid() AND pp.process_id = v_indicator.process_id
  ) THEN
    RAISE EXCEPTION 'Indicator process is not assigned to this analyst' USING ERRCODE = '42501';
  END IF;
  IF p_period IS NULL OR p_period > v_today OR p_value IS NULL OR
     p_value::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Invalid period or value' USING ERRCODE = '22023';
  END IF;
  v_due := CASE v_indicator.frequency::text
    WHEN 'diario' THEN p_period + 1
    WHEN 'semanal' THEN p_period + 7
    WHEN 'quinzenal' THEN p_period + 15
    WHEN 'mensal' THEN (p_period + interval '1 month')::date
    WHEN 'bimestral' THEN (p_period + interval '2 months')::date
    WHEN 'trimestral' THEN (p_period + interval '3 months')::date
    WHEN 'semestral' THEN (p_period + interval '6 months')::date
    WHEN 'anual' THEN (p_period + interval '1 year')::date
    ELSE NULL
  END;
  SELECT h.* INTO v_latest FROM public.indicator_history h
    WHERE h.indicator_id = p_indicator_id
    ORDER BY h.period_date DESC NULLS LAST, h.created_at DESC, h.id DESC LIMIT 1;
  v_baseline := coalesce(v_latest.period_date,
    (v_indicator.created_at AT TIME ZONE 'America/Sao_Paulo')::date, v_today);
  v_previous_due := CASE v_indicator.frequency::text
    WHEN 'diario' THEN v_baseline + 1
    WHEN 'semanal' THEN v_baseline + 7
    WHEN 'quinzenal' THEN v_baseline + 15
    WHEN 'mensal' THEN (v_baseline + interval '1 month')::date
    WHEN 'bimestral' THEN (v_baseline + interval '2 months')::date
    WHEN 'trimestral' THEN (v_baseline + interval '3 months')::date
    WHEN 'semestral' THEN (v_baseline + interval '6 months')::date
    WHEN 'anual' THEN (v_baseline + interval '1 year')::date
    ELSE NULL
  END;
  v_due := least(v_due, v_previous_due);
  IF v_due < v_today AND nullif(btrim(p_late_justification), '') IS NULL THEN
    RAISE EXCEPTION 'Justification is required for a late indicator result'
      USING ERRCODE = '22023';
  END IF;
  IF v_indicator.requires_critical_analysis AND nullif(btrim(p_analysis), '') IS NULL THEN
    RAISE EXCEPTION 'Critical analysis is required for this indicator'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.indicator_history
    (indicator_id, period, period_date, value, goal, created_by, late_justification)
  VALUES
    (p_indicator_id, to_char(p_period, 'YYYY-MM-DD'), p_period, p_value,
     v_indicator.goal_value, auth.uid(),
     CASE WHEN v_due < v_today THEN btrim(p_late_justification) ELSE NULL END)
  RETURNING * INTO v_history;

  SELECT h.* INTO v_latest FROM public.indicator_history h
    WHERE h.indicator_id = p_indicator_id
    ORDER BY h.period_date DESC NULLS LAST, h.created_at DESC, h.id DESC LIMIT 1;
  UPDATE public.indicators SET current_value = v_latest.value
    WHERE id = p_indicator_id RETURNING * INTO v_indicator;

  IF nullif(btrim(p_analysis), '') IS NOT NULL THEN
    INSERT INTO public.indicator_result_analyses
      (indicator_id, history_id, observed_value, observed_goal, observed_period,
       diagnostic, suggestions, created_by)
    VALUES
      (p_indicator_id, v_history.id, p_value, v_history.goal, v_history.period,
       btrim(p_analysis), '[]'::jsonb, auth.uid());
  END IF;
  RETURN jsonb_build_object('indicator', to_jsonb(v_indicator), 'history', to_jsonb(v_history));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_indicator_result(uuid, date, numeric, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_indicator_result(uuid, date, numeric, text, text)
  TO authenticated;

-- Auditors have global read access across RLS-protected public tables and no writes.
DO $$
DECLARE table_name text;
BEGIN
  FOR table_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS auditor_global_read ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY auditor_global_read ON public.%I FOR SELECT TO authenticated USING (lower(public.get_user_role()::text) = ''auditor'')',
      table_name
    );
  END LOOP;
END $$;

-- Enforce per-user module assignments in RLS as well as in the navigation and routes.
DO $$
DECLARE
  item record;
  allowed_read text;
  table_ref text;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('indicators', 'indicators', true),
      ('indicator_history', 'indicators', true),
      ('indicator_statuses', 'indicators', true),
      ('indicator_result_analyses', 'indicators', false),
      ('indicator_definition_history', 'indicators', false),
      ('indicator_dependencies', 'indicators', false),
      ('slas', 'slas', false),
      ('sla_approvals', 'slas', false),
      ('sla_history', 'slas', false),
      ('risks', 'risks', false),
      ('risk_history', 'risks', false),
      ('risk_statuses', 'risks', false),
      ('risk_types', 'risks', false),
      ('risk_factors', 'risks', false),
      ('risk_preventive_actions', 'risks', false),
      ('risk_preventive_action_statuses', 'risks', false),
      ('risk_contingency_plans', 'risks', false),
      ('risk_contingency_plan_statuses', 'risks', false),
      ('risk_matrix_classifications', 'risks', false),
      ('documents', 'documents', false),
      ('document_types', 'documents', false),
      ('document_levels', 'documents', false),
      ('document_workflows', 'documents', false),
      ('document_versions', 'documents', false),
      ('document_decisions', 'documents', false),
      ('controlled_copies', 'documents', false),
      ('tickets', 'incidents', true),
      ('ticket_history', 'incidents', false),
      ('ticket_statuses', 'incidents', true),
      ('notification_types', 'incidents', false),
      ('notification_classifications', 'incidents', false),
      ('notification_severities', 'incidents', false),
      ('public_notification_links', 'incidents', false),
      ('helpdesk_tickets', 'helpdesk', false),
      ('helpdesk_statuses', 'helpdesk', false),
      ('helpdesk_categories', 'helpdesk', false),
      ('helpdesk_priorities', 'helpdesk', false),
      ('action_plans', 'action_plans', false),
      ('action_plan_history', 'action_plans', false),
      ('action_plan_comments', 'action_plans', false),
      ('action_plan_evidence', 'action_plans', false),
      ('dimensions', 'strategy', false),
      ('dimension_versions', 'strategy', false),
      ('dimension_classifications', 'strategy', false),
      ('dimension_colors', 'strategy', false),
      ('dimension_links', 'strategy', false),
      ('swot_analyses', 'strategy', false),
      ('swot_items', 'strategy', false),
      ('pestel_analyses', 'strategy', false),
      ('pestel_items', 'strategy', false),
      ('porter_analyses', 'strategy', false),
      ('porter_forces', 'strategy', false),
      ('environmental_analyses', 'strategy', false),
      ('environmental_tools', 'strategy', false),
      ('strategic_identity', 'strategy', false)
    ) AS access_map(table_name, module_key, dashboard_read)
  LOOP
    table_ref := format('public.%I', item.table_name);
    IF to_regclass(table_ref) IS NULL THEN CONTINUE; END IF;
    allowed_read := format(
      'public.user_has_module_access(%L)%s',
      item.module_key,
      CASE WHEN item.dashboard_read THEN ' OR public.user_has_module_access(''dashboard'')' ELSE '' END
    );
    EXECUTE format('DROP POLICY IF EXISTS module_access_select ON %s', table_ref);
    EXECUTE format(
      'CREATE POLICY module_access_select ON %s AS RESTRICTIVE FOR SELECT TO authenticated USING (%s)',
      table_ref,
      allowed_read
    );
    EXECUTE format('DROP POLICY IF EXISTS module_access_insert ON %s', table_ref);
    EXECUTE format(
      'CREATE POLICY module_access_insert ON %s AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.user_has_module_access(%L))',
      table_ref,
      item.module_key
    );
    EXECUTE format('DROP POLICY IF EXISTS module_access_update ON %s', table_ref);
    EXECUTE format(
      'CREATE POLICY module_access_update ON %s AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.user_has_module_access(%L)) WITH CHECK (public.user_has_module_access(%L))',
      table_ref,
      item.module_key,
      item.module_key
    );
    EXECUTE format('DROP POLICY IF EXISTS module_access_delete ON %s', table_ref);
    EXECUTE format(
      'CREATE POLICY module_access_delete ON %s AS RESTRICTIVE FOR DELETE TO authenticated USING (public.user_has_module_access(%L))',
      table_ref,
      item.module_key
    );
  END LOOP;
END $$;

-- A read-only audit role must stay read-only even when a write is attempted through
-- a SECURITY DEFINER workflow function. The trigger checks the signed-in actor.
CREATE OR REPLACE FUNCTION public.prevent_auditor_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND lower(public.get_user_role()::text) = 'auditor' THEN
    RAISE EXCEPTION 'Auditor access is read-only' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_auditor_write() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE table_name text;
BEGIN
  FOR table_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS auditor_write_guard ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER auditor_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_auditor_write()',
      table_name
    );
  END LOOP;
END $$;

-- Auditors can inspect supporting action-plan files while other users retain the
-- existing participant-based storage access. Uploads remain unavailable to auditors.
DROP POLICY IF EXISTS auditor_action_evidence_read ON storage.objects;
CREATE POLICY auditor_action_evidence_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'action-evidence' AND lower(public.get_user_role()::text) = 'auditor');
DROP POLICY IF EXISTS auditor_action_evidence_no_insert ON storage.objects;
CREATE POLICY auditor_action_evidence_no_insert ON storage.objects AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'action-evidence' OR lower(public.get_user_role()::text) <> 'auditor');
