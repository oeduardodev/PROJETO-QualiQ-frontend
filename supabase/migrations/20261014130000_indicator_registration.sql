-- Indicator registration is administered through one atomic RPC. Results stay in
-- indicator_history; definition changes have a separate immutable audit trail.
ALTER TABLE public.indicators
  ADD COLUMN objective text NOT NULL DEFAULT '',
  ADD COLUMN acceptable_variation numeric NOT NULL DEFAULT 0 CHECK (acceptable_variation >= 0),
  ADD COLUMN strategic boolean NOT NULL DEFAULT false,
  ADD COLUMN dimension_id uuid REFERENCES public.dimensions(id) ON DELETE RESTRICT,
  ADD COLUMN decimal_places integer NOT NULL DEFAULT 2 CHECK (decimal_places BETWEEN 0 AND 6),
  ADD COLUMN calculation_type text NOT NULL DEFAULT 'simple'
    CHECK (calculation_type IN ('simple', 'composite')),
  ADD COLUMN simple_formula text NOT NULL DEFAULT '',
  ADD COLUMN result_source text NOT NULL DEFAULT '',
  ADD COLUMN formula_expression text NOT NULL DEFAULT '',
  ADD COLUMN formula_tokens jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(formula_tokens) = 'array'),
  ADD COLUMN obsolete boolean NOT NULL DEFAULT false;

-- The acceptable variation is an absolute tolerance in the selected unit.
CREATE OR REPLACE FUNCTION public.set_indicator_status_from_goal()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_ratio numeric;
BEGIN
  v_ratio := CASE
    WHEN NEW.goal_direction = 'lower'
      AND NEW.current_value <= NEW.goal_value + NEW.acceptable_variation THEN 1
    WHEN NEW.goal_direction = 'higher'
      AND NEW.current_value >= NEW.goal_value - NEW.acceptable_variation THEN 1
    WHEN NEW.goal_direction = 'lower' AND NEW.current_value > 0
      THEN NEW.goal_value / NEW.current_value
    WHEN NEW.goal_direction = 'lower' THEN 0
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
DROP TRIGGER set_indicator_status_from_goal ON public.indicators;
CREATE TRIGGER set_indicator_status_from_goal
  BEFORE INSERT OR UPDATE OF current_value, goal_value, goal_direction, acceptable_variation
  ON public.indicators FOR EACH ROW EXECUTE FUNCTION public.set_indicator_status_from_goal();

CREATE TABLE public.indicator_dependencies (
  indicator_id uuid NOT NULL REFERENCES public.indicators(id) ON DELETE RESTRICT,
  source_indicator_id uuid NOT NULL REFERENCES public.indicators(id) ON DELETE RESTRICT,
  PRIMARY KEY (indicator_id, source_indicator_id),
  CHECK (indicator_id <> source_indicator_id)
);
CREATE INDEX indicator_dependencies_source_idx
  ON public.indicator_dependencies(source_indicator_id);

CREATE TABLE public.indicator_definition_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id uuid NOT NULL REFERENCES public.indicators(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('created', 'updated')),
  justification text,
  before_data jsonb,
  after_data jsonb NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX indicator_definition_history_indicator_idx
  ON public.indicator_definition_history(indicator_id, changed_at DESC);
ALTER TABLE public.indicator_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicator_definition_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY indicator_dependencies_read ON public.indicator_dependencies
  FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
CREATE POLICY indicator_definition_history_read ON public.indicator_definition_history
  FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
GRANT SELECT ON public.indicator_dependencies, public.indicator_definition_history TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.indicator_dependencies,
  public.indicator_definition_history FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.audit_indicator_definition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_reason text := nullif(btrim(current_setting('app.indicator_change_reason', true)), '');
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.indicator_definition_history
      (indicator_id, action, after_data, changed_by)
    VALUES (NEW.id, 'created', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
  v_before := to_jsonb(OLD) - 'current_value' - 'status' - 'updated_at';
  v_after := to_jsonb(NEW) - 'current_value' - 'status' - 'updated_at';
  IF v_before = v_after THEN RETURN NEW; END IF;
  IF v_reason IS NULL THEN
    IF v_before - 'code' = v_after - 'code' THEN
      v_reason := 'Código atualizado após alteração da sigla do processo';
    ELSE
      RAISE EXCEPTION 'Justification is required to change an indicator'
        USING ERRCODE = '22023';
    END IF;
  END IF;
  INSERT INTO public.indicator_definition_history
    (indicator_id, action, justification, before_data, after_data, changed_by)
  VALUES (NEW.id, 'updated', v_reason, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.audit_indicator_definition() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER audit_indicator_definition AFTER INSERT OR UPDATE ON public.indicators
  FOR EACH ROW EXECUTE FUNCTION public.audit_indicator_definition();

-- Existing code generation trigger already assigns PROCESS.IND.NNN and retains
-- the code on ordinary edits. Remove every direct definition write route.
DROP POLICY IF EXISTS "insert_indicators_admin_gestor" ON public.indicators;
DROP POLICY IF EXISTS "update_indicators_admin_gestor" ON public.indicators;
DROP POLICY IF EXISTS "delete_indicators_admin_gestor" ON public.indicators;
REVOKE INSERT, UPDATE, DELETE ON public.indicators FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (title, process_id, step_id, goal_value, unit, frequency,
  requires_critical_analysis, indicator_type, goal_direction, updated_at)
  ON public.indicators FROM authenticated;

CREATE FUNCTION public.prevent_indicator_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Indicators must be made obsolete, not deleted' USING ERRCODE = '23503';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_indicator_delete() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER prevent_indicator_delete BEFORE DELETE ON public.indicators
  FOR EACH ROW EXECUTE FUNCTION public.prevent_indicator_delete();

CREATE FUNCTION public.calculate_composite_indicator(p_indicator_id uuid, p_period date)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_indicator public.indicators;
  v_token jsonb;
  v_stack numeric[] := ARRAY[]::numeric[];
  v_count integer := 0;
  v_value numeric;
  v_left numeric;
  v_right numeric;
BEGIN
  SELECT * INTO v_indicator FROM public.indicators WHERE id = p_indicator_id;
  IF v_indicator.calculation_type <> 'composite' THEN RETURN NULL; END IF;
  FOR v_token IN SELECT value FROM jsonb_array_elements(v_indicator.formula_tokens) LOOP
    CASE v_token->>'kind'
      WHEN 'indicator' THEN
        SELECT h.value INTO v_value FROM public.indicator_history h
        WHERE h.indicator_id = (v_token->>'id')::uuid AND h.period_date = p_period
        ORDER BY h.created_at DESC, h.id DESC LIMIT 1;
        IF v_value IS NULL THEN RETURN NULL; END IF;
        v_stack := array_append(v_stack, v_value);
        v_count := v_count + 1;
      WHEN 'number' THEN
        v_stack := array_append(v_stack, (v_token->>'value')::numeric);
        v_count := v_count + 1;
      WHEN 'operator' THEN
        IF v_count < 2 THEN RETURN NULL; END IF;
        v_right := v_stack[v_count];
        v_left := v_stack[v_count - 1];
        v_stack := CASE WHEN v_count = 2 THEN ARRAY[]::numeric[]
          ELSE v_stack[1:v_count - 2] END;
        v_count := v_count - 2;
        CASE v_token->>'value'
          WHEN '+' THEN v_value := v_left + v_right;
          WHEN '-' THEN v_value := v_left - v_right;
          WHEN '*' THEN v_value := v_left * v_right;
          WHEN '/' THEN
            IF v_right = 0 THEN RETURN NULL; END IF;
            v_value := v_left / v_right;
          ELSE RETURN NULL;
        END CASE;
        v_stack := array_append(v_stack, v_value);
        v_count := v_count + 1;
      ELSE RETURN NULL;
    END CASE;
  END LOOP;
  IF v_count <> 1 THEN RETURN NULL; END IF;
  RETURN round(v_stack[1], v_indicator.decimal_places);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.calculate_composite_indicator(uuid, date)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.refresh_composite_indicator(p_indicator_id uuid, p_period date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_value numeric;
  v_previous numeric;
  v_indicator public.indicators;
BEGIN
  SELECT * INTO v_indicator FROM public.indicators WHERE id = p_indicator_id FOR UPDATE;
  IF v_indicator.obsolete THEN RETURN; END IF;
  v_value := public.calculate_composite_indicator(p_indicator_id, p_period);
  IF v_value IS NULL THEN RETURN; END IF;
  SELECT h.value INTO v_previous FROM public.indicator_history h
  WHERE h.indicator_id = p_indicator_id AND h.period_date = p_period
  ORDER BY h.created_at DESC, h.id DESC LIMIT 1;
  IF v_previous IS NOT DISTINCT FROM v_value THEN RETURN; END IF;
  INSERT INTO public.indicator_history
    (indicator_id, period, period_date, value, goal, created_by)
  VALUES (p_indicator_id, to_char(p_period, 'YYYY-MM-DD'), p_period,
    v_value, v_indicator.goal_value, NULL);
  UPDATE public.indicators SET current_value = (
    SELECT h.value FROM public.indicator_history h WHERE h.indicator_id = p_indicator_id
    ORDER BY h.period_date DESC NULLS LAST, h.created_at DESC, h.id DESC LIMIT 1
  ) WHERE id = p_indicator_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_composite_indicator(uuid, date)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.propagate_composite_result() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF NEW.period_date IS NULL THEN RETURN NEW; END IF;
  FOR v_id IN SELECT indicator_id FROM public.indicator_dependencies
    WHERE source_indicator_id = NEW.indicator_id ORDER BY indicator_id LOOP
    PERFORM public.refresh_composite_indicator(v_id, NEW.period_date);
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.propagate_composite_result() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER propagate_composite_result AFTER INSERT ON public.indicator_history
  FOR EACH ROW EXECUTE FUNCTION public.propagate_composite_result();

CREATE FUNCTION public.reject_manual_composite_result() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_indicator public.indicators;
BEGIN
  SELECT * INTO v_indicator FROM public.indicators WHERE id = NEW.indicator_id;
  IF v_indicator.obsolete THEN
    RAISE EXCEPTION 'Obsolete indicator cannot receive results' USING ERRCODE = '22023';
  END IF;
  IF v_indicator.calculation_type = 'composite' AND NEW.created_by IS NOT NULL THEN
    RAISE EXCEPTION 'Composite results are calculated automatically' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reject_manual_composite_result() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER reject_manual_composite_result BEFORE INSERT ON public.indicator_history
  FOR EACH ROW EXECUTE FUNCTION public.reject_manual_composite_result();

CREATE FUNCTION public.save_indicator_definition(
  p_id uuid, p_title text, p_objective text, p_process_id uuid, p_step_id uuid,
  p_frequency public.indicator_frequency_type, p_indicator_type text,
  p_requires_critical_analysis boolean, p_goal_value numeric,
  p_acceptable_variation numeric, p_unit public.indicator_unit_type,
  p_goal_direction text, p_strategic boolean, p_dimension_id uuid,
  p_calculation_type text, p_simple_formula text, p_result_source text,
  p_formula_expression text, p_formula_tokens jsonb, p_decimal_places integer, p_obsolete boolean,
  p_justification text
) RETURNS public.indicators
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_indicator public.indicators;
  v_token jsonb;
  v_depth integer := 0;
  v_source uuid;
  v_version_id uuid;
  v_period date;
BEGIN
  IF auth.uid() IS NULL OR lower(public.get_user_role()::text) <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators may configure indicators' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NOT NULL AND nullif(btrim(p_justification), '') IS NULL THEN
    RAISE EXCEPTION 'Justification is required to change an indicator' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(p_title), '') IS NULL OR nullif(btrim(p_objective), '') IS NULL OR
     p_goal_value IS NULL OR p_acceptable_variation IS NULL OR p_acceptable_variation < 0 OR
     p_decimal_places NOT BETWEEN 0 AND 6 OR
     p_indicator_type NOT IN ('estrutura', 'processo', 'resultado') OR
     p_calculation_type NOT IN ('simple', 'composite') OR
     p_goal_direction NOT IN ('higher', 'lower') THEN
    RAISE EXCEPTION 'Invalid indicator definition' USING ERRCODE = '22023';
  END IF;
  IF p_step_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sipoc_nodes WHERE id = p_step_id
      AND process_id = p_process_id AND node_type = 'P'
  ) THEN
    RAISE EXCEPTION 'Step does not belong to the selected process' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_version_id FROM public.dimension_versions
    ORDER BY version_number DESC LIMIT 1;
  IF p_strategic AND (p_dimension_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.dimensions WHERE id = p_dimension_id AND version_id = v_version_id
  )) THEN
    RAISE EXCEPTION 'Select a dimension in the current version' USING ERRCODE = '22023';
  END IF;
  IF p_calculation_type = 'composite' THEN
    IF jsonb_typeof(p_formula_tokens) <> 'array' OR jsonb_array_length(p_formula_tokens) = 0 THEN
      RAISE EXCEPTION 'Composite formula is required' USING ERRCODE = '22023';
    END IF;
    FOR v_token IN SELECT value FROM jsonb_array_elements(p_formula_tokens) LOOP
      CASE v_token->>'kind'
        WHEN 'indicator' THEN
          v_source := (v_token->>'id')::uuid;
          IF v_source = p_id OR NOT EXISTS (
            SELECT 1 FROM public.indicators WHERE id = v_source AND NOT obsolete
          ) THEN
            RAISE EXCEPTION 'Invalid source indicator' USING ERRCODE = '22023';
          END IF;
          v_depth := v_depth + 1;
        WHEN 'number' THEN
          IF (v_token->>'value') !~ '^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$' THEN
            RAISE EXCEPTION 'Invalid numeric constant' USING ERRCODE = '22023';
          END IF;
          v_depth := v_depth + 1;
        WHEN 'operator' THEN
          IF v_depth < 2 OR v_token->>'value' NOT IN ('+', '-', '*', '/') THEN
            RAISE EXCEPTION 'Invalid composite formula' USING ERRCODE = '22023';
          END IF;
          v_depth := v_depth - 1;
        ELSE RAISE EXCEPTION 'Invalid composite formula token' USING ERRCODE = '22023';
      END CASE;
    END LOOP;
    IF v_depth <> 1 OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_formula_tokens) t
      WHERE t->>'kind' = 'indicator'
    ) THEN
      RAISE EXCEPTION 'Composite formula must use indicators' USING ERRCODE = '22023';
    END IF;
  ELSIF nullif(btrim(p_simple_formula), '') IS NULL OR
        nullif(btrim(p_result_source), '') IS NULL THEN
    RAISE EXCEPTION 'Formula and result source are required' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.indicator_change_reason', coalesce(p_justification, ''), true);
  IF p_id IS NULL THEN
    INSERT INTO public.indicators
      (title, objective, process_id, step_id, frequency, indicator_type,
       requires_critical_analysis, goal_value, acceptable_variation, unit,
       goal_direction, strategic, dimension_id, calculation_type, simple_formula, result_source,
       formula_expression, formula_tokens, decimal_places, obsolete, current_value)
    VALUES (btrim(p_title), btrim(p_objective), p_process_id, p_step_id, p_frequency,
      p_indicator_type, p_requires_critical_analysis, p_goal_value,
      p_acceptable_variation, p_unit, p_goal_direction, p_strategic,
      CASE WHEN p_strategic THEN p_dimension_id ELSE NULL END,
      p_calculation_type, coalesce(btrim(p_simple_formula), ''),
      coalesce(btrim(p_result_source), ''), coalesce(btrim(p_formula_expression), ''),
      coalesce(p_formula_tokens, '[]'::jsonb),
      p_decimal_places, coalesce(p_obsolete, false), 0)
    RETURNING * INTO v_indicator;
  ELSE
    SELECT * INTO v_indicator FROM public.indicators WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Indicator not found' USING ERRCODE = 'P0002'; END IF;
    UPDATE public.indicators SET
      title = btrim(p_title), objective = btrim(p_objective), process_id = p_process_id,
      step_id = p_step_id, frequency = p_frequency, indicator_type = p_indicator_type,
      requires_critical_analysis = p_requires_critical_analysis, goal_value = p_goal_value,
      acceptable_variation = p_acceptable_variation, unit = p_unit,
      goal_direction = p_goal_direction, strategic = p_strategic,
      dimension_id = CASE WHEN p_strategic THEN p_dimension_id ELSE NULL END,
      calculation_type = p_calculation_type,
      simple_formula = coalesce(btrim(p_simple_formula), ''),
      result_source = coalesce(btrim(p_result_source), ''),
      formula_expression = coalesce(btrim(p_formula_expression), ''),
      formula_tokens = coalesce(p_formula_tokens, '[]'::jsonb),
      decimal_places = p_decimal_places, obsolete = coalesce(p_obsolete, false)
    WHERE id = p_id RETURNING * INTO v_indicator;
  END IF;

  DELETE FROM public.indicator_dependencies WHERE indicator_id = v_indicator.id;
  IF p_calculation_type = 'composite' THEN
    INSERT INTO public.indicator_dependencies(indicator_id, source_indicator_id)
    SELECT v_indicator.id, DISTINCT_SOURCE.id FROM (
      SELECT DISTINCT (t->>'id')::uuid AS id FROM jsonb_array_elements(p_formula_tokens) t
      WHERE t->>'kind' = 'indicator'
    ) AS DISTINCT_SOURCE;
    IF EXISTS (
      WITH RECURSIVE sources(id) AS (
        SELECT source_indicator_id FROM public.indicator_dependencies
          WHERE indicator_id = v_indicator.id
        UNION
        SELECT d.source_indicator_id FROM public.indicator_dependencies d
          JOIN sources s ON d.indicator_id = s.id
      ) SELECT 1 FROM sources WHERE id = v_indicator.id
    ) THEN
      RAISE EXCEPTION 'Composite formula cannot contain a cycle' USING ERRCODE = '22023';
    END IF;
  END IF;

  DELETE FROM public.dimension_links WHERE item_type = 'indicator'
    AND item_id = v_indicator.id AND version_id = v_version_id;
  IF p_strategic THEN
    INSERT INTO public.dimension_links
      (dimension_id, version_id, item_type, item_id, process_id)
    VALUES (p_dimension_id, v_version_id, 'indicator', v_indicator.id, p_process_id);
  END IF;

  IF p_calculation_type = 'composite' AND NOT v_indicator.obsolete THEN
    FOR v_period IN
      SELECT DISTINCT h.period_date FROM public.indicator_history h
      JOIN public.indicator_dependencies d ON d.source_indicator_id = h.indicator_id
      WHERE d.indicator_id = v_indicator.id AND h.period_date IS NOT NULL
      ORDER BY h.period_date
    LOOP
      PERFORM public.refresh_composite_indicator(v_indicator.id, v_period);
    END LOOP;
    SELECT * INTO v_indicator FROM public.indicators WHERE id = v_indicator.id;
  END IF;
  RETURN v_indicator;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.save_indicator_definition(
  uuid,text,text,uuid,uuid,public.indicator_frequency_type,text,boolean,numeric,
  numeric,public.indicator_unit_type,text,boolean,uuid,text,text,text,text,jsonb,
  integer,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_indicator_definition(
  uuid,text,text,uuid,uuid,public.indicator_frequency_type,text,boolean,numeric,
  numeric,public.indicator_unit_type,text,boolean,uuid,text,text,text,text,jsonb,
  integer,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.indicator_result_actors()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, p.name FROM public.profiles p
  WHERE public.get_user_role() IS NOT NULL AND p.id IN (
    SELECT h.created_by FROM public.indicator_history h
    UNION SELECT a.created_by FROM public.indicator_result_analyses a
    UNION SELECT d.changed_by FROM public.indicator_definition_history d
  );
$$;

NOTIFY pgrst, 'reload schema';
