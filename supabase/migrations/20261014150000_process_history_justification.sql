-- Keep process edit reasons beside the audited before/after values.
ALTER TABLE public.process_history
  ADD COLUMN IF NOT EXISTS justification text;

CREATE OR REPLACE FUNCTION public.audit_process() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_reason text := nullif(btrim(current_setting('app.process_change_reason', true)), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.process_history(process_id, action, after_data, changed_by)
    VALUES (NEW.id, 'created', to_jsonb(NEW), auth.uid());
  ELSIF to_jsonb(NEW) - 'updated_at' IS DISTINCT FROM to_jsonb(OLD) - 'updated_at' THEN
    INSERT INTO public.process_history
      (process_id, action, justification, before_data, after_data, changed_by)
    VALUES (NEW.id, 'updated', v_reason, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_process() FROM PUBLIC, anon, authenticated;

-- Editing the process definition and its reason happens in one transaction.
CREATE FUNCTION public.update_process_with_reason(
  p_id uuid, p_patch jsonb, p_justification text
) RETURNS public.processes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_old public.processes;
  v_new public.processes;
  v_saved public.processes;
BEGIN
  IF auth.uid() IS NULL OR lower(public.get_user_role()::text) <> 'admin' THEN
    RAISE EXCEPTION 'Only admins may edit processes' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_justification), '') IS NULL THEN
    RAISE EXCEPTION 'A justification is required to edit a process' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid process changes' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM public.processes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Process not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_new FROM jsonb_populate_record(v_old, p_patch);
  PERFORM set_config('app.process_change_reason', btrim(p_justification), true);
  UPDATE public.processes SET
    title = v_new.title,
    code = v_new.code,
    category_id = v_new.category_id,
    description = v_new.description,
    objective = v_new.objective,
    owner = v_new.owner,
    owner_id = v_new.owner_id,
    participant_ids = v_new.participant_ids,
    obsolete = v_new.obsolete,
    impact_score = v_new.impact_score,
    complexity_score = v_new.complexity_score,
    maturity_level = v_new.maturity_level
  WHERE id = p_id RETURNING * INTO v_saved;
  RETURN v_saved;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_process_with_reason(uuid, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_process_with_reason(uuid, jsonb, text)
  TO authenticated;
