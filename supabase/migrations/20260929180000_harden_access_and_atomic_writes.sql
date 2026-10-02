-- Keep authorization and multi-row writes in the database, where direct API
-- callers cannot bypass the application's controls.

-- Operators can see the same categories and KPI summaries exposed by the
-- dashboard, but the existing write policies remain restricted.
DROP POLICY IF EXISTS "select_categories_admin_gestor" ON public.value_chain_categories;
CREATE POLICY "select_categories_all_roles" ON public.value_chain_categories
  FOR SELECT TO authenticated
  USING (public.get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "select_indicators_admin_gestor" ON public.indicators;
CREATE POLICY "select_indicators_all_roles" ON public.indicators
  FOR SELECT TO authenticated
  USING (public.get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "select_indicator_history_admin_gestor" ON public.indicator_history;
CREATE POLICY "select_indicator_history_all_roles" ON public.indicator_history
  FOR SELECT TO authenticated
  USING (public.get_user_role() IS NOT NULL);

DROP POLICY IF EXISTS "insert_controlled_copies" ON public.controlled_copies;
CREATE POLICY "insert_controlled_copies" ON public.controlled_copies
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'solicitada'
    AND delivery_date IS NULL
    AND return_date IS NULL
    AND EXISTS (
      SELECT 1 FROM public.documents document
      WHERE document.id = controlled_copies.document_id
        AND document.status = 'publicado'
        AND document.print_allowed
    )
  );
DROP POLICY IF EXISTS "select_controlled_copies" ON public.controlled_copies;
CREATE POLICY "select_controlled_copies" ON public.controlled_copies
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_gestor());
REVOKE INSERT ON public.controlled_copies FROM PUBLIC, anon, authenticated;
GRANT INSERT (document_id) ON public.controlled_copies TO authenticated;

ALTER TABLE public.helpdesk_tickets
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.helpdesk_tickets ALTER COLUMN created_by SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS idx_helpdesk_created_by ON public.helpdesk_tickets(created_by);
DROP POLICY IF EXISTS app_insert ON public.helpdesk_tickets;
DROP POLICY IF EXISTS app_update ON public.helpdesk_tickets;
DROP POLICY IF EXISTS app_delete ON public.helpdesk_tickets;
CREATE POLICY app_insert ON public.helpdesk_tickets
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IS NOT NULL AND created_by = auth.uid());
CREATE POLICY app_update ON public.helpdesk_tickets
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_gestor() OR created_by = auth.uid())
  WITH CHECK (public.is_admin_or_gestor() OR created_by = auth.uid());
CREATE POLICY app_delete ON public.helpdesk_tickets
  FOR DELETE TO authenticated
  USING (public.is_admin_or_gestor() OR created_by = auth.uid());
REVOKE UPDATE ON public.helpdesk_tickets FROM PUBLIC, anon, authenticated;
GRANT UPDATE (
  title, description, category, status, priority, requester_name,
  assigned_to, process_id, custom_fields, updated_at
) ON public.helpdesk_tickets TO authenticated;

DROP POLICY IF EXISTS "insert_tickets_role_based" ON public.tickets;
CREATE POLICY "insert_tickets_role_based" ON public.tickets
  FOR INSERT TO authenticated WITH CHECK (
    public.get_user_role() = 'Admin'
    OR (
      public.get_user_role() = 'Gestor'
      AND EXISTS (
        SELECT 1 FROM public.processes p
        WHERE p.id = tickets.process_id
          AND p.category_id = public.get_user_category_id()
      )
    )
    OR (public.get_user_role() = 'Operador' AND created_by = auth.uid())
  );
REVOKE UPDATE ON public.tickets FROM PUBLIC, anon, authenticated;
GRANT UPDATE (
  title, description, process_id, step_id, status, severity,
  classification_flag, incident_type, free_description, incident_datetime,
  risk_id, sla_id, notification_type_id, analysis_completed, custom_fields,
  updated_at
) ON public.tickets TO authenticated;

-- Ordinary document edits must not change workflow state or forge history.
DROP POLICY IF EXISTS "insert_documents" ON public.documents;
REVOKE INSERT ON public.documents FROM PUBLIC, anon, authenticated;
REVOKE UPDATE ON public.documents FROM PUBLIC, anon, authenticated;
GRANT UPDATE (title, type_id, process_id, drive_link, print_allowed)
  ON public.documents TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.document_workflows
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.advance_document(
  p_document_id uuid,
  p_expected_status public.document_status,
  p_next_status public.document_status
)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_document public.documents;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_gestor() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    (p_expected_status = 'rascunho' AND p_next_status = 'em_revisao') OR
    (p_expected_status = 'em_revisao' AND p_next_status = 'aprovado') OR
    (p_expected_status = 'aprovado' AND p_next_status = 'publicado') OR
    (p_expected_status = 'publicado' AND p_next_status = 'obsoleto')
  ) THEN
    RAISE EXCEPTION 'Invalid document transition' USING ERRCODE = '22023';
  END IF;

  UPDATE public.documents
  SET status = p_next_status
  WHERE id = p_document_id AND status = p_expected_status
  RETURNING * INTO updated_document;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found or status changed' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.document_workflows (
    document_id, from_status, to_status, changed_by, sla_deadline, notes
  ) VALUES (
    p_document_id, p_expected_status, p_next_status, auth.uid(), NULL, NULL
  );
  RETURN updated_document;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.advance_document(
  uuid, public.document_status, public.document_status
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_document(
  uuid, public.document_status, public.document_status
) TO authenticated;

-- Preserve the form's status selector while recording every selected state
-- change in the same transaction as the document details.
CREATE OR REPLACE FUNCTION public.save_document(
  p_document_id uuid,
  p_expected_status public.document_status,
  p_status public.document_status,
  p_title text,
  p_type_id uuid,
  p_process_id uuid,
  p_drive_link text,
  p_print_allowed boolean
)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  saved_document public.documents;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_gestor() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_title), '') IS NULL OR p_status IS NULL OR p_print_allowed IS NULL THEN
    RAISE EXCEPTION 'Invalid document data' USING ERRCODE = '22023';
  END IF;

  IF p_document_id IS NULL THEN
    IF p_expected_status IS NOT NULL THEN
      RAISE EXCEPTION 'Unexpected initial status' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.documents (
      title, type_id, process_id, drive_link, status, owner_id, print_allowed
    ) VALUES (
      p_title, p_type_id, p_process_id, p_drive_link, p_status, auth.uid(), p_print_allowed
    ) RETURNING * INTO saved_document;
    INSERT INTO public.document_workflows (
      document_id, from_status, to_status, changed_by
    ) VALUES (saved_document.id, NULL, p_status, auth.uid());
  ELSE
    IF p_expected_status IS NULL THEN
      RAISE EXCEPTION 'Expected status is required' USING ERRCODE = '22023';
    END IF;
    UPDATE public.documents
    SET title = p_title,
        type_id = p_type_id,
        process_id = p_process_id,
        drive_link = p_drive_link,
        status = p_status,
        print_allowed = p_print_allowed
    WHERE id = p_document_id AND status = p_expected_status
    RETURNING * INTO saved_document;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Document not found or status changed' USING ERRCODE = 'P0002';
    END IF;
    IF p_status IS DISTINCT FROM p_expected_status THEN
      INSERT INTO public.document_workflows (
        document_id, from_status, to_status, changed_by
      ) VALUES (p_document_id, p_expected_status, p_status, auth.uid());
    END IF;
  END IF;
  RETURN saved_document;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.save_document(
  uuid, public.document_status, public.document_status, text, uuid, uuid, text, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_document(
  uuid, public.document_status, public.document_status, text, uuid, uuid, text, boolean
) TO authenticated;

-- Edge Function quota: one atomic counter per user and UTC hour.
CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  requests integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_ai_quota()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_gestor() THEN
    RETURN false;
  END IF;
  INSERT INTO public.ai_usage (user_id, window_start, requests)
  VALUES (auth.uid(), date_trunc('hour', now()), 1)
  ON CONFLICT (user_id, window_start) DO UPDATE
    SET requests = public.ai_usage.requests + 1
    WHERE public.ai_usage.requests < 10
  RETURNING requests INTO new_count;
  RETURN new_count IS NOT NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_ai_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota() TO authenticated;

-- SIPOC creation is atomic and explicitly checks the caller's process scope.
CREATE OR REPLACE FUNCTION public.create_sipoc_node_with_steps(
  p_title text,
  p_description text,
  p_node_type text,
  p_process_id uuid,
  p_step_ids uuid[]
)
RETURNS public.sipoc_nodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  created_node public.sipoc_nodes;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.processes process
    WHERE process.id = p_process_id
      AND (
        public.get_user_role() = 'Admin'
        OR (
          public.get_user_role() = 'Gestor'
          AND process.category_id = public.get_user_category_id()
        )
      )
  ) THEN
    RAISE EXCEPTION 'Not authorized for process' USING ERRCODE = '42501';
  END IF;
  IF p_node_type NOT IN ('S', 'I', 'P', 'O', 'C')
    OR nullif(btrim(p_title), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid SIPOC node' USING ERRCODE = '22023';
  END IF;
  IF p_node_type = 'P' AND cardinality(coalesce(p_step_ids, ARRAY[]::uuid[])) > 0 THEN
    RAISE EXCEPTION 'A process step cannot be linked to steps' USING ERRCODE = '22023';
  END IF;
  IF p_node_type <> 'P' AND EXISTS (
    SELECT 1 FROM unnest(coalesce(p_step_ids, ARRAY[]::uuid[])) AS requested(step_id)
    LEFT JOIN public.sipoc_nodes step ON step.id = requested.step_id
    WHERE step.id IS NULL OR step.node_type <> 'P'
      OR step.process_id IS DISTINCT FROM p_process_id
  ) THEN
    RAISE EXCEPTION 'Invalid SIPOC step association' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.sipoc_nodes (
    title, description, node_type, order_index, process_id
  ) VALUES (
    btrim(p_title), nullif(btrim(p_description), ''), p_node_type,
    0, CASE WHEN p_node_type = 'P' THEN p_process_id ELSE NULL END
  ) RETURNING * INTO created_node;
  IF p_node_type <> 'P' THEN
    INSERT INTO public.sipoc_node_associations (node_id, process_id)
    VALUES (created_node.id, p_process_id);
    INSERT INTO public.sipoc_step_associations (step_node_id, associated_node_id)
    SELECT DISTINCT requested.step_id, created_node.id
    FROM unnest(coalesce(p_step_ids, ARRAY[]::uuid[])) AS requested(step_id);
  END IF;
  RETURN created_node;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_sipoc_node_with_steps(
  text, text, text, uuid, uuid[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sipoc_node_with_steps(
  text, text, text, uuid, uuid[]
) TO authenticated;

-- Plan creation is atomic and still subject to the caller's RLS policies.
CREATE OR REPLACE FUNCTION public.create_action_plans_from_suggestions(
  p_ticket_id uuid,
  p_suggestions jsonb
)
RETURNS SETOF public.action_plans
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF jsonb_typeof(p_suggestions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid action plan suggestions' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_suggestions) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Invalid action plan suggestions' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_suggestions) AS item(value)
    WHERE nullif(btrim(item.value->>'title'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Action plan title is required' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    INSERT INTO public.action_plans (
      title, ticket_id, what, why, "where", "when", who, how, how_much, status
    )
    SELECT
      btrim(item.value->>'title'), p_ticket_id, item.value->>'what',
      item.value->>'why', NULL, NULL, item.value->>'who',
      item.value->>'how', item.value->>'how_much', 'pendente'
    FROM jsonb_array_elements(p_suggestions) AS item(value)
    RETURNING *;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_action_plans_from_suggestions(
  uuid, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_action_plans_from_suggestions(
  uuid, jsonb
) TO authenticated;
