-- Shared home panel content, scoped to the signed-in establishment.
UPDATE public.profiles SET module_access = array_append(module_access, 'dashboard')
WHERE role <> 'implantacao' AND NOT ('dashboard' = ANY(module_access));
UPDATE public.custom_roles SET module_access = array_append(module_access, 'dashboard')
WHERE NOT ('dashboard' = ANY(module_access));
UPDATE public.module_catalog SET name = 'Painel' WHERE id = 'dashboard';

CREATE OR REPLACE FUNCTION public.user_has_module_access(p_module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
    AND p.is_active AND p.role <> 'implantacao'
    AND (p_module IN ('dashboard', 'education') OR p_module = ANY(p.module_access))
    AND public.establishment_has_module(p_module));
$$;

CREATE TABLE public.dashboard_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL DEFAULT public.current_establishment_id()
    REFERENCES public.establishments(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('news', 'announcement')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 160),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 5000),
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_posts_dates CHECK (expires_at IS NULL OR expires_at > published_at)
);
CREATE INDEX dashboard_posts_tenant_published_idx
  ON public.dashboard_posts(establishment_id, published_at DESC);
ALTER TABLE public.dashboard_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY dashboard_posts_read ON public.dashboard_posts FOR SELECT TO authenticated
  USING (establishment_id = public.current_establishment_id()
    AND public.user_has_module_access('dashboard'));
CREATE POLICY dashboard_posts_insert ON public.dashboard_posts FOR INSERT TO authenticated
  WITH CHECK (establishment_id = public.current_establishment_id()
    AND created_by = auth.uid() AND public.user_can_edit('dashboard'));
CREATE POLICY dashboard_posts_update ON public.dashboard_posts FOR UPDATE TO authenticated
  USING (establishment_id = public.current_establishment_id() AND public.user_can_edit('dashboard'))
  WITH CHECK (establishment_id = public.current_establishment_id()
    AND public.user_can_edit('dashboard'));
CREATE POLICY dashboard_posts_delete ON public.dashboard_posts FOR DELETE TO authenticated
  USING (establishment_id = public.current_establishment_id() AND public.user_can_edit('dashboard'));
CREATE TRIGGER dashboard_posts_tenant_guard BEFORE INSERT OR UPDATE ON public.dashboard_posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_row();
CREATE TRIGGER dashboard_posts_updated BEFORE UPDATE ON public.dashboard_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
REVOKE ALL ON public.dashboard_posts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_posts TO authenticated;

-- Birth dates are needed for the monthly celebration, within the existing tenant RLS.
GRANT SELECT (birth_date) ON public.profiles TO authenticated;

-- Dashboard readers may see the organizational identity and indicator results.
DROP POLICY IF EXISTS module_access_select ON public.strategic_identity;
CREATE POLICY module_access_select ON public.strategic_identity AS RESTRICTIVE
  FOR SELECT TO authenticated USING (
    public.user_has_module_access('strategy') OR public.user_has_module_access('dashboard'));
DROP POLICY IF EXISTS module_access_select ON public.indicator_history;
CREATE POLICY module_access_select ON public.indicator_history AS RESTRICTIVE
  FOR SELECT TO authenticated USING (
    public.user_has_module_access('indicators') OR public.user_has_module_access('dashboard'));
CREATE POLICY dashboard_indicator_history_read ON public.indicator_history FOR SELECT TO authenticated
  USING (public.user_has_module_access('dashboard'));

-- A small calendar projection avoids exposing full action-plan records.
CREATE OR REPLACE FUNCTION public.dashboard_action_schedule()
RETURNS TABLE(id uuid, code text, title text, due_date text, tasks jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, p.code, p.title, p."when", p.tasks
  FROM public.action_plans p
  LEFT JOIN public.action_plan_statuses s ON s.key = p.status
    AND s.establishment_id = p.establishment_id
  WHERE public.user_has_module_access('dashboard')
    AND p.establishment_id = public.current_establishment_id()
    AND p.active AND coalesce(s.is_terminal, false) = false;
$$;
REVOKE ALL ON FUNCTION public.dashboard_action_schedule() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_action_schedule() TO authenticated;

ALTER TABLE public.strategic_identity ADD COLUMN IF NOT EXISTS logo_url text;

CREATE OR REPLACE FUNCTION public.require_identity_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (
    public.user_can_edit('dashboard') OR public.user_can_edit('dimensoes')) THEN
    RAISE EXCEPTION 'Sem permissão para editar a identidade' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.require_identity_edit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS page_edit_guard ON public.strategic_identity;
CREATE TRIGGER page_edit_guard BEFORE INSERT OR UPDATE OR DELETE ON public.strategic_identity
  FOR EACH ROW EXECUTE FUNCTION public.require_identity_edit();

-- Identity is saved through one guarded operation so dashboard editors do not
-- gain access to other strategy writes.
CREATE OR REPLACE FUNCTION public.save_dashboard_identity(
  p_mission text, p_vision text, p_values text, p_logo_url text
) RETURNS public.strategic_identity
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE tenant uuid := public.current_establishment_id(); result public.strategic_identity;
BEGIN
  IF tenant IS NULL OR NOT public.user_can_edit('dashboard') THEN
    RAISE EXCEPTION 'Sem permissão para editar o painel' USING ERRCODE = '42501';
  END IF;
  IF length(coalesce(p_mission,'')) > 2000 OR length(coalesce(p_vision,'')) > 2000
     OR length(coalesce(p_values,'')) > 2000 OR length(coalesce(p_logo_url,'')) > 1000
     OR (nullif(btrim(coalesce(p_logo_url,'')), '') IS NOT NULL
       AND p_logo_url !~* '^https://[^[:space:]]+$') THEN
    RAISE EXCEPTION 'Dados da identidade inválidos';
  END IF;
  SELECT * INTO result FROM public.strategic_identity
    WHERE establishment_id = tenant ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1
    FOR UPDATE;
  IF result.id IS NULL THEN
    INSERT INTO public.strategic_identity(establishment_id, mission, vision, values, logo_url)
    VALUES (tenant, nullif(btrim(p_mission),''), nullif(btrim(p_vision),''),
      nullif(btrim(p_values),''), nullif(btrim(p_logo_url),'')) RETURNING * INTO result;
  ELSE
    UPDATE public.strategic_identity SET mission = nullif(btrim(p_mission),''),
      vision = nullif(btrim(p_vision),''), values = nullif(btrim(p_values),''),
      logo_url = nullif(btrim(p_logo_url),'') WHERE id = result.id RETURNING * INTO result;
  END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_dashboard_identity(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_dashboard_identity(text,text,text,text) TO authenticated;
