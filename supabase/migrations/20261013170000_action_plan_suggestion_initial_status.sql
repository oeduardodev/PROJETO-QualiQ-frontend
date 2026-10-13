-- Suggested action plans follow the initial status configured in Supabase.
CREATE OR REPLACE FUNCTION public.create_action_plans_from_suggestions(
  p_ticket_id uuid,
  p_suggestions jsonb
)
RETURNS SETOF public.action_plans
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_initial_status text;
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
  SELECT key INTO v_initial_status
  FROM public.action_plan_statuses
  WHERE is_active
  ORDER BY is_initial DESC, order_index, key
  LIMIT 1;
  IF v_initial_status IS NULL THEN
    RAISE EXCEPTION 'No active action plan status configured' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    INSERT INTO public.action_plans (
      title, ticket_id, what, why, "where", "when", who, how, how_much, status
    )
    SELECT
      btrim(item.value->>'title'), p_ticket_id, item.value->>'what',
      item.value->>'why', NULL, NULL, item.value->>'who',
      item.value->>'how', item.value->>'how_much', v_initial_status
    FROM jsonb_array_elements(p_suggestions) AS item(value)
    RETURNING *;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_action_plans_from_suggestions(uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_action_plans_from_suggestions(uuid, jsonb)
  TO authenticated;
NOTIFY pgrst, 'reload schema';
