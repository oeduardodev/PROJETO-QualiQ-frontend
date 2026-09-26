-- RLS protects rows, not columns. Keep self-service profile edits limited to names;
-- role and category changes must be made through a privileged administrative path.
REVOKE UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (name) ON TABLE public.profiles TO authenticated;

-- These tables were introduced after the role-based RLS migration with open
-- anon policies. Remove those policies and require a signed-in, profiled user.
DO $$
DECLARE
  table_name text;
  policy_name text;
  write_condition text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'sipoc_node_associations',
    'sipoc_step_associations',
    'dimensions',
    'dimension_links',
    'helpdesk_tickets',
    'risks',
    'risk_factors',
    'risk_preventive_actions',
    'risk_contingency_plans',
    'slas',
    'notification_types',
    'notification_classifications'
  ] LOOP
    FOR policy_name IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND left(policyname, 5) = 'anon_'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_name, table_name);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon', table_name);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
      table_name
    );
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);

    write_condition := CASE
      WHEN table_name = 'helpdesk_tickets' THEN 'public.get_user_role() IS NOT NULL'
      ELSE 'public.get_user_role() IN (''Admin'', ''Gestor'')'
    END;

    EXECUTE format(
      'CREATE POLICY app_select ON public.%I FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL)',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY app_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
      table_name, write_condition
    );
    EXECUTE format(
      'CREATE POLICY app_update ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
      table_name, write_condition, write_condition
    );
    EXECUTE format(
      'CREATE POLICY app_delete ON public.%I FOR DELETE TO authenticated USING (%s)',
      table_name, write_condition
    );
  END LOOP;
END $$;
