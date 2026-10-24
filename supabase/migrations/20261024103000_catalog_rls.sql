-- Shared catalogs are readable after authentication, but never writable from
-- the client. Keep RLS explicit on every exposed public table.
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_read ON public.plans FOR SELECT TO authenticated USING (true);
ALTER TABLE public.module_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY module_catalog_read ON public.module_catalog FOR SELECT TO authenticated USING (true);

-- This pre-existing internal counter already had policies but RLS was off.
-- It has no client grants; code assignment functions retain owner access.
ALTER TABLE public.module_code_counters ENABLE ROW LEVEL SECURITY;
