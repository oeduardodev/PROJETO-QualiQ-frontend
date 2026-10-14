-- Period-based observations, indicator classification, and recorded critical analyses.
ALTER TABLE public.indicators
  ADD COLUMN indicator_type text NOT NULL DEFAULT 'Não informado',
  ADD COLUMN goal_direction text NOT NULL DEFAULT 'higher'
    CHECK (goal_direction IN ('higher', 'lower'));

-- Existing seeded measures of waste and cycle time have an upper-limit goal.
UPDATE public.indicators SET goal_direction = 'lower'
WHERE title IN ('Índice de Refugo', 'Tempo de Ciclo Médio');

CREATE FUNCTION public.set_indicator_status_from_goal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_ratio numeric;
BEGIN
  v_ratio := CASE
    WHEN NEW.goal_direction = 'lower' AND NEW.current_value <= NEW.goal_value THEN 1
    WHEN NEW.goal_direction = 'lower' AND NEW.current_value > 0 THEN NEW.goal_value / NEW.current_value
    WHEN NEW.goal_direction = 'lower' THEN 0
    WHEN NEW.goal_value = 0 AND NEW.current_value >= 0 THEN 1
    WHEN NEW.goal_value = 0 THEN 0
    ELSE NEW.current_value / NEW.goal_value
  END;
  SELECT key INTO NEW.status FROM public.indicator_statuses
  WHERE is_active AND (min_goal_ratio IS NULL OR v_ratio >= min_goal_ratio)
  ORDER BY min_goal_ratio DESC NULLS LAST, order_index, key LIMIT 1;
  IF NEW.status IS NULL THEN
    RAISE EXCEPTION 'No matching active indicator status configured' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_indicator_status_from_goal() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER set_indicator_status_from_goal
  BEFORE INSERT OR UPDATE OF current_value, goal_value, goal_direction
  ON public.indicators FOR EACH ROW EXECUTE FUNCTION public.set_indicator_status_from_goal();
UPDATE public.indicators SET current_value = current_value;

ALTER TABLE public.indicator_history ADD COLUMN period_date date;
UPDATE public.indicator_history
SET period_date = period::date
WHERE period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';
ALTER TABLE public.indicator_history
  ADD CONSTRAINT indicator_history_period_date_matches
  CHECK (period_date IS NULL OR period = to_char(period_date, 'YYYY-MM-DD'));
CREATE FUNCTION public.set_indicator_period_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.period_date := CASE
    WHEN NEW.period ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN NEW.period::date
    ELSE NULL
  END;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_indicator_period_date() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER set_indicator_period_date
  BEFORE INSERT OR UPDATE OF period ON public.indicator_history
  FOR EACH ROW EXECUTE FUNCTION public.set_indicator_period_date();
CREATE INDEX indicator_history_period_date_idx
  ON public.indicator_history (period_date, indicator_id);

CREATE TABLE public.indicator_result_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id uuid NOT NULL REFERENCES public.indicators(id) ON DELETE CASCADE,
  history_id uuid REFERENCES public.indicator_history(id) ON DELETE CASCADE,
  observed_value numeric NOT NULL,
  observed_goal numeric NOT NULL,
  observed_period text NOT NULL,
  diagnostic text NOT NULL,
  suggestions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(suggestions) = 'array'),
  action_plan_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX indicator_result_analyses_result_idx
  ON public.indicator_result_analyses (indicator_id, history_id, created_at DESC);
ALTER TABLE public.indicator_result_analyses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.indicator_result_analyses FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT (indicator_id, history_id, observed_value, observed_goal,
  observed_period, diagnostic, suggestions), UPDATE (action_plan_ids)
  ON public.indicator_result_analyses TO authenticated;
CREATE POLICY indicator_result_analyses_read ON public.indicator_result_analyses
  FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
CREATE POLICY indicator_result_analyses_insert ON public.indicator_result_analyses
  FOR INSERT TO authenticated WITH CHECK (
    (lower(public.get_user_role()::text) = 'admin' OR (
      lower(public.get_user_role()::text) = 'gestor' AND EXISTS (
        SELECT 1 FROM public.indicators i
        JOIN public.processes p ON p.id = i.process_id
        WHERE i.id = indicator_id AND p.category_id = public.get_user_category_id()
      )
    )) AND created_by = auth.uid()
    AND (history_id IS NULL OR EXISTS (
      SELECT 1 FROM public.indicator_history h
      WHERE h.id = history_id AND h.indicator_id = indicator_id
    ))
  );
CREATE POLICY indicator_result_analyses_update ON public.indicator_result_analyses
  FOR UPDATE TO authenticated
  USING (lower(public.get_user_role()::text) = 'admin' OR (
    lower(public.get_user_role()::text) = 'gestor' AND EXISTS (
      SELECT 1 FROM public.indicators i
      JOIN public.processes p ON p.id = i.process_id
      WHERE i.id = indicator_id AND p.category_id = public.get_user_category_id()
    )
  ))
  WITH CHECK (lower(public.get_user_role()::text) = 'admin' OR (
    lower(public.get_user_role()::text) = 'gestor' AND EXISTS (
      SELECT 1 FROM public.indicators i
      JOIN public.processes p ON p.id = i.process_id
      WHERE i.id = indicator_id AND p.category_id = public.get_user_category_id()
    )
  ));

CREATE FUNCTION public.create_plans_for_indicator_analysis(
  p_analysis_id uuid,
  p_ticket_id uuid
)
RETURNS SETOF public.action_plans
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_analysis public.indicator_result_analyses;
  v_plan public.action_plans;
  v_plan_ids uuid[] := '{}';
BEGIN
  SELECT * INTO v_analysis FROM public.indicator_result_analyses WHERE id = p_analysis_id;
  IF NOT FOUND OR cardinality(v_analysis.action_plan_ids) > 0 THEN
    RAISE EXCEPTION 'Analysis not found or plans already created' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tickets t
    JOIN public.indicators i ON i.process_id = t.process_id
    WHERE t.id = p_ticket_id AND i.id = v_analysis.indicator_id
  ) THEN
    RAISE EXCEPTION 'Ticket is not related to the indicator process' USING ERRCODE = '22023';
  END IF;
  FOR v_plan IN
    SELECT * FROM public.create_action_plans_from_suggestions(p_ticket_id, v_analysis.suggestions)
  LOOP
    v_plan_ids := array_append(v_plan_ids, v_plan.id);
    RETURN NEXT v_plan;
  END LOOP;
  UPDATE public.indicator_result_analyses
  SET action_plan_ids = v_plan_ids
  WHERE id = p_analysis_id AND cardinality(action_plan_ids) = 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plans were already created for this analysis' USING ERRCODE = '40001';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_plans_for_indicator_analysis(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_plans_for_indicator_analysis(uuid, uuid) TO authenticated;

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
  v_goal numeric;
  v_direction text;
  v_status text;
  v_ratio numeric;
BEGIN
  IF p_period !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'Period must be an ISO date' USING ERRCODE = '22007';
  END IF;
  SELECT goal_value, goal_direction INTO v_goal, v_direction
  FROM public.indicators WHERE id = p_indicator_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Indicator not found or not readable' USING ERRCODE = 'P0002';
  END IF;
  v_ratio := CASE
    WHEN v_direction = 'lower' AND p_value <= v_goal THEN 1
    WHEN v_direction = 'lower' AND p_value > 0 THEN v_goal / p_value
    WHEN v_direction = 'lower' THEN 0
    WHEN v_goal = 0 AND p_value >= 0 THEN 1
    WHEN v_goal = 0 THEN 0
    ELSE p_value / v_goal
  END;
  SELECT key INTO v_status FROM public.indicator_statuses
  WHERE is_active AND (min_goal_ratio IS NULL OR v_ratio >= min_goal_ratio)
  ORDER BY min_goal_ratio DESC NULLS LAST, order_index, key LIMIT 1;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'No matching active indicator status configured' USING ERRCODE = '22023';
  END IF;
  UPDATE public.indicators SET current_value = p_value, status = v_status
  WHERE id = p_indicator_id RETURNING * INTO updated_indicator;
  INSERT INTO public.indicator_history (indicator_id, period, period_date, value, goal)
  VALUES (p_indicator_id, p_period, p_period::date, p_value, updated_indicator.goal_value);
  RETURN updated_indicator;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_indicator_value(uuid, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_indicator_value(uuid, text, numeric) TO authenticated;
NOTIFY pgrst, 'reload schema';
