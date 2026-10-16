-- Document hierarchy, type rules, audit and process/type sequence codes.
CREATE TABLE public.document_levels (
  level integer PRIMARY KEY CHECK (level > 0),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Preserve levels already referenced by legacy types. New installations start empty.
INSERT INTO public.document_levels (level, name)
SELECT DISTINCT hierarchy_level, CASE hierarchy_level
  WHEN 1 THEN 'Estratégico' WHEN 2 THEN 'Tático'
  WHEN 3 THEN 'Operacional' ELSE 'Registros' END
FROM public.document_types;
ALTER TABLE public.document_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_levels_read ON public.document_levels FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.document_levels FROM PUBLIC, anon, authenticated;

ALTER TABLE public.document_types DROP CONSTRAINT IF EXISTS document_types_hierarchy_level_check;
ALTER TABLE public.document_types
  ADD CONSTRAINT document_types_level_fkey FOREIGN KEY (hierarchy_level)
  REFERENCES public.document_levels(level);
ALTER TABLE public.document_types
  ADD COLUMN acronym text,
  ADD COLUMN validity_days integer NOT NULL DEFAULT 365 CHECK (validity_days > 0),
  ADD COLUMN sla_publication_days integer NOT NULL DEFAULT 0 CHECK (sla_publication_days >= 0),
  ADD COLUMN public_panel boolean NOT NULL DEFAULT true,
  ADD COLUMN active boolean NOT NULL DEFAULT true,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at NULLS LAST, id) AS sequence
  FROM public.document_types
)
UPDATE public.document_types AS t
SET acronym = 'TIP' || lpad(numbered.sequence::text, 3, '0')
FROM numbered WHERE t.id = numbered.id;
ALTER TABLE public.document_types ALTER COLUMN acronym SET NOT NULL;
ALTER TABLE public.document_types
  ADD CONSTRAINT document_types_acronym_format CHECK (acronym ~ '^[A-Z0-9]{2,8}$'),
  ADD CONSTRAINT document_types_review_days_check CHECK (sla_review_days >= 0),
  ADD CONSTRAINT document_types_approval_days_check CHECK (sla_approval_days >= 0);
CREATE UNIQUE INDEX document_types_acronym_unique ON public.document_types(acronym);
DROP POLICY IF EXISTS "insert_document_types" ON public.document_types;
DROP POLICY IF EXISTS "update_document_types" ON public.document_types;
DROP POLICY IF EXISTS "delete_document_types" ON public.document_types;
REVOKE INSERT, UPDATE, DELETE ON public.document_types FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.document_levels, public.document_types TO authenticated;

CREATE TABLE public.document_type_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id uuid NOT NULL REFERENCES public.document_types(id),
  action text NOT NULL CHECK (action IN ('created', 'updated', 'deactivated', 'reactivated')),
  justification text,
  before_data jsonb,
  after_data jsonb NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.document_type_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_type_history_read ON public.document_type_history
  FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.document_type_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.document_type_history TO authenticated;
INSERT INTO public.document_type_history(type_id, action, after_data, changed_at)
SELECT id, 'created', to_jsonb(t), coalesce(created_at, now())
FROM public.document_types AS t;

CREATE FUNCTION public.save_document_level(p_level integer, p_name text)
RETURNS public.document_levels LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE saved public.document_levels;
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'Admin' THEN
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
END $$;
REVOKE EXECUTE ON FUNCTION public.save_document_level(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_document_level(integer, text) TO authenticated;

CREATE FUNCTION public.save_document_type(
  p_type_id uuid, p_name text, p_acronym text, p_level integer,
  p_validity_days integer, p_review_days integer, p_approval_days integer,
  p_publication_days integer, p_print_allowed boolean, p_public_panel boolean,
  p_active boolean, p_justification text
) RETURNS public.document_types LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE previous public.document_types; saved public.document_types; action_name text;
BEGIN
  IF public.get_user_role() IS DISTINCT FROM 'Admin' THEN
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
END $$;
REVOKE EXECUTE ON FUNCTION public.save_document_type(uuid,text,text,integer,integer,integer,integer,integer,boolean,boolean,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_document_type(uuid,text,text,integer,integer,integer,integer,integer,boolean,boolean,boolean,text) TO authenticated;

-- Replace the generic DOC code with process acronym + type acronym + sequence.
DROP TRIGGER assign_module_code ON public.documents;
ALTER TABLE public.documents DROP CONSTRAINT documents_code_format;
ALTER TABLE public.documents ADD COLUMN expires_at date;
ALTER TABLE public.documents ADD COLUMN legacy_code text;
UPDATE public.documents SET legacy_code = code WHERE code IS NOT NULL;
ALTER TABLE public.documents DROP CONSTRAINT document_process_requires_code;
ALTER TABLE public.documents ADD CONSTRAINT document_process_requires_code
  CHECK (process_id IS NULL OR type_id IS NULL OR code IS NOT NULL);
CREATE TABLE public.document_code_counters (
  process_acronym text NOT NULL,
  type_acronym text NOT NULL,
  last_number bigint NOT NULL CHECK (last_number >= 0),
  PRIMARY KEY (process_acronym, type_acronym)
);
REVOKE ALL ON public.document_code_counters FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.assign_document_code() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE process_tag text; type_tag text; next_number bigint;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.process_id IS NOT DISTINCT FROM OLD.process_id
    AND NEW.type_id IS NOT DISTINCT FROM OLD.type_id AND NEW.code IS NOT NULL THEN
    NEW.code := OLD.code;
    RETURN NEW;
  END IF;
  IF NEW.process_id IS NULL OR NEW.type_id IS NULL THEN
    NEW.code := NULL;
    RETURN NEW;
  END IF;
  SELECT split_part(code, '-', 1) INTO process_tag FROM public.processes WHERE id = NEW.process_id;
  SELECT acronym INTO type_tag FROM public.document_types WHERE id = NEW.type_id;
  IF process_tag !~ '^[A-Z]{3}$' OR type_tag IS NULL THEN
    RAISE EXCEPTION 'Process or document type lacks an acronym' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.document_code_counters(process_acronym, type_acronym, last_number)
  VALUES (process_tag, type_tag, 1)
  ON CONFLICT (process_acronym, type_acronym) DO UPDATE
    SET last_number = public.document_code_counters.last_number + 1
  RETURNING last_number INTO next_number;
  NEW.code := process_tag || '.' || type_tag || '.' ||
    lpad(next_number::text, greatest(3, length(next_number::text)), '0');
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.assign_document_code() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER assign_document_code BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_code();
CREATE FUNCTION public.set_document_expiry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE valid_days integer;
BEGIN
  IF NEW.status <> 'publicado' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT validity_days INTO valid_days FROM public.document_types WHERE id = NEW.type_id;
    NEW.expires_at := CURRENT_DATE + valid_days;
  ELSIF OLD.status IS DISTINCT FROM 'publicado' OR OLD.type_id IS DISTINCT FROM NEW.type_id THEN
    SELECT validity_days INTO valid_days FROM public.document_types WHERE id = NEW.type_id;
    NEW.expires_at := CURRENT_DATE + valid_days;
  ELSIF OLD.expires_at IS NULL THEN
    SELECT validity_days INTO valid_days FROM public.document_types WHERE id = NEW.type_id;
    NEW.expires_at := coalesce(OLD.updated_at, OLD.created_at, now())::date + valid_days;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_document_expiry() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER set_document_expiry BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_document_expiry();
ALTER TABLE public.documents ADD CONSTRAINT documents_code_format
  CHECK (code IS NULL OR code ~ '^[A-Z]{3}\.[A-Z0-9]{2,8}\.[0-9]{3,}$');
DO $$ DECLARE row_id uuid; BEGIN
  FOR row_id IN SELECT id FROM public.documents ORDER BY created_at NULLS LAST, id LOOP
    UPDATE public.documents SET code = NULL WHERE id = row_id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.save_document(
  p_document_id uuid, p_expected_status public.document_status,
  p_status public.document_status, p_title text, p_type_id uuid,
  p_process_id uuid, p_drive_link text, p_print_allowed boolean
) RETURNS public.documents LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE saved_document public.documents; selected_type public.document_types;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_gestor() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(p_title), '') IS NULL OR p_status IS NULL OR p_print_allowed IS NULL
    OR p_type_id IS NULL OR p_process_id IS NULL THEN
    RAISE EXCEPTION 'Title, type and process are required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO selected_type FROM public.document_types WHERE id = p_type_id;
  IF NOT FOUND OR NOT selected_type.active THEN
    RAISE EXCEPTION 'Document type is inactive or missing' USING ERRCODE = '22023';
  END IF;
  IF p_document_id IS NULL THEN
    IF p_expected_status IS NOT NULL THEN
      RAISE EXCEPTION 'Unexpected initial status' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.documents(title, type_id, process_id, drive_link, status, owner_id, print_allowed)
    VALUES (btrim(p_title), p_type_id, p_process_id, p_drive_link, p_status, auth.uid(),
      p_print_allowed AND selected_type.print_allowed)
    RETURNING * INTO saved_document;
    INSERT INTO public.document_workflows(document_id, from_status, to_status, changed_by)
    VALUES (saved_document.id, NULL, p_status, auth.uid());
  ELSE
    UPDATE public.documents SET title = btrim(p_title), type_id = p_type_id,
      process_id = p_process_id, drive_link = p_drive_link, status = p_status,
      print_allowed = p_print_allowed AND selected_type.print_allowed, updated_at = now()
    WHERE id = p_document_id AND status = p_expected_status
    RETURNING * INTO saved_document;
    IF NOT FOUND THEN RAISE EXCEPTION 'Document not found or status changed' USING ERRCODE = 'P0002'; END IF;
    IF p_status IS DISTINCT FROM p_expected_status THEN
      INSERT INTO public.document_workflows(document_id, from_status, to_status, changed_by)
      VALUES (p_document_id, p_expected_status, p_status, auth.uid());
    END IF;
  END IF;
  RETURN saved_document;
END $$;

-- A public card and print request must respect the type configuration as well.
DROP POLICY IF EXISTS "insert_controlled_copies" ON public.controlled_copies;
CREATE POLICY insert_controlled_copies ON public.controlled_copies FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'solicitada'
    AND delivery_date IS NULL AND return_date IS NULL
    AND EXISTS (SELECT 1 FROM public.documents AS d
      JOIN public.document_types AS t ON t.id = d.type_id
      WHERE d.id = document_id AND d.status = 'publicado'
        AND d.print_allowed AND t.print_allowed AND t.public_panel));
