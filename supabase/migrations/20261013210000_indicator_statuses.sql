-- Indicator status labels and goal ratios are configured in the database.
CREATE TABLE public.indicator_statuses (
  key text PRIMARY KEY CHECK (length(btrim(key)) > 0),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  min_goal_ratio numeric UNIQUE CHECK (min_goal_ratio >= 0),
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  is_target boolean NOT NULL DEFAULT false,
  is_critical boolean NOT NULL DEFAULT false,
  is_problem boolean NOT NULL DEFAULT false,
  badge_background text NOT NULL DEFAULT '#f1f5f9' CHECK (badge_background ~ '^#[0-9A-Fa-f]{6}$'),
  badge_foreground text NOT NULL DEFAULT '#475569' CHECK (badge_foreground ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX indicator_statuses_single_default_idx ON public.indicator_statuses (is_default) WHERE is_default;
INSERT INTO public.indicator_statuses
  (key, label, min_goal_ratio, order_index, is_default, is_target, is_critical, is_problem, badge_background, badge_foreground)
VALUES
  ('no_alvo', 'No alvo', 1, 10, true, true, false, false, '#ecfdf5', '#047857'),
  ('atencao', 'Atenção', 0.8, 20, false, false, false, true, '#fffbeb', '#b45309'),
  ('critico', 'Crítico', NULL, 30, false, false, true, true, '#fff1f2', '#be123c');

ALTER TABLE public.indicators DROP CONSTRAINT IF EXISTS indicators_status_check;
ALTER TABLE public.indicators ADD CONSTRAINT indicators_status_fkey FOREIGN KEY (status)
  REFERENCES public.indicator_statuses(key) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.indicators ALTER COLUMN status DROP DEFAULT;
CREATE TRIGGER a_set_indicator_status_default BEFORE INSERT ON public.indicators
  FOR EACH ROW EXECUTE FUNCTION public.set_configured_status_default('indicator_statuses', 'is_default');

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
  v_status text;
BEGIN
  SELECT goal_value INTO v_goal FROM public.indicators WHERE id = p_indicator_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Indicator not found or not readable' USING ERRCODE = 'P0002';
  END IF;

  SELECT key INTO v_status
  FROM public.indicator_statuses
  WHERE is_active AND (min_goal_ratio IS NULL OR p_value >= v_goal * min_goal_ratio)
  ORDER BY min_goal_ratio DESC NULLS LAST, order_index, key
  LIMIT 1;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'No matching active indicator status configured' USING ERRCODE = '22023';
  END IF;

  UPDATE public.indicators
  SET current_value = p_value, status = v_status
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
REVOKE EXECUTE ON FUNCTION public.record_indicator_value(uuid, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_indicator_value(uuid, text, numeric) TO authenticated;

ALTER TABLE public.indicator_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY indicator_statuses_read ON public.indicator_statuses FOR SELECT TO authenticated
  USING (public.get_user_role() IS NOT NULL);
GRANT SELECT ON public.indicator_statuses TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.indicator_statuses FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
