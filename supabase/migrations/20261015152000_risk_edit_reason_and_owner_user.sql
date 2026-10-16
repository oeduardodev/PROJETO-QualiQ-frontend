-- Link responsible people to profiles while preserving legacy free-text names.
ALTER TABLE public.risks
  ADD COLUMN owner_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;

UPDATE public.risks r SET owner_id = p.id
FROM (
  SELECT btrim(name) AS name, (array_agg(id))[1] AS id
  FROM public.profiles
  GROUP BY btrim(name)
  HAVING count(*) = 1
) p
WHERE btrim(r.owner) = p.name;

CREATE INDEX risks_owner_id_idx ON public.risks (owner_id);
ALTER TABLE public.risk_history ADD COLUMN justification text;

-- Risk and process managers need the same user list as administrators.
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR lower(public.get_user_role()::text) IN ('admin', 'gestor'));

CREATE FUNCTION public.sync_risk_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.owner_id IS NULL THEN RETURN NEW; END IF;
  ELSIF NEW.owner_id IS NOT DISTINCT FROM OLD.owner_id THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id IS NULL THEN
    NEW.owner := NULL;
  ELSE
    SELECT name INTO NEW.owner FROM public.profiles WHERE id = NEW.owner_id;
    IF NEW.owner IS NULL THEN
      RAISE EXCEPTION 'Risk owner is not a registered user' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_risk_owner() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER a_sync_risk_owner BEFORE INSERT OR UPDATE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.sync_risk_owner();

CREATE OR REPLACE FUNCTION public.enforce_risk_approval() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_role text := lower(coalesce(public.get_user_role()::text, ''));
  v_content_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.approval_state := 'draft';
    NEW.submitted_at := NULL;
    NEW.submitted_by := NULL;
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
    NEW.rejection_reason := NULL;
    RETURN NEW;
  END IF;

  v_content_changed := ROW(NEW.code, NEW.title, NEW.description, NEW.process_id,
    NEW.step_id, NEW.probability, NEW.impact, NEW.risk_type, NEW.barriers,
    NEW.status, NEW.owner, NEW.owner_id, NEW.custom_fields)
    IS DISTINCT FROM ROW(OLD.code, OLD.title, OLD.description, OLD.process_id,
    OLD.step_id, OLD.probability, OLD.impact, OLD.risk_type, OLD.barriers,
    OLD.status, OLD.owner, OLD.owner_id, OLD.custom_fields);

  IF NEW.approval_state IS DISTINCT FROM OLD.approval_state THEN
    IF v_content_changed THEN
      RAISE EXCEPTION 'Save risk changes before changing approval state' USING ERRCODE = '22023';
    END IF;
    IF NEW.approval_state = 'pending' AND OLD.approval_state IN ('draft', 'rejected')
      AND v_role IN ('admin', 'gestor') THEN
      NEW.submitted_at := now();
      NEW.submitted_by := auth.uid();
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
      NEW.rejection_reason := NULL;
    ELSIF NEW.approval_state = 'approved' AND OLD.approval_state = 'pending'
      AND v_role = 'admin' THEN
      NEW.approved_at := now();
      NEW.approved_by := auth.uid();
      NEW.rejection_reason := NULL;
    ELSIF NEW.approval_state = 'rejected' AND OLD.approval_state = 'pending'
      AND v_role = 'admin' AND nullif(btrim(NEW.rejection_reason), '') IS NOT NULL THEN
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
      NEW.rejection_reason := btrim(NEW.rejection_reason);
    ELSE
      RAISE EXCEPTION 'Invalid risk approval transition' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF OLD.approval_state = 'pending' AND v_content_changed THEN
      RAISE EXCEPTION 'A pending risk cannot be edited' USING ERRCODE = '22023';
    END IF;
    IF v_content_changed AND OLD.approval_state IN ('approved', 'rejected') THEN
      NEW.approval_state := 'draft';
      NEW.submitted_at := NULL;
      NEW.submitted_by := NULL;
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
      NEW.rejection_reason := NULL;
    ELSE
      NEW.submitted_at := OLD.submitted_at;
      NEW.submitted_by := OLD.submitted_by;
      NEW.approved_at := OLD.approved_at;
      NEW.approved_by := OLD.approved_by;
      NEW.rejection_reason := OLD.rejection_reason;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.require_risk_edit_reason() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF ROW(NEW.code, NEW.title, NEW.description, NEW.process_id, NEW.step_id,
    NEW.probability, NEW.impact, NEW.risk_type, NEW.barriers, NEW.status,
    NEW.owner, NEW.owner_id, NEW.custom_fields)
    IS DISTINCT FROM ROW(OLD.code, OLD.title, OLD.description, OLD.process_id, OLD.step_id,
    OLD.probability, OLD.impact, OLD.risk_type, OLD.barriers, OLD.status,
    OLD.owner, OLD.owner_id, OLD.custom_fields)
    AND nullif(btrim(current_setting('app.risk_change_reason', true)), '') IS NULL THEN
    RAISE EXCEPTION 'A justification is required to edit a risk' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.require_risk_edit_reason() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER require_risk_edit_reason BEFORE UPDATE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.require_risk_edit_reason();

CREATE OR REPLACE FUNCTION public.audit_risk() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_action text;
  v_actor_name text;
  v_reason text := nullif(btrim(current_setting('app.risk_change_reason', true)), '');
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
    (risk_id, entity, entity_id, action, justification, before_data, after_data,
     changed_by, changed_by_name)
  VALUES (NEW.id, 'risk', NEW.id, v_action, v_reason,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    to_jsonb(NEW), auth.uid(), v_actor_name);
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_risk_with_reason(
  p_id uuid, p_patch jsonb, p_justification text
) RETURNS public.risks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_old public.risks;
  v_new public.risks;
  v_saved public.risks;
BEGIN
  IF auth.uid() IS NULL OR lower(coalesce(public.get_user_role()::text, '')) NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Only managers may edit risks' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_justification), '') IS NULL THEN
    RAISE EXCEPTION 'A justification is required to edit a risk' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_patch) AS key
      WHERE key NOT IN ('title', 'description', 'process_id', 'step_id',
        'probability', 'impact', 'risk_type', 'barriers', 'status', 'owner', 'owner_id')
    ) THEN
    RAISE EXCEPTION 'Invalid risk changes' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM public.risks WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Risk not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_new FROM jsonb_populate_record(v_old, p_patch);
  PERFORM set_config('app.risk_change_reason', btrim(p_justification), true);
  UPDATE public.risks SET
    title = v_new.title,
    description = v_new.description,
    process_id = v_new.process_id,
    step_id = v_new.step_id,
    probability = v_new.probability,
    impact = v_new.impact,
    risk_type = v_new.risk_type,
    barriers = v_new.barriers,
    status = v_new.status,
    owner = v_new.owner,
    owner_id = v_new.owner_id
  WHERE id = p_id RETURNING * INTO v_saved;
  RETURN v_saved;
END;
$$;
REVOKE ALL ON FUNCTION public.update_risk_with_reason(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_risk_with_reason(uuid, jsonb, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
