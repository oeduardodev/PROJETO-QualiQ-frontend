-- Risk publication is explicit. Existing records become drafts and need approval.
ALTER TABLE public.risks
  ADD COLUMN approval_state text NOT NULL DEFAULT 'draft'
    CHECK (approval_state IN ('draft', 'pending', 'approved', 'rejected')),
  ADD COLUMN submitted_at timestamptz,
  ADD COLUMN submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN rejection_reason text;

CREATE INDEX risks_approval_state_idx ON public.risks (approval_state);

CREATE FUNCTION public.enforce_risk_approval() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_role text := lower(coalesce(public.get_user_role()::text, ''));
  v_content_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.approval_state := 'draft';
    NEW.submitted_at := NULL;
    NEW.submitted_by := NULL;
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
    NEW.rejection_reason := NULL;
    RETURN NEW;
  END IF;

  v_content_changed := ROW(NEW.code, NEW.title, NEW.description, NEW.process_id,
    NEW.step_id, NEW.probability, NEW.impact, NEW.risk_type, NEW.barriers,
    NEW.status, NEW.owner, NEW.custom_fields)
    IS DISTINCT FROM ROW(OLD.code, OLD.title, OLD.description, OLD.process_id,
    OLD.step_id, OLD.probability, OLD.impact, OLD.risk_type, OLD.barriers,
    OLD.status, OLD.owner, OLD.custom_fields);

  IF NEW.approval_state IS DISTINCT FROM OLD.approval_state THEN
    IF v_content_changed THEN
      RAISE EXCEPTION 'Save risk changes before changing approval state' USING ERRCODE = '22023';
    END IF;
    IF NEW.approval_state = 'pending' AND OLD.approval_state IN ('draft', 'rejected')
      AND v_role IN ('admin', 'gestor') THEN
      NEW.submitted_at := now();
      NEW.submitted_by := auth.uid();
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
      NEW.rejection_reason := NULL;
    ELSIF NEW.approval_state = 'approved' AND OLD.approval_state = 'pending'
      AND v_role = 'admin' THEN
      NEW.approved_at := now();
      NEW.approved_by := auth.uid();
      NEW.rejection_reason := NULL;
    ELSIF NEW.approval_state = 'rejected' AND OLD.approval_state = 'pending'
      AND v_role = 'admin' AND nullif(btrim(NEW.rejection_reason), '') IS NOT NULL THEN
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
      NEW.rejection_reason := btrim(NEW.rejection_reason);
    ELSE
      RAISE EXCEPTION 'Invalid risk approval transition' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF OLD.approval_state = 'pending' AND v_content_changed THEN
      RAISE EXCEPTION 'A pending risk cannot be edited' USING ERRCODE = '22023';
    END IF;
    IF v_content_changed AND OLD.approval_state IN ('approved', 'rejected') THEN
      NEW.approval_state := 'draft';
      NEW.submitted_at := NULL;
      NEW.submitted_by := NULL;
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
      NEW.rejection_reason := NULL;
    ELSE
      NEW.submitted_at := OLD.submitted_at;
      NEW.submitted_by := OLD.submitted_by;
      NEW.approved_at := OLD.approved_at;
      NEW.approved_by := OLD.approved_by;
      NEW.rejection_reason := OLD.rejection_reason;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_risk_approval_before_write
  BEFORE INSERT OR UPDATE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_risk_approval();

DROP POLICY IF EXISTS app_select ON public.risks;
CREATE POLICY app_select ON public.risks FOR SELECT TO authenticated
  USING (lower(public.get_user_role()::text) IN ('admin', 'gestor')
    OR (public.get_user_role() IS NOT NULL AND approval_state = 'approved'));

-- Related records follow the same visibility rule as their parent risk.
DO $$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['risk_factors', 'risk_preventive_actions', 'risk_contingency_plans'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_select ON public.%I', v_table);
    EXECUTE format('CREATE POLICY app_select ON public.%I FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.risks r WHERE r.id = risk_id))', v_table);
  END LOOP;
END $$;

-- The client configures the score intervals used by every matrix cell and legend.
CREATE TABLE public.risk_matrix_classifications (
  min_score integer PRIMARY KEY CHECK (min_score BETWEEN 1 AND 25),
  max_score integer NOT NULL CHECK (max_score BETWEEN min_score AND 25),
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  background_color text NOT NULL CHECK (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  text_color text NOT NULL CHECK (text_color ~ '^#[0-9A-Fa-f]{6}$')
);

INSERT INTO public.risk_matrix_classifications
  (min_score, max_score, label, background_color, text_color) VALUES
  (1, 4, 'Baixo', '#d1fae5', '#047857'),
  (5, 9, 'Moderado', '#fef3c7', '#b45309'),
  (10, 19, 'Alto', '#ffedd5', '#c2410c'),
  (20, 25, 'Crítico', '#ffe4e6', '#be123c');

-- Replace the old hard-coded generated level with the configured label.
ALTER TABLE public.risks DROP COLUMN risk_level;
ALTER TABLE public.risks ADD COLUMN risk_level text;
UPDATE public.risks r SET risk_level = c.label
  FROM public.risk_matrix_classifications c
  WHERE r.risk_score BETWEEN c.min_score AND c.max_score;
ALTER TABLE public.risks ALTER COLUMN risk_level SET NOT NULL;
CREATE INDEX risks_risk_level_idx ON public.risks (risk_level);

CREATE FUNCTION public.set_configured_risk_level() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  SELECT c.label INTO NEW.risk_level
  FROM public.risk_matrix_classifications c
  WHERE NEW.probability * NEW.impact BETWEEN c.min_score AND c.max_score;
  IF NEW.risk_level IS NULL THEN
    RAISE EXCEPTION 'The risk matrix does not classify this score' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER a_set_configured_risk_level
  BEFORE INSERT OR UPDATE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.set_configured_risk_level();

ALTER TABLE public.risk_matrix_classifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_matrix_classifications_read ON public.risk_matrix_classifications
  FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
REVOKE ALL ON public.risk_matrix_classifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.risk_matrix_classifications TO authenticated;

CREATE FUNCTION public.save_risk_matrix_classifications(p_items jsonb)
RETURNS SETOF public.risk_matrix_classifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_item jsonb;
  v_min integer := 1;
  v_max integer;
  v_label text;
  v_background text;
  v_text text;
BEGIN
  IF auth.uid() IS NULL OR lower(coalesce(public.get_user_role()::text, '')) <> 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can configure the risk matrix' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 25 THEN
    RAISE EXCEPTION 'Provide between 1 and 25 classifications' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(71015, 40000);
  DELETE FROM public.risk_matrix_classifications;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_max := (v_item->>'max_score')::integer;
    v_label := btrim(v_item->>'label');
    v_background := v_item->>'background_color';
    v_text := v_item->>'text_color';
    IF v_max IS NULL OR v_max < v_min OR v_max > 25
      OR nullif(v_label, '') IS NULL
      OR v_background IS NULL OR v_background !~ '^#[0-9A-Fa-f]{6}$'
      OR v_text IS NULL OR v_text !~ '^#[0-9A-Fa-f]{6}$' THEN
      RAISE EXCEPTION 'Invalid risk matrix classification' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.risk_matrix_classifications
      (min_score, max_score, label, background_color, text_color)
      VALUES (v_min, v_max, v_label, v_background, v_text);
    v_min := v_max + 1;
  END LOOP;
  IF v_min <> 26 THEN
    RAISE EXCEPTION 'The classifications must cover scores 1 through 25' USING ERRCODE = '22023';
  END IF;
  UPDATE public.risks r SET risk_level = c.label
    FROM public.risk_matrix_classifications c
    WHERE r.risk_score BETWEEN c.min_score AND c.max_score
      AND r.risk_level IS DISTINCT FROM c.label;
  RETURN QUERY SELECT * FROM public.risk_matrix_classifications ORDER BY min_score;
END;
$$;
REVOKE ALL ON FUNCTION public.save_risk_matrix_classifications(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_risk_matrix_classifications(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
