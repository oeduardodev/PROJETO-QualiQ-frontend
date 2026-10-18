-- Fail closed when the authenticated user has no role profile.
-- Keep role names aligned with the lowercase public.user_role enum.
CREATE OR REPLACE FUNCTION public.save_document_level(p_level integer, p_name text)
RETURNS public.document_levels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '' AS $$
DECLARE saved public.document_levels;
BEGIN
  IF auth.uid() IS NULL
    OR lower(coalesce(public.get_user_role()::text, '')) NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Invalid level name' USING ERRCODE = '22023';
  END IF;
  IF p_level IS NULL THEN
    PERFORM pg_advisory_xact_lock(70116, 1);
    INSERT INTO public.document_levels(level, name)
    SELECT coalesce(max(level), 0) + 1, btrim(p_name) FROM public.document_levels
    RETURNING * INTO saved;
  ELSE
    UPDATE public.document_levels SET name = btrim(p_name)
    WHERE level = p_level RETURNING * INTO saved;
    IF NOT FOUND THEN RAISE EXCEPTION 'Level not found' USING ERRCODE = 'P0002'; END IF;
  END IF;
  RETURN saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_document_type(
  p_type_id uuid, p_name text, p_acronym text, p_level integer,
  p_validity_days integer, p_review_days integer, p_approval_days integer,
  p_publication_days integer, p_print_allowed boolean, p_public_panel boolean,
  p_active boolean, p_justification text
) RETURNS public.document_types
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '' AS $$
DECLARE previous public.document_types; saved public.document_types; action_name text;
BEGIN
  IF auth.uid() IS NULL
    OR lower(coalesce(public.get_user_role()::text, '')) NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 2 AND 100
    OR upper(btrim(coalesce(p_acronym, ''))) !~ '^[A-Z0-9]{2,8}$'
    OR p_level IS NULL OR p_validity_days IS NULL OR p_validity_days <= 0
    OR p_review_days IS NULL OR p_review_days < 0
    OR p_approval_days IS NULL OR p_approval_days < 0
    OR p_publication_days IS NULL OR p_publication_days < 0
    OR p_print_allowed IS NULL OR p_public_panel IS NULL OR p_active IS NULL THEN
    RAISE EXCEPTION 'Invalid document type data' USING ERRCODE = '22023';
  END IF;
  IF p_type_id IS NULL THEN
    IF NOT p_active THEN
      RAISE EXCEPTION 'New document types must start active' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.document_types(name, acronym, hierarchy_level, validity_days,
      sla_review_days, sla_approval_days, sla_publication_days, print_allowed, public_panel, active)
    VALUES (btrim(p_name), upper(btrim(p_acronym)), p_level, p_validity_days,
      p_review_days, p_approval_days, p_publication_days, p_print_allowed, p_public_panel, p_active)
    RETURNING * INTO saved;
    action_name := 'created';
  ELSE
    IF nullif(btrim(coalesce(p_justification, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Justification is required' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO previous FROM public.document_types WHERE id = p_type_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Type not found' USING ERRCODE = 'P0002'; END IF;
    IF previous.acronym <> upper(btrim(p_acronym))
      AND EXISTS (SELECT 1 FROM public.documents WHERE type_id = p_type_id) THEN
      RAISE EXCEPTION 'Acronym cannot change while documents use this type' USING ERRCODE = '22023';
    END IF;
    UPDATE public.document_types SET name = btrim(p_name), acronym = upper(btrim(p_acronym)),
      hierarchy_level = p_level, validity_days = p_validity_days,
      sla_review_days = p_review_days, sla_approval_days = p_approval_days,
      sla_publication_days = p_publication_days, print_allowed = p_print_allowed,
      public_panel = p_public_panel, active = p_active, updated_at = now()
    WHERE id = p_type_id RETURNING * INTO saved;
    action_name := CASE WHEN previous.active AND NOT saved.active THEN 'deactivated'
      WHEN NOT previous.active AND saved.active THEN 'reactivated' ELSE 'updated' END;
  END IF;
  INSERT INTO public.document_type_history(type_id, action, justification, before_data, after_data, changed_by)
  VALUES (saved.id, action_name, nullif(btrim(p_justification), ''),
    CASE WHEN p_type_id IS NULL THEN NULL ELSE to_jsonb(previous) END,
    to_jsonb(saved), auth.uid());
  RETURN saved;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_document_level(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_document_level(integer, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.save_document_type(
  uuid, text, text, integer, integer, integer, integer, integer, boolean, boolean, boolean, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_document_type(
  uuid, text, text, integer, integer, integer, integer, integer, boolean, boolean, boolean, text
) TO authenticated;

NOTIFY pgrst, 'reload schema';
