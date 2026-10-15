-- Preserve SLA changes and expose them to the same management roles that edit SLAs.
CREATE TABLE public.sla_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_id uuid NOT NULL REFERENCES public.slas(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('baseline', 'created', 'updated')),
  justification text,
  before_data jsonb,
  after_data jsonb NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sla_history_sla_idx ON public.sla_history (sla_id, changed_at DESC);
ALTER TABLE public.sla_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sla_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sla_history TO authenticated;
CREATE POLICY sla_history_management_read ON public.sla_history
  FOR SELECT TO authenticated
  USING (lower(public.get_user_role()::text) IN ('admin', 'gestor'));

CREATE FUNCTION public.audit_sla() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_reason text := nullif(btrim(current_setting('app.sla_change_reason', true)), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sla_history (sla_id, action, after_data, changed_by)
    VALUES (NEW.id, 'created', to_jsonb(NEW), auth.uid());
  ELSIF to_jsonb(NEW) - 'updated_at' IS DISTINCT FROM to_jsonb(OLD) - 'updated_at' THEN
    INSERT INTO public.sla_history
      (sla_id, action, justification, before_data, after_data, changed_by)
    VALUES (NEW.id, 'updated', v_reason, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_sla() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER audit_sla AFTER INSERT OR UPDATE ON public.slas
  FOR EACH ROW EXECUTE FUNCTION public.audit_sla();

-- Existing records have a baseline. Earlier edits cannot be reconstructed.
INSERT INTO public.sla_history (sla_id, action, after_data)
SELECT sla.id, 'baseline', to_jsonb(sla)
FROM public.slas AS sla;

CREATE FUNCTION public.update_sla_with_reason(
  p_id uuid, p_patch jsonb, p_justification text
) RETURNS public.slas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_old public.slas;
  v_new public.slas;
  v_saved public.slas;
BEGIN
  IF auth.uid() IS NULL OR lower(public.get_user_role()::text) NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Only managers may edit SLAs' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_justification), '') IS NULL THEN
    RAISE EXCEPTION 'A justification is required to edit an SLA' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid SLA changes' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_old FROM public.slas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SLA not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_new FROM jsonb_populate_record(v_old, p_patch);
  PERFORM set_config('app.sla_change_reason', btrim(p_justification), true);
  UPDATE public.slas SET
    title = v_new.title,
    supplier_process_id = v_new.supplier_process_id,
    client_process_id = v_new.client_process_id,
    sipoc_input_id = v_new.sipoc_input_id,
    lead_time_hours = v_new.lead_time_hours,
    quality_criteria = v_new.quality_criteria,
    criticality = v_new.criticality,
    status = v_new.status
  WHERE id = p_id RETURNING * INTO v_saved;
  RETURN v_saved;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_sla_with_reason(uuid, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_sla_with_reason(uuid, jsonb, text)
  TO authenticated;
NOTIFY pgrst, 'reload schema';
