-- PESTEL
CREATE TABLE IF NOT EXISTS public.pestel_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  period text,
  description text,
  status text NOT NULL DEFAULT 'em_construcao' CHECK (status IN ('em_construcao','em_revisao','concluida')),
  valid_until timestamptz,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.pestel_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_pestel_analyses_all_roles" ON public.pestel_analyses;
CREATE POLICY "select_pestel_analyses_all_roles" ON public.pestel_analyses FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "insert_pestel_analyses_admin_gestor" ON public.pestel_analyses;
CREATE POLICY "insert_pestel_analyses_admin_gestor" ON public.pestel_analyses FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "update_pestel_analyses_admin_gestor" ON public.pestel_analyses;
CREATE POLICY "update_pestel_analyses_admin_gestor" ON public.pestel_analyses FOR UPDATE TO authenticated USING (public.is_admin_or_gestor()) WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "delete_pestel_analyses_admin_gestor" ON public.pestel_analyses;
CREATE POLICY "delete_pestel_analyses_admin_gestor" ON public.pestel_analyses FOR DELETE TO authenticated USING (public.is_admin_or_gestor());
CREATE INDEX IF NOT EXISTS idx_pestel_analyses_order ON public.pestel_analyses(order_index, id);
DROP TRIGGER IF EXISTS trg_pestel_analyses_updated ON public.pestel_analyses;
CREATE TRIGGER trg_pestel_analyses_updated BEFORE UPDATE ON public.pestel_analyses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TABLE IF NOT EXISTS public.pestel_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.pestel_analyses(id) ON DELETE CASCADE,
  dimension text NOT NULL CHECK (dimension IN ('politico','economico','social','tecnologico','ambiental','legal')),
  title text NOT NULL,
  description text,
  impact int CHECK (impact IS NULL OR (impact>=1 AND impact<=5)),
  probability int CHECK (probability IS NULL OR (probability>=1 AND probability<=5)),
  relevance int CHECK (relevance IS NULL OR (relevance>=1 AND relevance<=5)),
  observation text,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.pestel_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_pestel_items_all_roles" ON public.pestel_items;
CREATE POLICY "select_pestel_items_all_roles" ON public.pestel_items FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "insert_pestel_items_admin_gestor" ON public.pestel_items;
CREATE POLICY "insert_pestel_items_admin_gestor" ON public.pestel_items FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "update_pestel_items_admin_gestor" ON public.pestel_items;
CREATE POLICY "update_pestel_items_admin_gestor" ON public.pestel_items FOR UPDATE TO authenticated USING (public.is_admin_or_gestor()) WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "delete_pestel_items_admin_gestor" ON public.pestel_items;
CREATE POLICY "delete_pestel_items_admin_gestor" ON public.pestel_items FOR DELETE TO authenticated USING (public.is_admin_or_gestor());
CREATE INDEX IF NOT EXISTS idx_pestel_items_analysis ON public.pestel_items(analysis_id);
CREATE INDEX IF NOT EXISTS idx_pestel_items_dimension ON public.pestel_items(analysis_id, dimension);
DROP TRIGGER IF EXISTS trg_pestel_items_updated ON public.pestel_items;
CREATE TRIGGER trg_pestel_items_updated BEFORE UPDATE ON public.pestel_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON public.pestel_analyses TO authenticated, service_role;
GRANT ALL ON public.pestel_items TO authenticated, service_role;
