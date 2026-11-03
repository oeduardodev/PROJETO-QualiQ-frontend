-- Independent, tenant-scoped form builder with anonymous responses by opaque link.
INSERT INTO public.module_catalog (id, name, is_base, implemented)
VALUES ('form_builder', 'Construção de Formulários', false, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, implemented = true;

INSERT INTO public.establishment_modules (establishment_id, module_id, enabled)
VALUES ('00000000-0000-4000-8000-000000000001', 'form_builder', true)
ON CONFLICT (establishment_id, module_id) DO NOTHING;

UPDATE public.profiles SET module_access = array_append(module_access, 'form_builder')
WHERE role = 'admin' AND custom_role_id IS NULL AND NOT ('form_builder' = ANY(module_access));
UPDATE public.profiles SET edit_access = array_append(edit_access, 'formularios/construcao')
WHERE role = 'admin' AND custom_role_id IS NULL AND NOT ('formularios/construcao' = ANY(edit_access));

CREATE TABLE public.built_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  process_id uuid,
  sector text NOT NULL DEFAULT '' CHECK (length(sector) <= 120),
  accent_color text NOT NULL DEFAULT '#2563eb' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  thank_you_message text NOT NULL DEFAULT 'Obrigado! Sua resposta foi registrada.'
    CHECK (length(btrim(thank_you_message)) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  questions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(questions) = 'array'),
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, id),
  FOREIGN KEY (establishment_id, process_id) REFERENCES public.processes(establishment_id, id)
);

CREATE TABLE public.built_form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id),
  form_id uuid NOT NULL,
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, id),
  FOREIGN KEY (establishment_id, form_id) REFERENCES public.built_forms(establishment_id, id)
);
CREATE INDEX built_form_responses_form_time_idx
  ON public.built_form_responses (establishment_id, form_id, submitted_at DESC);

CREATE FUNCTION public.built_form_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.user_has_module_access('form_builder') AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active
      AND p.role = 'admin' AND p.custom_role_id IS NULL
      AND 'formularios/construcao' = ANY(p.edit_access)
  );
$$;
REVOKE ALL ON FUNCTION public.built_form_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.built_form_is_admin() TO authenticated;

CREATE FUNCTION public.validate_built_form() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE q jsonb; qid text; opts jsonb; opt jsonb; seen text[] := '{}';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.status = 'published' AND NEW.status NOT IN ('published', 'closed'))
      OR (OLD.status = 'closed' AND NEW.status <> 'closed') THEN
      RAISE EXCEPTION 'Transição de estado inválida';
    END IF;
    IF OLD.status <> 'draft' AND (
      NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description OR
      NEW.process_id IS DISTINCT FROM OLD.process_id OR NEW.sector IS DISTINCT FROM OLD.sector OR
      NEW.accent_color IS DISTINCT FROM OLD.accent_color OR
      NEW.thank_you_message IS DISTINCT FROM OLD.thank_you_message OR
      NEW.questions IS DISTINCT FROM OLD.questions OR NEW.token IS DISTINCT FROM OLD.token
    ) THEN RAISE EXCEPTION 'Formulário publicado não pode ser alterado'; END IF;
  ELSE
    NEW.created_by := auth.uid();
  END IF;
  IF jsonb_array_length(NEW.questions) > 60 OR octet_length(NEW.questions::text) > 100000 THEN
    RAISE EXCEPTION 'Limite de perguntas excedido';
  END IF;
  IF NEW.status = 'published' AND jsonb_array_length(NEW.questions) = 0 THEN
    RAISE EXCEPTION 'Adicione pelo menos uma pergunta';
  END IF;
  IF NEW.status = 'published' AND NEW.process_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.processes p WHERE p.id = NEW.process_id
      AND p.establishment_id = NEW.establishment_id AND p.obsolete
  ) THEN RAISE EXCEPTION 'Processo obsoleto não pode ser associado'; END IF;
  FOR q IN SELECT value FROM jsonb_array_elements(NEW.questions) LOOP
    qid := q->>'id';
    IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR qid IS NULL
      OR length(qid) NOT BETWEEN 1 AND 80 OR qid = ANY(seen)
      OR q->>'type' IS NULL OR q->>'type' NOT IN ('short', 'long', 'single', 'multiple', 'rating', 'date')
      OR length(btrim(coalesce(q->>'title', ''))) NOT BETWEEN 3 AND 500
      OR length(coalesce(q->>'description', '')) > 500
      OR jsonb_typeof(q->'required') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(q->'options') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Pergunta inválida ou repetida';
    END IF;
    seen := array_append(seen, qid);
    opts := q->'options';
    IF q->>'type' IN ('single', 'multiple') THEN
      IF jsonb_array_length(opts) NOT BETWEEN 2 AND 30 THEN
        RAISE EXCEPTION 'Informe entre 2 e 30 opções'; END IF;
      IF (SELECT count(DISTINCT value) FROM jsonb_array_elements(opts)) <> jsonb_array_length(opts) THEN
        RAISE EXCEPTION 'Opções repetidas'; END IF;
      FOR opt IN SELECT value FROM jsonb_array_elements(opts) LOOP
        IF jsonb_typeof(opt) IS DISTINCT FROM 'string' OR length(btrim(opt #>> '{}')) NOT BETWEEN 1 AND 120 THEN
          RAISE EXCEPTION 'Opção inválida'; END IF;
      END LOOP;
    ELSIF jsonb_array_length(opts) <> 0 THEN
      RAISE EXCEPTION 'Tipo de pergunta não aceita opções';
    END IF;
  END LOOP;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER validate_built_form BEFORE INSERT OR UPDATE ON public.built_forms
  FOR EACH ROW EXECUTE FUNCTION public.validate_built_form();
REVOKE ALL ON FUNCTION public.validate_built_form() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.built_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.built_form_responses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tenant_row_guard BEFORE INSERT OR UPDATE ON public.built_forms
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_row();
CREATE TRIGGER tenant_row_guard BEFORE INSERT OR UPDATE ON public.built_form_responses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_row();
CREATE TRIGGER auditor_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.built_forms
  FOR EACH ROW EXECUTE FUNCTION public.prevent_auditor_write();
CREATE TRIGGER auditor_write_guard BEFORE INSERT OR UPDATE OR DELETE ON public.built_form_responses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_auditor_write();

CREATE POLICY built_forms_read ON public.built_forms FOR SELECT TO authenticated
  USING (establishment_id = public.current_establishment_id() AND public.user_has_module_access('form_builder'));
CREATE POLICY built_forms_write ON public.built_forms FOR ALL TO authenticated
  USING (establishment_id = public.current_establishment_id() AND public.built_form_is_admin())
  WITH CHECK (establishment_id = public.current_establishment_id() AND public.built_form_is_admin());
CREATE POLICY built_form_responses_read ON public.built_form_responses FOR SELECT TO authenticated
  USING (establishment_id = public.current_establishment_id() AND public.user_has_module_access('form_builder'));
REVOKE ALL ON public.built_forms, public.built_form_responses FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.built_forms TO authenticated;
GRANT SELECT ON public.built_form_responses TO authenticated;

CREATE FUNCTION public.read_public_built_form(p_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'title', f.title, 'description', f.description, 'sector', f.sector,
    'accent_color', f.accent_color, 'thank_you_message', f.thank_you_message,
    'questions', f.questions, 'process', p.title
  ) INTO result FROM public.built_forms f
  JOIN public.establishments e ON e.id = f.establishment_id AND e.status = 'active'
  LEFT JOIN public.processes p ON p.id = f.process_id AND p.establishment_id = f.establishment_id
  WHERE f.token = p_token AND f.status = 'published' AND (p.id IS NULL OR NOT p.obsolete)
    AND EXISTS (SELECT 1 FROM public.establishment_modules m WHERE m.establishment_id = f.establishment_id
      AND m.module_id = 'form_builder' AND m.enabled);
  IF result IS NULL THEN RAISE EXCEPTION 'Link inválido ou formulário encerrado'; END IF;
  RETURN result;
END; $$;

CREATE FUNCTION public.submit_public_built_form(p_token uuid, p_answers jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE f public.built_forms; q jsonb; answer jsonb; choice jsonb; response_id uuid; score numeric;
BEGIN
  SELECT * INTO f FROM public.built_forms WHERE token = p_token FOR SHARE;
  PERFORM public.read_public_built_form(p_token);
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' OR octet_length(p_answers::text) > 30000 THEN
    RAISE EXCEPTION 'Respostas inválidas ou muito extensas';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_answers) k
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(f.questions) q WHERE q->>'id' = k)) THEN
    RAISE EXCEPTION 'Pergunta não encontrada';
  END IF;
  FOR q IN SELECT value FROM jsonb_array_elements(f.questions) LOOP
    answer := p_answers->(q->>'id');
    IF (q->>'required')::boolean AND (answer IS NULL OR answer = 'null'::jsonb OR
      (jsonb_typeof(answer) = 'string' AND length(btrim(answer #>> '{}')) = 0) OR
      (jsonb_typeof(answer) = 'array' AND jsonb_array_length(answer) = 0)) THEN
      RAISE EXCEPTION 'Responda todas as perguntas obrigatórias';
    END IF;
    IF answer IS NULL OR answer = 'null'::jsonb THEN CONTINUE; END IF;
    IF q->>'type' = 'short' OR q->>'type' = 'long' THEN
      IF jsonb_typeof(answer) <> 'string' THEN RAISE EXCEPTION 'Resposta de texto inválida'; END IF;
      IF (q->>'type' = 'short' AND length(answer #>> '{}') > 500)
        OR (q->>'type' = 'long' AND length(answer #>> '{}') > 4000) THEN
        RAISE EXCEPTION 'Resposta de texto inválida';
      END IF;
    ELSIF q->>'type' = 'date' THEN
      IF jsonb_typeof(answer) <> 'string' THEN RAISE EXCEPTION 'Data inválida'; END IF;
      IF (answer #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        OR to_char((answer #>> '{}')::date, 'YYYY-MM-DD') <> (answer #>> '{}') THEN
        RAISE EXCEPTION 'Data inválida';
      END IF;
    ELSIF q->>'type' = 'rating' THEN
      IF jsonb_typeof(answer) <> 'number' THEN RAISE EXCEPTION 'Nota inválida'; END IF;
      score := (answer::text)::numeric;
      IF score <> trunc(score) OR score NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Nota inválida'; END IF;
    ELSIF q->>'type' = 'single' THEN
      IF jsonb_typeof(answer) <> 'string' THEN RAISE EXCEPTION 'Opção inválida'; END IF;
      IF NOT (q->'options' @> jsonb_build_array(answer)) THEN RAISE EXCEPTION 'Opção inválida'; END IF;
    ELSIF q->>'type' = 'multiple' THEN
      IF jsonb_typeof(answer) <> 'array' THEN RAISE EXCEPTION 'Opções inválidas'; END IF;
      IF jsonb_array_length(answer) > jsonb_array_length(q->'options') THEN
        RAISE EXCEPTION 'Opções inválidas';
      END IF;
      IF (SELECT count(DISTINCT value) FROM jsonb_array_elements(answer)) <> jsonb_array_length(answer) THEN
        RAISE EXCEPTION 'Opções repetidas';
      END IF;
      FOR choice IN SELECT value FROM jsonb_array_elements(answer) LOOP
        IF jsonb_typeof(choice) <> 'string' OR NOT (q->'options' @> jsonb_build_array(choice)) THEN
          RAISE EXCEPTION 'Opção inválida';
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  -- The validated token determines the tenant even if a visitor has another session.
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO public.built_form_responses (establishment_id, form_id, answers)
  VALUES (f.establishment_id, f.id, p_answers) RETURNING id INTO response_id;
  RETURN response_id;
END; $$;
REVOKE ALL ON FUNCTION public.read_public_built_form(uuid), public.submit_public_built_form(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_public_built_form(uuid), public.submit_public_built_form(uuid,jsonb) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
