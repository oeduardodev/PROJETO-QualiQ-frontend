-- Satisfaction surveys, public collection and accountable process review.
UPDATE public.module_catalog SET implemented = true WHERE id = 'surveys';
INSERT INTO public.establishment_modules (establishment_id, module_id, enabled)
VALUES ('00000000-0000-4000-8000-000000000001', 'surveys', true)
ON CONFLICT (establishment_id, module_id) DO NOTHING;
UPDATE public.profiles SET module_access = array_append(module_access, 'surveys')
WHERE role IN ('admin', 'gestor') AND custom_role_id IS NULL
  AND NOT ('surveys' = ANY(module_access));
UPDATE public.profiles SET edit_access = array_append(edit_access, 'pesquisas/parametrizacao')
WHERE role = 'admin' AND custom_role_id IS NULL
  AND NOT ('pesquisas/parametrizacao' = ANY(edit_access));
UPDATE public.profiles SET edit_access = array_append(edit_access, 'pesquisas/painel')
WHERE role IN ('admin', 'gestor') AND custom_role_id IS NULL
  AND NOT ('pesquisas/painel' = ANY(edit_access));

CREATE OR REPLACE FUNCTION public.user_can_edit(p_page text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
    AND p.is_active AND p.role <> 'implantacao' AND p_page = ANY(p.edit_access)
    AND public.establishment_has_module(
      CASE WHEN p_page = 'helpdesk' THEN 'helpdesk'
      WHEN p_page IN ('valor','dimensoes') THEN 'strategy'
      WHEN p_page LIKE 'indicadores/%' THEN 'indicators'
      WHEN p_page LIKE 'processos/slas/%' THEN 'slas'
      WHEN p_page LIKE 'processos/%' THEN 'processes'
      WHEN p_page LIKE 'riscos/%' THEN 'risks'
      WHEN p_page LIKE 'documentos/%' THEN 'documents'
      WHEN p_page LIKE 'incidentes/%' THEN 'incidents'
      WHEN p_page LIKE 'educacao/%' THEN 'education'
      WHEN p_page LIKE 'pesquisas/%' THEN 'surveys'
      WHEN p_page = 'planos-acao' THEN 'action_plans'
      WHEN p_page = 'usuarios' THEN 'users' ELSE p_page END));
$$;

CREATE TABLE public.survey_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id),
  sector text NOT NULL CHECK (length(btrim(sector)) BETWEEN 2 AND 120),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 160),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, id),
  UNIQUE (establishment_id, sector, name)
);

CREATE TABLE public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  process_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  questions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(questions) = 'array'),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, id),
  FOREIGN KEY (establishment_id, process_id) REFERENCES public.processes(establishment_id, id)
);

CREATE TABLE public.survey_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id),
  survey_id uuid NOT NULL,
  process_id uuid,
  delivery_mode text CHECK (delivery_mode IS NULL OR length(btrim(delivery_mode)) BETWEEN 2 AND 100),
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, id),
  FOREIGN KEY (establishment_id, survey_id) REFERENCES public.surveys(establishment_id, id) ON DELETE CASCADE,
  FOREIGN KEY (establishment_id, process_id) REFERENCES public.processes(establishment_id, id),
  CHECK (process_id IS NOT NULL OR delivery_mode IS NOT NULL)
);
CREATE UNIQUE INDEX survey_links_context_unique ON public.survey_links
  (survey_id, process_id, delivery_mode) NULLS NOT DISTINCT;

CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id),
  survey_id uuid NOT NULL,
  link_id uuid NOT NULL,
  process_id uuid,
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  sentiment text CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_summary text,
  sentiment_alignment text CHECK (sentiment_alignment IN ('aligned', 'divergent', 'inconclusive')),
  sentiment_analyzed_at timestamptz,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'reviewed')),
  critical_analysis text,
  action_taken text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  UNIQUE (establishment_id, id),
  FOREIGN KEY (establishment_id, survey_id) REFERENCES public.surveys(establishment_id, id),
  FOREIGN KEY (establishment_id, link_id) REFERENCES public.survey_links(establishment_id, id),
  FOREIGN KEY (establishment_id, process_id) REFERENCES public.processes(establishment_id, id)
);
CREATE INDEX survey_responses_survey_time_idx ON public.survey_responses (establishment_id, survey_id, submitted_at DESC);
CREATE INDEX survey_responses_pending_idx ON public.survey_responses (establishment_id, process_id, submitted_at DESC) WHERE review_status = 'pending';

CREATE FUNCTION public.survey_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.user_has_module_access('surveys') AND public.get_user_role() = 'admin'
    AND public.user_can_edit('pesquisas/parametrizacao');
$$;
CREATE FUNCTION public.survey_can_review(p_process uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.user_has_module_access('surveys') AND public.user_can_edit('pesquisas/painel')
    AND (public.survey_is_admin() OR EXISTS (
      SELECT 1 FROM public.processes p WHERE p.id = p_process
        AND p.establishment_id = public.current_establishment_id() AND p.owner_id = auth.uid()
    ));
$$;
REVOKE ALL ON FUNCTION public.survey_is_admin(), public.survey_can_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.survey_is_admin(), public.survey_can_review(uuid) TO authenticated;

CREATE FUNCTION public.validate_survey() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE q jsonb; qid text; seen text[] := '{}';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.status = 'published' AND NEW.status NOT IN ('published', 'closed')) OR
       (OLD.status = 'closed' AND NEW.status <> 'closed') THEN
      RAISE EXCEPTION 'Transição de estado da pesquisa inválida';
    END IF;
    IF OLD.status <> 'draft' AND (NEW.questions IS DISTINCT FROM OLD.questions OR
        NEW.process_id IS DISTINCT FROM OLD.process_id OR NEW.title IS DISTINCT FROM OLD.title OR
        NEW.description IS DISTINCT FROM OLD.description) THEN
      RAISE EXCEPTION 'Questionário publicado não pode ser alterado';
    END IF;
  ELSE
    NEW.created_by := auth.uid();
  END IF;
  IF jsonb_array_length(NEW.questions) > 50 OR octet_length(NEW.questions::text) > 100000 THEN
    RAISE EXCEPTION 'Limite do questionário excedido'; END IF;
  FOR q IN SELECT value FROM jsonb_array_elements(NEW.questions) LOOP
    qid := q->>'id';
    IF jsonb_typeof(q) <> 'object' OR qid IS NULL OR length(qid) NOT BETWEEN 1 AND 80
      OR qid = ANY(seen) OR q->>'type' IS NULL OR q->>'type' NOT IN ('likert', 'nps', 'text')
      OR length(btrim(coalesce(q->>'prompt', ''))) NOT BETWEEN 3 AND 500
      OR jsonb_typeof(q->'required') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Pergunta inválida ou repetida';
    END IF;
    seen := array_append(seen, qid);
    IF nullif(q->>'criterion_id', '') IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.survey_criteria c WHERE c.id = (q->>'criterion_id')::uuid
        AND c.establishment_id = NEW.establishment_id
    ) THEN RAISE EXCEPTION 'Critério de outro estabelecimento'; END IF;
  END LOOP;
  IF NEW.status = 'published' AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.questions) x WHERE x->>'type' IN ('likert', 'nps')
  ) THEN RAISE EXCEPTION 'Inclua ao menos uma pergunta Likert ou NPS'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER validate_survey BEFORE INSERT OR UPDATE ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION public.validate_survey();
REVOKE ALL ON FUNCTION public.validate_survey() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.validate_survey_link() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE survey_process uuid; survey_status text;
BEGIN
  SELECT process_id, status INTO survey_process, survey_status FROM public.surveys
    WHERE id = NEW.survey_id AND establishment_id = NEW.establishment_id;
  IF TG_OP = 'INSERT' AND survey_status <> 'published' THEN
    RAISE EXCEPTION 'Publique a pesquisa antes de criar links'; END IF;
  IF survey_process IS NOT NULL AND NEW.process_id IS DISTINCT FROM survey_process THEN
    RAISE EXCEPTION 'O link deve usar o processo da pesquisa';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.survey_id IS DISTINCT FROM OLD.survey_id OR
      NEW.process_id IS DISTINCT FROM OLD.process_id OR NEW.delivery_mode IS DISTINCT FROM OLD.delivery_mode OR
      NEW.token IS DISTINCT FROM OLD.token) THEN
    RAISE EXCEPTION 'Contexto do link é imutável';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER validate_survey_link BEFORE INSERT OR UPDATE ON public.survey_links
  FOR EACH ROW EXECUTE FUNCTION public.validate_survey_link();
REVOKE ALL ON FUNCTION public.validate_survey_link() FROM PUBLIC, anon, authenticated;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['survey_criteria', 'surveys', 'survey_links', 'survey_responses'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE TRIGGER tenant_row_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_row()', t);
  END LOOP;
END; $$;
CREATE POLICY survey_criteria_read ON public.survey_criteria FOR SELECT TO authenticated
  USING (establishment_id = public.current_establishment_id() AND public.user_has_module_access('surveys'));
CREATE POLICY survey_criteria_write ON public.survey_criteria FOR ALL TO authenticated
  USING (establishment_id = public.current_establishment_id() AND public.survey_is_admin())
  WITH CHECK (establishment_id = public.current_establishment_id() AND public.survey_is_admin());
CREATE POLICY surveys_read ON public.surveys FOR SELECT TO authenticated
  USING (establishment_id = public.current_establishment_id() AND public.user_has_module_access('surveys'));
CREATE POLICY surveys_write ON public.surveys FOR ALL TO authenticated
  USING (establishment_id = public.current_establishment_id() AND public.survey_is_admin())
  WITH CHECK (establishment_id = public.current_establishment_id() AND public.survey_is_admin());
CREATE POLICY survey_links_read ON public.survey_links FOR SELECT TO authenticated
  USING (establishment_id = public.current_establishment_id() AND public.user_has_module_access('surveys'));
CREATE POLICY survey_links_write ON public.survey_links FOR ALL TO authenticated
  USING (establishment_id = public.current_establishment_id() AND public.survey_is_admin())
  WITH CHECK (establishment_id = public.current_establishment_id() AND public.survey_is_admin());
CREATE POLICY survey_responses_read ON public.survey_responses FOR SELECT TO authenticated
  USING (establishment_id = public.current_establishment_id() AND public.survey_can_review(process_id));
REVOKE ALL ON public.survey_criteria, public.surveys, public.survey_links, public.survey_responses FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_criteria, public.surveys, public.survey_links TO authenticated;
GRANT SELECT ON public.survey_responses TO authenticated;

CREATE FUNCTION public.read_public_survey(p_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object('title', s.title, 'description', s.description,
    'process', p.title, 'delivery_mode', l.delivery_mode, 'questions', s.questions)
  INTO result FROM public.survey_links l
  JOIN public.surveys s ON s.id = l.survey_id AND s.establishment_id = l.establishment_id
  JOIN public.establishments e ON e.id = l.establishment_id AND e.status = 'active'
  LEFT JOIN public.processes p ON p.id = coalesce(l.process_id, s.process_id)
    AND p.establishment_id = l.establishment_id
  WHERE l.token = p_token AND l.active AND s.status = 'published'
    AND (p.id IS NULL OR NOT p.obsolete);
  IF result IS NULL THEN RAISE EXCEPTION 'Link inválido ou pesquisa encerrada'; END IF;
  RETURN result;
END; $$;

CREATE FUNCTION public.submit_public_survey(p_token uuid, p_answers jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE l public.survey_links; s public.surveys; q jsonb; answer jsonb; score numeric; response_id uuid;
BEGIN
  SELECT * INTO l FROM public.survey_links WHERE token = p_token FOR SHARE;
  PERFORM public.read_public_survey(p_token);
  SELECT * INTO s FROM public.surveys WHERE id = l.survey_id AND establishment_id = l.establishment_id;
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' OR octet_length(p_answers::text) > 30000 THEN
    RAISE EXCEPTION 'Respostas inválidas ou muito extensas';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_answers) k
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s.questions) q WHERE q->>'id' = k)) THEN
    RAISE EXCEPTION 'Pergunta não encontrada';
  END IF;
  FOR q IN SELECT value FROM jsonb_array_elements(s.questions) LOOP
    answer := p_answers->(q->>'id');
    IF coalesce((q->>'required')::boolean, false) AND
      (answer IS NULL OR answer = 'null'::jsonb OR length(btrim(answer #>> '{}')) = 0) THEN
      RAISE EXCEPTION 'Responda todas as perguntas obrigatórias';
    END IF;
    IF answer IS NULL OR answer = 'null'::jsonb THEN CONTINUE; END IF;
    IF q->>'type' = 'text' THEN
      IF jsonb_typeof(answer) <> 'string' OR length(btrim(answer #>> '{}')) > 4000 THEN
        RAISE EXCEPTION 'Resposta aberta inválida'; END IF;
    ELSE
      IF jsonb_typeof(answer) <> 'number' THEN
        RAISE EXCEPTION 'Nota fora da escala';
      END IF;
      score := (answer::text)::numeric;
      IF score <> trunc(score)
        OR (q->>'type' = 'nps' AND (score < 0 OR score > 10))
        OR (q->>'type' = 'likert' AND (score < 1 OR score > 5)) THEN
        RAISE EXCEPTION 'Nota fora da escala';
      END IF;
    END IF;
  END LOOP;
  -- A public link can be opened by a visitor who is signed in to a different
  -- establishment. Treat this submission as anonymous for shared tenant guards
  -- and inbox triggers; the token already determines the validated tenant.
  PERFORM set_config('request.jwt.claim.sub', '', true);
  INSERT INTO public.survey_responses (establishment_id, survey_id, link_id, process_id, answers)
  VALUES (l.establishment_id, l.survey_id, l.id, coalesce(l.process_id, s.process_id), p_answers)
  RETURNING id INTO response_id;
  RETURN response_id;
END; $$;

CREATE FUNCTION public.review_survey_response(p_id uuid, p_analysis text, p_action text)
RETURNS public.survey_responses LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result public.survey_responses;
BEGIN
  IF length(btrim(coalesce(p_analysis, ''))) NOT BETWEEN 10 AND 4000
    OR length(btrim(coalesce(p_action, ''))) NOT BETWEEN 3 AND 4000 THEN
    RAISE EXCEPTION 'Informe a análise crítica e a ação tomada';
  END IF;
  UPDATE public.survey_responses SET review_status = 'reviewed',
    critical_analysis = btrim(p_analysis), action_taken = btrim(p_action),
    reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_id AND establishment_id = public.current_establishment_id()
    AND public.survey_can_review(process_id)
  RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Resposta não disponível para revisão'; END IF;
  RETURN result;
END; $$;

CREATE FUNCTION public.notify_survey_response() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE recipient uuid; survey_title text;
BEGIN
  SELECT p.owner_id INTO recipient FROM public.processes p
    WHERE p.id = NEW.process_id AND p.establishment_id = NEW.establishment_id;
  SELECT title INTO survey_title FROM public.surveys WHERE id = NEW.survey_id;
  IF recipient IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles pr
    WHERE pr.id = recipient AND pr.establishment_id = NEW.establishment_id AND pr.is_active) THEN
    INSERT INTO public.operation_inbox
      (establishment_id, user_id, event_type, title, route, record_id)
    VALUES (NEW.establishment_id, recipient, 'review',
      'Nova resposta de pesquisa: ' || survey_title, '/pesquisas/painel', NEW.id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER notify_survey_response AFTER INSERT ON public.survey_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_survey_response();
REVOKE ALL ON FUNCTION public.notify_survey_response() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_public_survey(uuid), public.submit_public_survey(uuid,jsonb),
  public.review_survey_response(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_public_survey(uuid), public.submit_public_survey(uuid,jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_survey_response(uuid,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
