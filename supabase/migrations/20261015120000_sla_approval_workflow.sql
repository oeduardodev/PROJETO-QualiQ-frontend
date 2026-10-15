-- SLA authoring belongs to admins. Process owners approve a frozen revision before activation.
ALTER TABLE public.slas
  ADD COLUMN description text,
  ADD COLUMN business_rules text,
  ADD COLUMN approval_state text NOT NULL DEFAULT 'draft'
    CHECK (approval_state IN ('draft', 'pending', 'approved', 'rejected', 'legacy')),
  ADD COLUMN approval_revision integer NOT NULL DEFAULT 0 CHECK (approval_revision >= 0),
  ADD COLUMN submitted_at timestamptz,
  ADD COLUMN approved_at timestamptz;

-- Historical active agreements stay available but are visibly distinguished from approvals.
UPDATE public.slas SET approval_state = 'legacy' WHERE status = 'Ativo';
ALTER TABLE public.slas
  ADD CONSTRAINT sla_approved_status_check
    CHECK (approval_state <> 'approved' OR status = 'Ativo'),
  ADD CONSTRAINT sla_pending_status_check
    CHECK (approval_state <> 'pending' OR status = 'Em Revisão'),
  ADD CONSTRAINT sla_active_approval_check
    CHECK (status <> 'Ativo' OR approval_state IN ('approved', 'legacy'));

CREATE TABLE public.sla_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_id uuid NOT NULL REFERENCES public.slas(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision > 0),
  approver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  process_ids uuid[] NOT NULL,
  decision text NOT NULL DEFAULT 'pending'
    CHECK (decision IN ('pending', 'approved', 'rejected', 'cancelled')),
  reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  UNIQUE (sla_id, revision, approver_id)
);
CREATE INDEX sla_approvals_assignee_idx ON public.sla_approvals (approver_id, decision, requested_at DESC);
CREATE INDEX sla_approvals_sla_idx ON public.sla_approvals (sla_id, revision);
ALTER TABLE public.sla_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sla_approvals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sla_approvals TO authenticated;
CREATE POLICY sla_approvals_read ON public.sla_approvals FOR SELECT TO authenticated
  USING (lower(public.get_user_role()::text) = 'admin' OR approver_id = auth.uid());

-- Existing broad RLS policies also allowed Gestor writes. Only checked functions may now write.
DROP POLICY IF EXISTS app_insert ON public.slas;
DROP POLICY IF EXISTS app_update ON public.slas;
DROP POLICY IF EXISTS app_delete ON public.slas;
REVOKE INSERT, UPDATE, DELETE ON public.slas FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS sla_history_management_read ON public.sla_history;
CREATE POLICY sla_history_management_read ON public.sla_history FOR SELECT TO authenticated
  USING (
    lower(public.get_user_role()::text) = 'admin'
    OR EXISTS (SELECT 1 FROM public.sla_approvals a
      WHERE a.sla_id = sla_history.sla_id AND a.approver_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.create_sla_draft(p_payload jsonb) RETURNS public.slas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_saved public.slas;
BEGIN
  IF auth.uid() IS NULL OR lower(public.get_user_role()::text) <> 'admin' THEN
    RAISE EXCEPTION 'Only admins may create SLAs' USING ERRCODE = '42501';
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
  IF auth.uid() IS NULL OR lower(public.get_user_role()::text) <> 'admin' THEN
    RAISE EXCEPTION 'Only admins may edit SLAs' USING ERRCODE = '42501';
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

CREATE FUNCTION public.submit_sla_for_approval(p_id uuid) RETURNS public.slas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_sla public.slas;
  v_owners uuid[];
  v_owner uuid;
  v_saved public.slas;
BEGIN
  IF auth.uid() IS NULL OR lower(public.get_user_role()::text) <> 'admin' THEN
    RAISE EXCEPTION 'Only admins may submit SLAs' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_sla FROM public.slas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SLA not found' USING ERRCODE = 'P0002'; END IF;
  IF v_sla.approval_state NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'SLA is not ready for submission' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(v_sla.title), '') IS NULL
    OR nullif(btrim(v_sla.description), '') IS NULL
    OR nullif(btrim(v_sla.business_rules), '') IS NULL
    OR v_sla.criticality IS NULL
    OR v_sla.supplier_process_id IS NULL OR v_sla.client_process_id IS NULL
    OR v_sla.supplier_process_id = v_sla.client_process_id THEN
    RAISE EXCEPTION 'Complete the SLA before requesting approval' USING ERRCODE = '22023';
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
  SELECT array_agg(p.owner_id ORDER BY p.id) INTO v_owners
    FROM public.processes p
    WHERE p.id IN (v_sla.supplier_process_id, v_sla.client_process_id);
  IF coalesce(array_length(v_owners, 1), 0) <> 2 OR array_position(v_owners, NULL) IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM unnest(v_owners) AS owner_id
      LEFT JOIN public.profiles pr ON pr.id = owner_id AND lower(pr.role::text) = 'gestor'
      WHERE pr.id IS NULL
    ) THEN
    RAISE EXCEPTION 'Both processes need an owner with the Gestor role' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.sla_change_reason', 'Enviado para aprovação', true);
  UPDATE public.slas SET approval_revision = approval_revision + 1,
    approval_state = 'pending', status = 'Em Revisão', submitted_at = now(), approved_at = NULL
  WHERE id = p_id RETURNING * INTO v_saved;
  FOR v_owner IN SELECT DISTINCT unnest(v_owners) LOOP
    INSERT INTO public.sla_approvals (sla_id, revision, approver_id, process_ids)
    SELECT p_id, v_saved.approval_revision, v_owner, array_agg(p.id ORDER BY p.id)
    FROM public.processes p
    WHERE p.id IN (v_sla.supplier_process_id, v_sla.client_process_id) AND p.owner_id = v_owner;
  END LOOP;
  RETURN v_saved;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_sla_for_approval(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_sla_for_approval(uuid) TO authenticated;

CREATE FUNCTION public.decide_sla_approval(p_id uuid, p_approve boolean, p_reason text)
RETURNS public.slas LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_sla public.slas;
  v_saved public.slas;
  v_process_ids uuid[];
BEGIN
  IF auth.uid() IS NULL OR lower(public.get_user_role()::text) <> 'gestor' THEN
    RAISE EXCEPTION 'Only assigned managers may decide' USING ERRCODE = '42501';
  END IF;
  IF p_approve IS NULL OR (NOT p_approve AND nullif(btrim(p_reason), '') IS NULL) THEN
    RAISE EXCEPTION 'A rejection reason is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_sla FROM public.slas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_sla.approval_state <> 'pending' THEN
    RAISE EXCEPTION 'SLA has no pending approval' USING ERRCODE = '22023';
  END IF;
  SELECT process_ids INTO v_process_ids FROM public.sla_approvals
    WHERE sla_id = p_id AND revision = v_sla.approval_revision
      AND approver_id = auth.uid() AND decision = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This approval is not assigned to you' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_process_ids) AS process_id
    LEFT JOIN public.processes p ON p.id = process_id
    WHERE p.owner_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Process owner changed; request a new approval round' USING ERRCODE = '22023';
  END IF;
  UPDATE public.sla_approvals SET decision = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    reason = nullif(btrim(p_reason), ''), decided_at = now()
  WHERE sla_id = p_id AND revision = v_sla.approval_revision
    AND approver_id = auth.uid() AND decision = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This approval is not assigned to you' USING ERRCODE = '42501';
  END IF;
  IF NOT p_approve THEN
    UPDATE public.sla_approvals SET decision = 'cancelled', decided_at = now()
      WHERE sla_id = p_id AND revision = v_sla.approval_revision AND decision = 'pending';
    PERFORM set_config('app.sla_change_reason', 'Aprovação rejeitada: ' || btrim(p_reason), true);
    UPDATE public.slas SET approval_state = 'rejected', status = 'Inativo', approved_at = NULL
      WHERE id = p_id RETURNING * INTO v_saved;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.sla_approvals WHERE sla_id = p_id
      AND revision = v_sla.approval_revision AND decision <> 'approved'
  ) THEN
    PERFORM set_config('app.sla_change_reason', 'Todos os gestores aprovaram o SLA', true);
    UPDATE public.slas SET approval_state = 'approved', status = 'Ativo', approved_at = now()
      WHERE id = p_id RETURNING * INTO v_saved;
  ELSE
    v_saved := v_sla;
  END IF;
  RETURN v_saved;
END;
$$;
REVOKE ALL ON FUNCTION public.decide_sla_approval(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_sla_approval(uuid, boolean, text) TO authenticated;

CREATE FUNCTION public.deactivate_sla(p_id uuid, p_reason text) RETURNS public.slas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_saved public.slas;
BEGIN
  IF auth.uid() IS NULL OR lower(public.get_user_role()::text) <> 'admin' THEN
    RAISE EXCEPTION 'Only admins may deactivate SLAs' USING ERRCODE = '42501';
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

CREATE FUNCTION public.guard_sla_notification_link() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.sla_id IS NOT NULL THEN
      RAISE EXCEPTION 'Unlink the notification type in SLA management first' USING ERRCODE = '22023';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.sla_id IS NOT NULL THEN
      RAISE EXCEPTION 'Link notification types in SLA management' USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.sla_id IS DISTINCT FROM OLD.sla_id
    AND (current_setting('app.sla_link_edit', true) IS DISTINCT FROM 'allowed'
      OR auth.uid() IS NULL OR lower(public.get_user_role()::text) <> 'admin') THEN
    RAISE EXCEPTION 'Link notification types in SLA management' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_sla_notification_link() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_sla_notification_link BEFORE INSERT OR UPDATE OR DELETE
  ON public.notification_types FOR EACH ROW EXECUTE FUNCTION public.guard_sla_notification_link();

CREATE FUNCTION public.guard_ticket_sla_active() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.sla_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.sla_id IS DISTINCT FROM OLD.sla_id)
    AND NOT EXISTS (SELECT 1 FROM public.slas s WHERE s.id = NEW.sla_id AND s.status = 'Ativo') THEN
    RAISE EXCEPTION 'Only active SLAs can be linked to new notifications' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_ticket_sla_active() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_ticket_sla_active BEFORE INSERT OR UPDATE OF sla_id
  ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.guard_ticket_sla_active();

NOTIFY pgrst, 'reload schema';
