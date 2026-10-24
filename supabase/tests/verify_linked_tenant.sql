-- Read-only smoke check for the linked project after deployment.
BEGIN;
DO $$ BEGIN
  PERFORM set_config('request.jwt.claim.sub',(
    SELECT id::text FROM public.profiles
    WHERE role='admin' AND establishment_id='00000000-0000-4000-8000-000000000001'
      AND is_active ORDER BY created_at LIMIT 1),true);
END $$;
SET LOCAL ROLE authenticated;
SELECT
  public.current_establishment_id() = '00000000-0000-4000-8000-000000000001'::uuid AS tenant_resolved,
  public.establishment_has_module('dashboard') AS base_module_enabled,
  public.establishment_has_module('helpdesk') AS homol_addon_enabled,
  (SELECT count(*) FROM public.establishments) AS visible_establishments,
  (SELECT count(*) FROM public.profiles) AS visible_profiles,
  (SELECT count(*) FROM public.processes) AS visible_processes;
ROLLBACK;
