-- Análise de Ambientes e Identidade Organizacional
CREATE TABLE IF NOT EXISTS public.environmental_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  period text,
  description text,
  valid_until timestamptz,
  apply_swot boolean DEFAULT false,
  apply_pestel boolean DEFAULT false,
  apply_porter boolean DEFAULT false,
  status text NOT NULL DEFAULT 'em_construcao' CHECK (status IN ('em_construcao','em_revisao','concluida')),
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.environmental_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_env_analyses_all_roles" ON public.environmental_analyses;
CREATE POLICY "select_env_analyses_all_roles" ON public.environmental_analyses FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "insert_env_analyses_admin_gestor" ON public.environmental_analyses;
CREATE POLICY "insert_env_analyses_admin_gestor" ON public.environmental_analyses FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "update_env_analyses_admin_gestor" ON public.environmental_analyses;
CREATE POLICY "update_env_analyses_admin_gestor" ON public.environmental_analyses FOR UPDATE TO authenticated USING (public.is_admin_or_gestor()) WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "delete_env_analyses_admin_gestor" ON public.environmental_analyses;
CREATE POLICY "delete_env_analyses_admin_gestor" ON public.environmental_analyses FOR DELETE TO authenticated USING (public.is_admin_or_gestor());
CREATE INDEX IF NOT EXISTS idx_env_analyses_order ON public.environmental_analyses(order_index, id);
DROP TRIGGER IF EXISTS trg_env_analyses_updated ON public.environmental_analyses;
CREATE TRIGGER trg_env_analyses_updated BEFORE UPDATE ON public.environmental_analyses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TABLE IF NOT EXISTS public.environmental_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.environmental_analyses(id) ON DELETE CASCADE,
  tool_type text NOT NULL CHECK (tool_type IN ('swot','pestel','porter_five_forces')),
  linked_analysis_id uuid NOT NULL,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.environmental_tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_env_tools_all_roles" ON public.environmental_tools;
CREATE POLICY "select_env_tools_all_roles" ON public.environmental_tools FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "insert_env_tools_admin_gestor" ON public.environmental_tools;
CREATE POLICY "insert_env_tools_admin_gestor" ON public.environmental_tools FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "update_env_tools_admin_gestor" ON public.environmental_tools;
CREATE POLICY "update_env_tools_admin_gestor" ON public.environmental_tools FOR UPDATE TO authenticated USING (public.is_admin_or_gestor()) WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "delete_env_tools_admin_gestor" ON public.environmental_tools;
CREATE POLICY "delete_env_tools_admin_gestor" ON public.environmental_tools FOR DELETE TO authenticated USING (public.is_admin_or_gestor());
CREATE INDEX IF NOT EXISTS idx_env_tools_analysis ON public.environmental_tools(analysis_id);
DROP TRIGGER IF EXISTS trg_env_tools_updated ON public.environmental_tools;
CREATE TRIGGER trg_env_tools_updated BEFORE UPDATE ON public.environmental_tools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON public.environmental_analyses TO authenticated, service_role;
GRANT ALL ON public.environmental_tools TO authenticated, service_role;
CREATE TABLE IF NOT EXISTS public.strategic_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text,
  vision text,
  mission text,
  purpose text,
  values text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.strategic_identity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_strat_identity_all_roles" ON public.strategic_identity;
CREATE POLICY "select_strat_identity_all_roles" ON public.strategic_identity FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "insert_strat_identity_admin_gestor" ON public.strategic_identity;
CREATE POLICY "insert_strat_identity_admin_gestor" ON public.strategic_identity FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "update_strat_identity_admin_gestor" ON public.strategic_identity;
CREATE POLICY "update_strat_identity_admin_gestor" ON public.strategic_identity FOR UPDATE TO authenticated USING (public.is_admin_or_gestor()) WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "delete_strat_identity_admin_gestor" ON public.strategic_identity;
CREATE POLICY "delete_strat_identity_admin_gestor" ON public.strategic_identity FOR DELETE TO authenticated USING (public.is_admin_or_gestor());
DROP TRIGGER IF EXISTS trg_strat_identity_updated ON public.strategic_identity;
CREATE TRIGGER trg_strat_identity_updated BEFORE UPDATE ON public.strategic_identity FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT ALL ON public.strategic_identity TO authenticated, service_role;
