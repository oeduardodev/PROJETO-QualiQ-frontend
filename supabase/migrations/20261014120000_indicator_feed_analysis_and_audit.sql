-- Each submitted result is an immutable evolution with its author and any late reason.
ALTER TABLE public.indicator_history
  ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN late_justification text;
ALTER TABLE public.indicator_history
  ALTER COLUMN created_by SET DEFAULT auth.uid();
CREATE INDEX indicator_history_author_idx ON public.indicator_history (created_by);

-- Existing records predate author tracking and intentionally retain a NULL author.
DROP POLICY IF EXISTS "insert_indicator_history_admin_gestor" ON public.indicator_history;
DROP POLICY IF EXISTS "update_indicator_history_admin_gestor" ON public.indicator_history;
DROP POLICY IF EXISTS "delete_indicator_history_admin_gestor" ON public.indicator_history;
REVOKE INSERT, UPDATE, DELETE ON public.indicator_history FROM PUBLIC, anon, authenticated;

-- The previous three-argument RPC cannot enforce a late justification.
REVOKE EXECUTE ON FUNCTION public.record_indicator_value(uuid, text, numeric)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.record_indicator_result(
  p_indicator_id uuid,
  p_period date,
  p_value numeric,
  p_late_justification text DEFAULT NULL,
  p_analysis text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_indicator public.indicators;
  v_latest public.indicator_history;
  v_history public.indicator_history;
  v_due date;
  v_previous_due date;
  v_baseline date;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_role text := lower(public.get_user_role()::text);
BEGIN
  IF auth.uid() IS NULL OR v_role NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Not authorized to record an indicator result' USING ERRCODE = '42501';
  END IF;
  SELECT i.* INTO v_indicator FROM public.indicators i
    WHERE i.id = p_indicator_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Indicator not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_role = 'gestor' AND NOT EXISTS (
    SELECT 1 FROM public.processes p WHERE p.id = v_indicator.process_id
      AND p.category_id = public.get_user_category_id()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this indicator' USING ERRCODE = '42501';
  END IF;
  IF p_period IS NULL OR p_period > v_today OR p_value IS NULL OR
     p_value::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Invalid period or value' USING ERRCODE = '22023';
  END IF;
  v_due := CASE v_indicator.frequency::text
    WHEN 'diario' THEN p_period + 1
    WHEN 'semanal' THEN p_period + 7
    WHEN 'quinzenal' THEN p_period + 15
    WHEN 'mensal' THEN (p_period + interval '1 month')::date
    WHEN 'bimestral' THEN (p_period + interval '2 months')::date
    WHEN 'trimestral' THEN (p_period + interval '3 months')::date
    WHEN 'semestral' THEN (p_period + interval '6 months')::date
    WHEN 'anual' THEN (p_period + interval '1 year')::date
    ELSE NULL
  END;
  SELECT h.* INTO v_latest FROM public.indicator_history h
    WHERE h.indicator_id = p_indicator_id
    ORDER BY h.period_date DESC NULLS LAST, h.created_at DESC, h.id DESC LIMIT 1;
  v_baseline := coalesce(v_latest.period_date,
    (v_indicator.created_at AT TIME ZONE 'America/Sao_Paulo')::date, v_today);
  v_previous_due := CASE v_indicator.frequency::text
    WHEN 'diario' THEN v_baseline + 1
    WHEN 'semanal' THEN v_baseline + 7
    WHEN 'quinzenal' THEN v_baseline + 15
    WHEN 'mensal' THEN (v_baseline + interval '1 month')::date
    WHEN 'bimestral' THEN (v_baseline + interval '2 months')::date
    WHEN 'trimestral' THEN (v_baseline + interval '3 months')::date
    WHEN 'semestral' THEN (v_baseline + interval '6 months')::date
    WHEN 'anual' THEN (v_baseline + interval '1 year')::date
    ELSE NULL
  END;
  v_due := least(v_due, v_previous_due);
  IF v_due < v_today AND nullif(btrim(p_late_justification), '') IS NULL THEN
    RAISE EXCEPTION 'Justification is required for a late indicator result'
      USING ERRCODE = '22023';
  END IF;
  IF v_indicator.requires_critical_analysis AND nullif(btrim(p_analysis), '') IS NULL THEN
    RAISE EXCEPTION 'Critical analysis is required for this indicator'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.indicator_history
    (indicator_id, period, period_date, value, goal, created_by, late_justification)
  VALUES
    (p_indicator_id, to_char(p_period, 'YYYY-MM-DD'), p_period, p_value,
     v_indicator.goal_value, auth.uid(),
     CASE WHEN v_due < v_today THEN btrim(p_late_justification) ELSE NULL END)
  RETURNING * INTO v_history;

  -- Backfilled periods stay in the evolution without replacing the current result.
  SELECT h.* INTO v_latest FROM public.indicator_history h
    WHERE h.indicator_id = p_indicator_id
    ORDER BY h.period_date DESC NULLS LAST, h.created_at DESC, h.id DESC LIMIT 1;
  UPDATE public.indicators SET current_value = v_latest.value
    WHERE id = p_indicator_id RETURNING * INTO v_indicator;

  IF nullif(btrim(p_analysis), '') IS NOT NULL THEN
    INSERT INTO public.indicator_result_analyses
      (indicator_id, history_id, observed_value, observed_goal, observed_period,
       diagnostic, suggestions, created_by)
    VALUES
      (p_indicator_id, v_history.id, p_value, v_history.goal, v_history.period,
       btrim(p_analysis), '[]'::jsonb, auth.uid());
  END IF;
  RETURN jsonb_build_object('indicator', to_jsonb(v_indicator), 'history', to_jsonb(v_history));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_indicator_result(uuid, date, numeric, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_indicator_result(uuid, date, numeric, text, text)
  TO authenticated;

CREATE FUNCTION public.indicator_result_actors()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p.id, p.name FROM public.profiles p
  WHERE public.get_user_role() IS NOT NULL AND p.id IN (
    SELECT h.created_by FROM public.indicator_history h
    UNION SELECT a.created_by FROM public.indicator_result_analyses a
  );
$$;
REVOKE EXECUTE ON FUNCTION public.indicator_result_actors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.indicator_result_actors() TO authenticated;

-- A result can be corrected by submitting another evolution for its period.
-- Direct changes to the summary value would otherwise bypass that history.
REVOKE UPDATE ON public.indicators FROM PUBLIC, anon, authenticated;
GRANT UPDATE (title, process_id, step_id, goal_value, unit, frequency,
  requires_critical_analysis, indicator_type, goal_direction, updated_at)
  ON public.indicators TO authenticated;

NOTIFY pgrst, 'reload schema';
