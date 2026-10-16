-- Preserve risks and their associations. Inactive risks remain available in management.
ALTER TABLE public.risks ADD COLUMN is_active boolean NOT NULL DEFAULT true;
CREATE INDEX risks_active_idx ON public.risks (is_active);

DROP POLICY IF EXISTS app_select ON public.risks;
CREATE POLICY app_select ON public.risks FOR SELECT TO authenticated
  USING (lower(public.get_user_role()::text) IN ('admin', 'gestor')
    OR (public.get_user_role() IS NOT NULL AND approval_state = 'approved' AND is_active));

DROP POLICY IF EXISTS app_delete ON public.risks;
REVOKE DELETE ON public.risks FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.prevent_risk_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Risks must be deactivated, not deleted' USING ERRCODE = '23503';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_risk_delete() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER prevent_risk_delete BEFORE DELETE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_risk_delete();

CREATE TABLE public.risk_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id uuid NOT NULL REFERENCES public.risks(id) ON DELETE RESTRICT,
  entity text NOT NULL CHECK (entity IN ('risk', 'factor', 'action', 'plan')),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN (
    'baseline', 'created', 'updated', 'deactivated', 'reactivated',
    'submitted', 'approved', 'rejected', 'added', 'removed'
  )),
  before_data jsonb,
  after_data jsonb,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX risk_history_risk_idx ON public.risk_history (risk_id, changed_at DESC, id DESC);
ALTER TABLE public.risk_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_history_read ON public.risk_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.risks r WHERE r.id = risk_id));
REVOKE ALL ON public.risk_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.risk_history TO authenticated;

CREATE FUNCTION public.audit_risk() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_action text;
  v_actor_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND
    to_jsonb(NEW) - 'updated_at' IS NOT DISTINCT FROM to_jsonb(OLD) - 'updated_at' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_actor_name FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    v_action := CASE WHEN NEW.is_active THEN 'reactivated' ELSE 'deactivated' END;
  ELSIF NEW.approval_state IS DISTINCT FROM OLD.approval_state THEN
    v_action := CASE NEW.approval_state
      WHEN 'pending' THEN 'submitted'
      WHEN 'approved' THEN 'approved'
      WHEN 'rejected' THEN 'rejected'
      ELSE 'updated' END;
  ELSE
    v_action := 'updated';
  END IF;

  INSERT INTO public.risk_history
    (risk_id, entity, entity_id, action, before_data, after_data, changed_by, changed_by_name)
  VALUES (NEW.id, 'risk', NEW.id, v_action,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    to_jsonb(NEW), auth.uid(), v_actor_name);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_risk() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER audit_risk AFTER INSERT OR UPDATE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.audit_risk();

-- Existing risks receive a baseline rather than invented earlier events.
INSERT INTO public.risk_history (risk_id, entity, entity_id, action, after_data)
SELECT id, 'risk', id, 'baseline', to_jsonb(r)
FROM public.risks r;

CREATE FUNCTION public.audit_risk_related() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row record;
  v_entity text;
  v_actor_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;
  v_entity := CASE TG_TABLE_NAME
    WHEN 'risk_factors' THEN 'factor'
    WHEN 'risk_preventive_actions' THEN 'action'
    ELSE 'plan' END;
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) IS NOT DISTINCT FROM to_jsonb(OLD) THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_actor_name FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.risk_history
    (risk_id, entity, entity_id, action, before_data, after_data, changed_by, changed_by_name)
  VALUES (v_row.risk_id, v_entity, v_row.id,
    CASE TG_OP WHEN 'INSERT' THEN 'added' WHEN 'DELETE' THEN 'removed' ELSE 'updated' END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    auth.uid(), v_actor_name);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_risk_related() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER audit_risk_factor AFTER INSERT OR UPDATE OR DELETE ON public.risk_factors
  FOR EACH ROW EXECUTE FUNCTION public.audit_risk_related();
CREATE TRIGGER audit_risk_action AFTER INSERT OR UPDATE OR DELETE ON public.risk_preventive_actions
  FOR EACH ROW EXECUTE FUNCTION public.audit_risk_related();
CREATE TRIGGER audit_risk_plan AFTER INSERT OR UPDATE OR DELETE ON public.risk_contingency_plans
  FOR EACH ROW EXECUTE FUNCTION public.audit_risk_related();

NOTIFY pgrst, 'reload schema';
