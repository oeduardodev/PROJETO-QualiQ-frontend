-- A PostgREST request is one transaction. Keep the document change and its
-- audit entry together, and reject a transition based on a stale status.
CREATE OR REPLACE FUNCTION public.advance_document(
  p_document_id uuid,
  p_expected_status public.document_status,
  p_next_status public.document_status
)
RETURNS public.documents
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  updated_document public.documents;
BEGIN
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

REVOKE EXECUTE ON FUNCTION public.advance_document(uuid, public.document_status, public.document_status)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_document(uuid, public.document_status, public.document_status)
  TO authenticated;

-- Likewise, current KPI state and the history entry must succeed or fail
-- together. The status thresholds match indicatorStatus() in the client.
CREATE OR REPLACE FUNCTION public.record_indicator_value(
  p_indicator_id uuid,
  p_period text,
  p_value numeric
)
RETURNS public.indicators
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  updated_indicator public.indicators;
BEGIN
  UPDATE public.indicators
  SET current_value = p_value,
      status = CASE
        WHEN p_value >= goal_value THEN 'no_alvo'
        WHEN p_value >= goal_value * 0.8 THEN 'atencao'
        ELSE 'critico'
      END
  WHERE id = p_indicator_id
  RETURNING * INTO updated_indicator;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Indicator not found or not writable' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.indicator_history (indicator_id, period, value, goal)
  VALUES (p_indicator_id, p_period, p_value, updated_indicator.goal_value);

  RETURN updated_indicator;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_indicator_value(uuid, text, numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_indicator_value(uuid, text, numeric)
  TO authenticated;
