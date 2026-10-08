-- 5 Forças de Porter
CREATE TABLE IF NOT EXISTS public.porter_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  period text,
  description text,
  status text NOT NULL DEFAULT 'em_construcao' CHECK (status IN ('em_construcao','em_revisao','concluida')),
  valid_until timestamptz,
  sector text,
  scope text,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.porter_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_porter_analyses_all_roles" ON public.porter_analyses;
CREATE POLICY "select_porter_analyses_all_roles" ON public.porter_analyses FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "insert_porter_analyses_admin_gestor" ON public.porter_analyses;
CREATE POLICY "insert_porter_analyses_admin_gestor" ON public.porter_analyses FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "update_porter_analyses_admin_gestor" ON public.porter_analyses;
CREATE POLICY "update_porter_analyses_admin_gestor" ON public.porter_analyses FOR UPDATE TO authenticated USING (public.is_admin_or_gestor()) WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "delete_porter_analyses_admin_gestor" ON public.porter_analyses;
CREATE POLICY "delete_porter_analyses_admin_gestor" ON public.porter_analyses FOR DELETE TO authenticated USING (public.is_admin_or_gestor());
CREATE INDEX IF NOT EXISTS idx_porter_analyses_order ON public.porter_analyses(order_index, id);
DROP TRIGGER IF EXISTS trg_porter_analyses_updated ON public.porter_analyses;
CREATE TRIGGER trg_porter_analyses_updated BEFORE UPDATE ON public.porter_analyses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TABLE IF NOT EXISTS public.porter_forces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.porter_analyses(id) ON DELETE CASCADE,
  force text NOT NULL CHECK (force IN ('rivalidade','novos_entrantes','fornecedores','compradores','substitutos')),
  intensity text CHECK (intensity IN ('fraca','moderada','forte')),
  title text NOT NULL,
  description text,
  key_factors text,
  implications text,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.porter_forces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_porter_forces_all_roles" ON public.porter_forces;
CREATE POLICY "select_porter_forces_all_roles" ON public.porter_forces FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "insert_porter_forces_admin_gestor" ON public.porter_forces;
CREATE POLICY "insert_porter_forces_admin_gestor" ON public.porter_forces FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "update_porter_forces_admin_gestor" ON public.porter_forces;
CREATE POLICY "update_porter_forces_admin_gestor" ON public.porter_forces FOR UPDATE TO authenticated USING (public.is_admin_or_gestor()) WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "delete_porter_forces_admin_gestor" ON public.porter_forces;
CREATE POLICY "delete_porter_forces_admin_gestor" ON public.porter_forces FOR DELETE TO authenticated USING (public.is_admin_or_gestor());
CREATE INDEX IF NOT EXISTS idx_porter_forces_analysis ON public.porter_forces(analysis_id);
DROP TRIGGER IF EXISTS trg_porter_forces_updated ON public.porter_forces;
CREATE TRIGGER trg_porter_forces_updated BEFORE UPDATE ON public.porter_forces FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON public.porter_analyses TO authenticated, service_role;
GRANT ALL ON public.porter_forces TO authenticated, service_role;
