-- Admin and Gestor may manage and activate SLAs without a separate approval.

CREATE OR REPLACE FUNCTION public.create_sla_draft(p_payload jsonb) RETURNS public.slas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_saved public.slas;
BEGIN
  IF auth.uid() IS NULL OR coalesce(lower(public.get_user_role()::text), '') NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Only admins and managers may create SLAs' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR p_payload - ARRAY['title','description','business_rules','criticality',
      'supplier_process_id','client_process_id','sipoc_input_id','notification_type_ids'] <> '{}'::jsonb
    OR nullif(btrim(p_payload->>'title'), '') IS NULL
    OR nullif(btrim(p_payload->>'description'), '') IS NULL
    OR nullif(btrim(p_payload->>'business_rules'), '') IS NULL
    OR nullif(p_payload->>'criticality', '') IS NULL
    OR nullif(p_payload->>'supplier_process_id', '') IS NULL
    OR nullif(p_payload->>'client_process_id', '') IS NULL
    OR (p_payload->>'supplier_process_id') = (p_payload->>'client_process_id')
    OR jsonb_typeof(p_payload->'notification_type_ids') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Complete the SLA name, description, rules, criticality and both distinct processes' USING ERRCODE = '22023';
  END IF;
  IF nullif(p_payload->>'sipoc_input_id', '') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sipoc_nodes n
    WHERE n.id = (p_payload->>'sipoc_input_id')::uuid AND n.node_type = 'I'
      AND (n.process_id = (p_payload->>'client_process_id')::uuid OR EXISTS (
        SELECT 1 FROM public.sipoc_node_associations a
        WHERE a.node_id = n.id AND a.process_id = (p_payload->>'client_process_id')::uuid
      ))
  ) THEN
    RAISE EXCEPTION 'The SIPOC input must belong to the client process' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.slas (
    title, description, business_rules, criticality, supplier_process_id,
    client_process_id, sipoc_input_id, lead_time_hours, status, approval_state
  ) VALUES (
    btrim(p_payload->>'title'), btrim(p_payload->>'description'),
    btrim(p_payload->>'business_rules'), (p_payload->>'criticality')::public.sla_criticality_level,
    (p_payload->>'supplier_process_id')::uuid, (p_payload->>'client_process_id')::uuid,
    nullif(p_payload->>'sipoc_input_id','')::uuid, 0, 'Inativo', 'draft'
  ) RETURNING * INTO v_saved;

  IF EXISTS (SELECT 1 FROM public.notification_types
    WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(p_payload->'notification_type_ids'))
      AND sla_id IS NOT NULL) THEN
    RAISE EXCEPTION 'A notification type already belongs to another SLA' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('app.sla_link_edit', 'allowed', true);
  UPDATE public.notification_types SET sla_id = v_saved.id
  WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(p_payload->'notification_type_ids'));
  IF (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_payload->'notification_type_ids'))
     <> (SELECT count(*) FROM public.notification_types WHERE sla_id = v_saved.id) THEN
    RAISE EXCEPTION 'One or more notification types do not exist' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_payload->'notification_type_ids') > 0 THEN
    INSERT INTO public.sla_history (sla_id, action, after_data, changed_by)
    SELECT v_saved.id, 'updated', jsonb_build_object('notification_type_ids',
      array_agg(id ORDER BY id)), auth.uid()
    FROM public.notification_types WHERE sla_id = v_saved.id;
  END IF;
  RETURN v_saved;
END;
$$;
REVOKE ALL ON FUNCTION public.create_sla_draft(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sla_draft(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_sla_with_reason(
  p_id uuid, p_patch jsonb, p_justification text
) RETURNS public.slas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_old public.slas;
  v_saved public.slas;
  v_old_type_ids uuid[];
  v_new_type_ids uuid[];
BEGIN
  IF auth.uid() IS NULL OR coalesce(lower(public.get_user_role()::text), '') NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Only admins and managers may edit SLAs' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_justification), '') IS NULL THEN
    RAISE EXCEPTION 'A justification is required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
    OR p_patch - ARRAY['title','description','business_rules','criticality',
      'supplier_process_id','client_process_id','sipoc_input_id','notification_type_ids'] <> '{}'::jsonb
    OR nullif(btrim(p_patch->>'title'), '') IS NULL
    OR nullif(btrim(p_patch->>'description'), '') IS NULL
    OR nullif(btrim(p_patch->>'business_rules'), '') IS NULL
    OR nullif(p_patch->>'criticality', '') IS NULL
    OR nullif(p_patch->>'supplier_process_id', '') IS NULL
    OR nullif(p_patch->>'client_process_id', '') IS NULL
    OR (p_patch->>'supplier_process_id') = (p_patch->>'client_process_id')
    OR jsonb_typeof(p_patch->'notification_type_ids') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Complete the SLA name, description, rules, criticality and both distinct processes' USING ERRCODE = '22023';
  END IF;
  IF nullif(p_patch->>'sipoc_input_id', '') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sipoc_nodes n
    WHERE n.id = (p_patch->>'sipoc_input_id')::uuid AND n.node_type = 'I'
      AND (n.process_id = (p_patch->>'client_process_id')::uuid OR EXISTS (
        SELECT 1 FROM public.sipoc_node_associations a
        WHERE a.node_id = n.id AND a.process_id = (p_patch->>'client_process_id')::uuid
      ))
  ) THEN
    RAISE EXCEPTION 'The SIPOC input must belong to the client process' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_old FROM public.slas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SLA not found' USING ERRCODE = 'P0002'; END IF;
  SELECT coalesce(array_agg(id ORDER BY id), ARRAY[]::uuid[]) INTO v_old_type_ids
    FROM public.notification_types WHERE sla_id = p_id;

  UPDATE public.sla_approvals SET decision = 'cancelled', decided_at = now()
    WHERE sla_id = p_id AND revision = v_old.approval_revision AND decision = 'pending';
  PERFORM set_config('app.sla_change_reason', btrim(p_justification), true);
  UPDATE public.slas SET
    title = btrim(p_patch->>'title'),
    description = btrim(p_patch->>'description'),
    business_rules = btrim(p_patch->>'business_rules'),
    criticality = (p_patch->>'criticality')::public.sla_criticality_level,
    supplier_process_id = (p_patch->>'supplier_process_id')::uuid,
    client_process_id = (p_patch->>'client_process_id')::uuid,
    sipoc_input_id = nullif(p_patch->>'sipoc_input_id','')::uuid,
    status = 'Inativo', approval_state = 'draft', submitted_at = NULL, approved_at = NULL
  WHERE id = p_id RETURNING * INTO v_saved;

  IF EXISTS (SELECT 1 FROM public.notification_types
    WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(p_patch->'notification_type_ids'))
      AND sla_id IS NOT NULL AND sla_id <> p_id) THEN
    RAISE EXCEPTION 'A notification type already belongs to another SLA' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('app.sla_link_edit', 'allowed', true);
  UPDATE public.notification_types SET sla_id = NULL WHERE sla_id = p_id
    AND id NOT IN (SELECT value::uuid FROM jsonb_array_elements_text(p_patch->'notification_type_ids'));
  UPDATE public.notification_types SET sla_id = p_id
    WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(p_patch->'notification_type_ids'));
  IF (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_patch->'notification_type_ids'))
     <> (SELECT count(*) FROM public.notification_types WHERE sla_id = p_id) THEN
    RAISE EXCEPTION 'One or more notification types do not exist' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(id ORDER BY id), ARRAY[]::uuid[]) INTO v_new_type_ids
    FROM public.notification_types WHERE sla_id = p_id;
  IF v_old_type_ids IS DISTINCT FROM v_new_type_ids THEN
    INSERT INTO public.sla_history (sla_id, action, justification, before_data, after_data, changed_by)
    VALUES (p_id, 'updated', btrim(p_justification),
      jsonb_build_object('notification_type_ids', v_old_type_ids),
      jsonb_build_object('notification_type_ids', v_new_type_ids), auth.uid());
  END IF;
  RETURN v_saved;
END;
$$;
REVOKE ALL ON FUNCTION public.update_sla_with_reason(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_sla_with_reason(uuid, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.deactivate_sla(p_id uuid, p_reason text) RETURNS public.slas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_saved public.slas;
BEGIN
  IF auth.uid() IS NULL OR coalesce(lower(public.get_user_role()::text), '') NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Only admins and managers may deactivate SLAs' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('app.sla_change_reason', btrim(p_reason), true);
  UPDATE public.slas SET status = 'Inativo', approval_state = 'draft',
    submitted_at = NULL, approved_at = NULL
    WHERE id = p_id AND status = 'Ativo' RETURNING * INTO v_saved;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only active SLAs may be deactivated' USING ERRCODE = '22023'; END IF;
  RETURN v_saved;
END;
$$;
REVOKE ALL ON FUNCTION public.deactivate_sla(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_sla(uuid, text) TO authenticated;

-- Admin and Gestor activate complete drafts directly. Process ownership does not gate activation.
CREATE OR REPLACE FUNCTION public.activate_sla(p_id uuid) RETURNS public.slas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_sla public.slas;
  v_saved public.slas;
BEGIN
  IF auth.uid() IS NULL OR coalesce(lower(public.get_user_role()::text), '') NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Only admins and managers may activate SLAs' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_sla FROM public.slas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SLA not found' USING ERRCODE = 'P0002'; END IF;
  IF v_sla.approval_state NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'SLA is not ready for activation' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(v_sla.title), '') IS NULL
    OR nullif(btrim(v_sla.description), '') IS NULL
    OR nullif(btrim(v_sla.business_rules), '') IS NULL
    OR v_sla.criticality IS NULL
    OR v_sla.supplier_process_id IS NULL OR v_sla.client_process_id IS NULL
    OR v_sla.supplier_process_id = v_sla.client_process_id THEN
    RAISE EXCEPTION 'Complete the SLA before activation' USING ERRCODE = '22023';
  END IF;
  IF v_sla.sipoc_input_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sipoc_nodes n
    WHERE n.id = v_sla.sipoc_input_id AND n.node_type = 'I'
      AND (n.process_id = v_sla.client_process_id OR EXISTS (
        SELECT 1 FROM public.sipoc_node_associations a
        WHERE a.node_id = n.id AND a.process_id = v_sla.client_process_id
      ))
  ) THEN
    RAISE EXCEPTION 'The SIPOC input must belong to the client process' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('app.sla_change_reason', 'SLA ativado diretamente', true);
  UPDATE public.slas SET approval_revision = approval_revision + 1,
    approval_state = 'approved', status = 'Ativo', submitted_at = NULL, approved_at = now()
  WHERE id = p_id RETURNING * INTO v_saved;
  RETURN v_saved;
END;
$$;
REVOKE ALL ON FUNCTION public.activate_sla(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_sla(uuid) TO authenticated;

-- Keep the prior RPC URL working for clients that have not updated yet.
CREATE OR REPLACE FUNCTION public.submit_sla_for_approval(p_id uuid) RETURNS public.slas
LANGUAGE sql SET search_path = '' AS $$
  SELECT public.activate_sla(p_id);
$$;
REVOKE ALL ON FUNCTION public.submit_sla_for_approval(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_sla_for_approval(uuid) TO authenticated;

DROP POLICY IF EXISTS sla_history_management_read ON public.sla_history;
CREATE POLICY sla_history_management_read ON public.sla_history FOR SELECT TO authenticated
  USING (lower(public.get_user_role()::text) IN ('admin', 'gestor'));
NOTIFY pgrst, 'reload schema';

