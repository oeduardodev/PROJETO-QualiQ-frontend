-- Continuing education: authored courses, ordered tracks, gated assessments and attendance.
UPDATE public.module_catalog SET implemented = true WHERE id = 'education';
INSERT INTO public.establishment_modules (establishment_id, module_id, enabled)
VALUES ('00000000-0000-4000-8000-000000000001', 'education', true)
ON CONFLICT (establishment_id, module_id) DO NOTHING;

UPDATE public.profiles SET module_access = array_append(module_access, 'education')
WHERE role <> 'implantacao' AND NOT ('education' = ANY(module_access));
UPDATE public.custom_roles SET module_access = array_append(module_access, 'education')
WHERE NOT ('education' = ANY(module_access));
UPDATE public.profiles SET edit_access = array_append(edit_access, 'educacao/gerenciamento')
WHERE role IN ('admin','gestor') AND custom_role_id IS NULL
  AND NOT ('educacao/gerenciamento' = ANY(edit_access));

-- Education is available to every active tenant profile when the add-on is enabled.
CREATE OR REPLACE FUNCTION public.user_has_module_access(p_module text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
    AND p.is_active AND p.role <> 'implantacao'
    AND (p_module = 'education' OR p_module = ANY(p.module_access))
    AND public.establishment_has_module(p_module));
$$;

-- The page permission helper maps route keys to add-on module IDs.
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
      WHEN p_page = 'planos-acao' THEN 'action_plans'
      WHEN p_page = 'usuarios' THEN 'users' ELSE p_page END));
$$;

CREATE TABLE public.learning_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL DEFAULT public.current_establishment_id() REFERENCES public.establishments(id),
  kind text NOT NULL CHECK (kind IN ('training','track')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 180),
  description text NOT NULL DEFAULT '',
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  action_plan_id uuid REFERENCES public.action_plans(id) ON DELETE SET NULL,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id,id),
  FOREIGN KEY (establishment_id,owner_id) REFERENCES public.profiles(establishment_id,id),
  FOREIGN KEY (establishment_id,action_plan_id) REFERENCES public.action_plans(establishment_id,id)
);
CREATE INDEX learning_items_owner_idx ON public.learning_items(establishment_id,owner_id);

CREATE TABLE public.learning_track_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL DEFAULT public.current_establishment_id() REFERENCES public.establishments(id),
  track_id uuid NOT NULL,
  training_id uuid NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  UNIQUE (track_id,training_id), UNIQUE (track_id,position),
  FOREIGN KEY (establishment_id,track_id) REFERENCES public.learning_items(establishment_id,id) ON DELETE CASCADE,
  FOREIGN KEY (establishment_id,training_id) REFERENCES public.learning_items(establishment_id,id) ON DELETE CASCADE
);

CREATE TABLE public.learning_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL DEFAULT public.current_establishment_id() REFERENCES public.establishments(id),
  training_id uuid NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 180),
  resource_kind text NOT NULL CHECK (resource_kind IN ('youtube','audio','pdf','link')),
  resource_url text NOT NULL CHECK (resource_url ~* '^https://[^[:space:]]+$'),
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds BETWEEN 0 AND 86400),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (training_id,position), UNIQUE (establishment_id,id),
  FOREIGN KEY (establishment_id,training_id) REFERENCES public.learning_items(establishment_id,id) ON DELETE CASCADE,
  CHECK (resource_kind NOT IN ('youtube','audio') OR duration_seconds > 0)
);

CREATE TABLE public.learning_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL DEFAULT public.current_establishment_id() REFERENCES public.establishments(id),
  stage_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 180),
  cue_seconds integer NOT NULL DEFAULT 0 CHECK (cue_seconds >= 0),
  passing_score integer NOT NULL DEFAULT 70 CHECK (passing_score BETWEEN 1 AND 100),
  position integer NOT NULL CHECK (position > 0),
  UNIQUE (stage_id,position), UNIQUE (establishment_id,id),
  FOREIGN KEY (establishment_id,stage_id) REFERENCES public.learning_stages(establishment_id,id) ON DELETE CASCADE
);

CREATE TABLE public.learning_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL DEFAULT public.current_establishment_id() REFERENCES public.establishments(id),
  quiz_id uuid NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  prompt text NOT NULL CHECK (length(btrim(prompt)) BETWEEN 3 AND 500),
  options text[] NOT NULL CHECK (cardinality(options) BETWEEN 2 AND 6),
  correct_index integer NOT NULL CHECK (correct_index >= 0),
  UNIQUE (quiz_id,position),
  FOREIGN KEY (establishment_id,quiz_id) REFERENCES public.learning_quizzes(establishment_id,id) ON DELETE CASCADE,
  CHECK (correct_index < cardinality(options))
);

CREATE TABLE public.learning_stage_progress (
  establishment_id uuid NOT NULL DEFAULT public.current_establishment_id() REFERENCES public.establishments(id),
  stage_id uuid NOT NULL,
  user_id uuid NOT NULL,
  watched_seconds integer NOT NULL DEFAULT 0,
  access_seconds integer NOT NULL DEFAULT 0,
  quiz_passes uuid[] NOT NULL DEFAULT '{}',
  replay_required boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  last_tick_at timestamptz,
  last_access_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stage_id,user_id),
  FOREIGN KEY (establishment_id,stage_id) REFERENCES public.learning_stages(establishment_id,id) ON DELETE CASCADE,
  FOREIGN KEY (establishment_id,user_id) REFERENCES public.profiles(establishment_id,id)
);
CREATE INDEX learning_progress_user_idx ON public.learning_stage_progress(establishment_id,user_id);

CREATE TABLE public.learning_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL DEFAULT public.current_establishment_id() REFERENCES public.establishments(id),
  quiz_id uuid NOT NULL,
  user_id uuid NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  passed boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (establishment_id,quiz_id) REFERENCES public.learning_quizzes(establishment_id,id) ON DELETE CASCADE,
  FOREIGN KEY (establishment_id,user_id) REFERENCES public.profiles(establishment_id,id)
);
CREATE INDEX learning_attempts_quiz_idx ON public.learning_quiz_attempts(quiz_id,user_id);

CREATE TABLE public.learning_attendance (
  establishment_id uuid NOT NULL DEFAULT public.current_establishment_id() REFERENCES public.establishments(id),
  item_id uuid NOT NULL,
  user_id uuid NOT NULL,
  signed_name text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id,user_id),
  FOREIGN KEY (establishment_id,item_id) REFERENCES public.learning_items(establishment_id,id) ON DELETE CASCADE,
  FOREIGN KEY (establishment_id,user_id) REFERENCES public.profiles(establishment_id,id)
);

CREATE OR REPLACE FUNCTION public.learning_guard_item()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.owner_id<>OLD.owner_id OR NEW.kind<>OLD.kind OR NEW.establishment_id<>OLD.establishment_id) THEN
    RAISE EXCEPTION 'Responsável, tipo e estabelecimento não podem ser alterados';
  END IF;
  IF TG_OP='DELETE' THEN
    IF OLD.kind='training' AND EXISTS (SELECT 1 FROM public.learning_track_courses c
      JOIN public.learning_items track ON track.id=c.track_id WHERE c.training_id=OLD.id AND track.published)
      THEN RAISE EXCEPTION 'Retire o treinamento das trilhas publicadas antes de excluir'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND OLD.kind='training' AND OLD.published AND NOT NEW.published AND EXISTS (
    SELECT 1 FROM public.learning_track_courses c JOIN public.learning_items track ON track.id=c.track_id
      WHERE c.training_id=OLD.id AND track.published) THEN
    RAISE EXCEPTION 'Retire o treinamento das trilhas publicadas antes de despublicar';
  END IF;
  IF NEW.published THEN
    IF NEW.kind='training' THEN
      IF NOT EXISTS (SELECT 1 FROM public.learning_stages WHERE training_id=NEW.id)
        OR EXISTS (SELECT 1 FROM public.learning_quizzes q JOIN public.learning_stages s ON s.id=q.stage_id
          WHERE s.training_id=NEW.id AND NOT EXISTS (SELECT 1 FROM public.learning_questions WHERE quiz_id=q.id))
        THEN RAISE EXCEPTION 'Inclua etapas e questões em todas as avaliações antes de publicar'; END IF;
    ELSIF NOT EXISTS (SELECT 1 FROM public.learning_track_courses WHERE track_id=NEW.id)
      OR EXISTS (SELECT 1 FROM public.learning_track_courses c JOIN public.learning_items training ON training.id=c.training_id
        WHERE c.track_id=NEW.id AND NOT training.published)
      THEN RAISE EXCEPTION 'A trilha precisa conter treinamentos publicados';
    END IF;
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER learning_item_guard BEFORE INSERT OR UPDATE OR DELETE ON public.learning_items
  FOR EACH ROW EXECUTE FUNCTION public.learning_guard_item();

CREATE OR REPLACE FUNCTION public.learning_guard_structure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_item_id uuid; parent_id uuid;
BEGIN
  IF TG_TABLE_NAME='learning_track_courses' THEN
    v_item_id:=CASE WHEN TG_OP='DELETE' THEN OLD.track_id ELSE NEW.track_id END;
  ELSIF TG_TABLE_NAME='learning_stages' THEN
    v_item_id:=CASE WHEN TG_OP='DELETE' THEN OLD.training_id ELSE NEW.training_id END;
  ELSIF TG_TABLE_NAME='learning_quizzes' THEN
    parent_id:=CASE WHEN TG_OP='DELETE' THEN OLD.stage_id ELSE NEW.stage_id END;
    SELECT training_id INTO v_item_id FROM public.learning_stages WHERE id=parent_id;
  ELSE
    parent_id:=CASE WHEN TG_OP='DELETE' THEN OLD.quiz_id ELSE NEW.quiz_id END;
    SELECT s.training_id INTO v_item_id FROM public.learning_quizzes q JOIN public.learning_stages s ON s.id=q.stage_id
      WHERE q.id=parent_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.learning_items WHERE id=v_item_id AND published) THEN
    RAISE EXCEPTION 'Retire a publicação antes de alterar a estrutura';
  END IF;
  IF TG_TABLE_NAME='learning_track_courses' THEN
    IF EXISTS (SELECT 1 FROM public.learning_attendance WHERE item_id=v_item_id) THEN
      RAISE EXCEPTION 'A trilha já possui presenças; crie uma nova versão'; END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.learning_stages s JOIN public.learning_stage_progress p ON p.stage_id=s.id
      WHERE s.training_id=v_item_id) THEN
      RAISE EXCEPTION 'O treinamento já possui participantes; crie uma nova versão'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER learning_track_guard BEFORE INSERT OR UPDATE OR DELETE ON public.learning_track_courses
  FOR EACH ROW EXECUTE FUNCTION public.learning_guard_structure();
CREATE TRIGGER learning_stage_guard BEFORE INSERT OR UPDATE OR DELETE ON public.learning_stages
  FOR EACH ROW EXECUTE FUNCTION public.learning_guard_structure();
CREATE TRIGGER learning_quiz_guard BEFORE INSERT OR UPDATE OR DELETE ON public.learning_quizzes
  FOR EACH ROW EXECUTE FUNCTION public.learning_guard_structure();
CREATE TRIGGER learning_question_guard BEFORE INSERT OR UPDATE OR DELETE ON public.learning_questions
  FOR EACH ROW EXECUTE FUNCTION public.learning_guard_structure();

CREATE OR REPLACE FUNCTION public.learning_validate_structure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE parent_kind text; child_kind text; stage_duration integer; stage_kind text;
BEGIN
  IF TG_TABLE_NAME = 'learning_track_courses' THEN
    SELECT kind INTO parent_kind FROM public.learning_items WHERE id=NEW.track_id;
    SELECT kind INTO child_kind FROM public.learning_items WHERE id=NEW.training_id;
    IF parent_kind <> 'track' OR child_kind <> 'training' THEN RAISE EXCEPTION 'A trilha só pode conter treinamentos'; END IF;
  ELSIF TG_TABLE_NAME = 'learning_stages' THEN
    SELECT kind INTO parent_kind FROM public.learning_items WHERE id=NEW.training_id;
    IF parent_kind <> 'training' THEN RAISE EXCEPTION 'Etapas pertencem a treinamentos'; END IF;
    IF EXISTS (SELECT 1 FROM public.learning_quizzes q WHERE q.stage_id=NEW.id
      AND ((NEW.resource_kind IN ('youtube','audio') AND q.cue_seconds>NEW.duration_seconds)
        OR (NEW.resource_kind IN ('pdf','link') AND q.cue_seconds<>0))) THEN
      RAISE EXCEPTION 'A duração ou tipo do material conflita com uma avaliação';
    END IF;
  ELSIF TG_TABLE_NAME = 'learning_quizzes' THEN
    SELECT resource_kind,duration_seconds INTO stage_kind,stage_duration FROM public.learning_stages WHERE id=NEW.stage_id;
    IF stage_kind IN ('youtube','audio') AND NEW.cue_seconds > stage_duration THEN
      RAISE EXCEPTION 'Ponto de avaliação excede a duração do material';
    END IF;
    IF stage_kind IN ('pdf','link') AND NEW.cue_seconds <> 0 THEN
      RAISE EXCEPTION 'Pontos de avaliação durante o material exigem vídeo ou áudio';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER learning_track_kind BEFORE INSERT OR UPDATE ON public.learning_track_courses FOR EACH ROW EXECUTE FUNCTION public.learning_validate_structure();
CREATE TRIGGER learning_stage_kind BEFORE INSERT OR UPDATE ON public.learning_stages FOR EACH ROW EXECUTE FUNCTION public.learning_validate_structure();
CREATE TRIGGER learning_quiz_cue BEFORE INSERT OR UPDATE ON public.learning_quizzes FOR EACH ROW EXECUTE FUNCTION public.learning_validate_structure();

CREATE OR REPLACE FUNCTION public.learning_author(p_item uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.learning_items i WHERE i.id=p_item
    AND i.establishment_id=public.current_establishment_id()
    AND i.owner_id=auth.uid() AND public.user_can_edit('educacao/gerenciamento'));
$$;
CREATE OR REPLACE FUNCTION public.learning_can_read(p_item uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.user_has_module_access('education') AND EXISTS (
    SELECT 1 FROM public.learning_items i WHERE i.id=p_item
      AND i.establishment_id=public.current_establishment_id()
      AND (i.published OR public.learning_author(i.id)));
$$;
CREATE OR REPLACE FUNCTION public.learning_track_author_of_training(p_training uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.learning_track_courses c WHERE c.training_id=p_training
    AND c.establishment_id=public.current_establishment_id() AND public.learning_author(c.track_id));
$$;
REVOKE ALL ON FUNCTION public.learning_author(uuid),public.learning_can_read(uuid),public.learning_track_author_of_training(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.learning_author(uuid),public.learning_can_read(uuid),public.learning_track_author_of_training(uuid) TO authenticated;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['learning_items','learning_track_courses','learning_stages','learning_quizzes',
    'learning_questions','learning_stage_progress','learning_quiz_attempts','learning_attendance'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY learning_tenant ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (establishment_id=public.current_establishment_id()) WITH CHECK (establishment_id=public.current_establishment_id())',t);
    EXECUTE format('CREATE POLICY learning_module ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.user_has_module_access(''education'')) WITH CHECK (public.user_has_module_access(''education''))',t);
  END LOOP;
END $$;

CREATE POLICY learning_items_read ON public.learning_items FOR SELECT TO authenticated USING (public.learning_can_read(id));
CREATE POLICY learning_items_insert ON public.learning_items FOR INSERT TO authenticated WITH CHECK (
  owner_id=auth.uid() AND public.user_can_edit('educacao/gerenciamento'));
CREATE POLICY learning_items_update ON public.learning_items FOR UPDATE TO authenticated USING (public.learning_author(id)) WITH CHECK (public.learning_author(id));
CREATE POLICY learning_items_delete ON public.learning_items FOR DELETE TO authenticated USING (public.learning_author(id));
CREATE POLICY learning_track_read ON public.learning_track_courses FOR SELECT TO authenticated USING (public.learning_can_read(track_id));
CREATE POLICY learning_track_write ON public.learning_track_courses FOR ALL TO authenticated USING (public.learning_author(track_id)) WITH CHECK (public.learning_author(track_id));
CREATE POLICY learning_stage_read ON public.learning_stages FOR SELECT TO authenticated USING (public.learning_can_read(training_id));
CREATE POLICY learning_stage_write ON public.learning_stages FOR ALL TO authenticated USING (public.learning_author(training_id)) WITH CHECK (public.learning_author(training_id));
CREATE POLICY learning_quiz_read ON public.learning_quizzes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.learning_stages s WHERE s.id=stage_id AND public.learning_can_read(s.training_id)));
CREATE POLICY learning_quiz_write ON public.learning_quizzes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.learning_stages s WHERE s.id=stage_id AND public.learning_author(s.training_id))) WITH CHECK (
  EXISTS (SELECT 1 FROM public.learning_stages s WHERE s.id=stage_id AND public.learning_author(s.training_id)));
CREATE POLICY learning_question_author ON public.learning_questions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.learning_quizzes q JOIN public.learning_stages s ON s.id=q.stage_id
    WHERE q.id=quiz_id AND public.learning_author(s.training_id))) WITH CHECK (
  EXISTS (SELECT 1 FROM public.learning_quizzes q JOIN public.learning_stages s ON s.id=q.stage_id
    WHERE q.id=quiz_id AND public.learning_author(s.training_id)));
CREATE POLICY learning_progress_read ON public.learning_stage_progress FOR SELECT TO authenticated USING (
  user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.learning_stages s WHERE s.id=stage_id
    AND (public.learning_author(s.training_id) OR public.learning_track_author_of_training(s.training_id))));
CREATE POLICY learning_attempt_read ON public.learning_quiz_attempts FOR SELECT TO authenticated USING (
  user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.learning_quizzes q JOIN public.learning_stages s ON s.id=q.stage_id
    WHERE q.id=quiz_id AND (public.learning_author(s.training_id) OR public.learning_track_author_of_training(s.training_id))));
CREATE POLICY learning_attendance_read ON public.learning_attendance FOR SELECT TO authenticated USING (
  user_id=auth.uid() OR public.learning_author(item_id));

REVOKE ALL ON public.learning_items,public.learning_track_courses,public.learning_stages,public.learning_quizzes,
  public.learning_questions,public.learning_stage_progress,public.learning_quiz_attempts,public.learning_attendance FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.learning_items,public.learning_track_courses,public.learning_stages,
  public.learning_quizzes,public.learning_questions TO authenticated;
GRANT SELECT ON public.learning_stage_progress,public.learning_quiz_attempts,public.learning_attendance TO authenticated;

CREATE OR REPLACE FUNCTION public.learning_public_questions(p_quiz uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.learning_quizzes q JOIN public.learning_stages s ON s.id=q.stage_id
    WHERE q.id=p_quiz AND public.learning_can_read(s.training_id)) THEN RAISE EXCEPTION 'Avaliação indisponível' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'prompt',prompt,'options',options) ORDER BY position),'[]'::jsonb)
    INTO result FROM public.learning_questions WHERE quiz_id=p_quiz;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.learning_assert_stage(p_stage uuid)
RETURNS public.learning_stages LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.learning_stages;
BEGIN
  SELECT * INTO s FROM public.learning_stages WHERE id=p_stage;
  IF s.id IS NULL OR NOT public.learning_can_read(s.training_id) OR NOT EXISTS (
    SELECT 1 FROM public.learning_items i WHERE i.id=s.training_id AND i.published)
    THEN RAISE EXCEPTION 'Etapa indisponível' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.learning_stages previous
    WHERE previous.training_id=s.training_id AND previous.position<s.position
      AND NOT EXISTS (SELECT 1 FROM public.learning_stage_progress p
        WHERE p.stage_id=previous.id AND p.user_id=auth.uid() AND p.completed_at IS NOT NULL))
    THEN RAISE EXCEPTION 'Conclua as etapas anteriores'; END IF;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION public.learning_record_access(p_stage uuid,p_seconds integer)
RETURNS public.learning_stage_progress LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.learning_stages; p public.learning_stage_progress; allowed integer;
BEGIN
  s := public.learning_assert_stage(p_stage);
  IF p_seconds < 0 OR p_seconds > 30 THEN RAISE EXCEPTION 'Intervalo de acesso inválido'; END IF;
  INSERT INTO public.learning_stage_progress(establishment_id,stage_id,user_id)
    VALUES (s.establishment_id,s.id,auth.uid()) ON CONFLICT DO NOTHING;
  SELECT * INTO p FROM public.learning_stage_progress WHERE stage_id=s.id AND user_id=auth.uid() FOR UPDATE;
  allowed := least(p_seconds, CASE WHEN p.last_tick_at IS NULL THEN 0
    ELSE greatest(0,floor(extract(epoch FROM clock_timestamp()-p.last_tick_at))::integer) END);
  UPDATE public.learning_stage_progress SET access_seconds=access_seconds+allowed,
    watched_seconds=watched_seconds+CASE WHEN s.resource_kind IN ('youtube','audio') AND completed_at IS NULL THEN allowed ELSE 0 END,
    last_tick_at=clock_timestamp(),last_access_at=clock_timestamp()
    WHERE stage_id=s.id AND user_id=auth.uid() RETURNING * INTO p;
  RETURN p;
END $$;

CREATE OR REPLACE FUNCTION public.learning_submit_quiz(p_quiz uuid,p_answers integer[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.learning_quizzes; s public.learning_stages; p public.learning_stage_progress;
  total integer; correct integer; score integer;
BEGIN
  SELECT * INTO q FROM public.learning_quizzes WHERE id=p_quiz;
  IF q.id IS NULL THEN RAISE EXCEPTION 'Avaliação inexistente'; END IF;
  s := public.learning_assert_stage(q.stage_id);
  SELECT * INTO p FROM public.learning_stage_progress WHERE stage_id=s.id AND user_id=auth.uid() FOR UPDATE;
  IF p.stage_id IS NULL OR p.watched_seconds < q.cue_seconds OR p.completed_at IS NOT NULL
    OR (p.replay_required AND s.resource_kind IN ('youtube','audio') AND p.watched_seconds<s.duration_seconds) THEN
    RAISE EXCEPTION 'Estude o material até o ponto da avaliação'; END IF;
  IF q.id=ANY(p.quiz_passes) THEN RAISE EXCEPTION 'Avaliação já aprovada'; END IF;
  IF EXISTS (SELECT 1 FROM public.learning_quizzes earlier WHERE earlier.stage_id=s.id
    AND earlier.position<q.position AND NOT earlier.id=ANY(p.quiz_passes)) THEN
    RAISE EXCEPTION 'Conclua a avaliação anterior'; END IF;
  SELECT count(*) INTO total FROM public.learning_questions WHERE quiz_id=q.id;
  IF total=0 OR cardinality(p_answers)<>total THEN RAISE EXCEPTION 'Responda todas as questões'; END IF;
  SELECT count(*) INTO correct FROM (
    SELECT correct_index,row_number() OVER (ORDER BY position)::integer AS answer_position
    FROM public.learning_questions WHERE quiz_id=q.id
  ) question WHERE p_answers[question.answer_position]=question.correct_index;
  score := round(100.0*correct/total);
  INSERT INTO public.learning_quiz_attempts(establishment_id,quiz_id,user_id,score,passed)
    VALUES (s.establishment_id,q.id,auth.uid(),score,score>=q.passing_score);
  IF score>=q.passing_score THEN
    UPDATE public.learning_stage_progress SET quiz_passes=array_append(quiz_passes,q.id),replay_required=false
      WHERE stage_id=s.id AND user_id=auth.uid();
  ELSE
    UPDATE public.learning_stage_progress SET quiz_passes='{}',replay_required=true,watched_seconds=0,last_tick_at=clock_timestamp()
      WHERE stage_id=s.id AND user_id=auth.uid();
  END IF;
  RETURN jsonb_build_object('score',score,'passed',score>=q.passing_score,'passing_score',q.passing_score);
END $$;

CREATE OR REPLACE FUNCTION public.learning_complete_stage(p_stage uuid)
RETURNS public.learning_stage_progress LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.learning_stages; p public.learning_stage_progress;
BEGIN
  s := public.learning_assert_stage(p_stage);
  INSERT INTO public.learning_stage_progress(establishment_id,stage_id,user_id)
    VALUES (s.establishment_id,s.id,auth.uid()) ON CONFLICT DO NOTHING;
  SELECT * INTO p FROM public.learning_stage_progress WHERE stage_id=s.id AND user_id=auth.uid() FOR UPDATE;
  IF p.replay_required OR (s.resource_kind IN ('youtube','audio') AND p.watched_seconds<s.duration_seconds)
    OR EXISTS (SELECT 1 FROM public.learning_quizzes q WHERE q.stage_id=s.id AND NOT q.id=ANY(p.quiz_passes))
    THEN RAISE EXCEPTION 'Conclua o material e as avaliações antes de avançar'; END IF;
  UPDATE public.learning_stage_progress SET completed_at=coalesce(completed_at,clock_timestamp()),last_access_at=clock_timestamp()
    WHERE stage_id=s.id AND user_id=auth.uid() RETURNING * INTO p;
  RETURN p;
END $$;

CREATE OR REPLACE FUNCTION public.learning_sign_attendance(p_item uuid,p_name text)
RETURNS public.learning_attendance LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.learning_items; canonical_name text; attendance public.learning_attendance;
BEGIN
  SELECT * INTO i FROM public.learning_items WHERE id=p_item AND published AND public.learning_can_read(id);
  IF i.id IS NULL THEN RAISE EXCEPTION 'Treinamento indisponível' USING ERRCODE='42501'; END IF;
  SELECT name INTO canonical_name FROM public.profiles WHERE id=auth.uid();
  IF lower(btrim(p_name))<>lower(btrim(canonical_name)) THEN RAISE EXCEPTION 'Digite seu nome completo cadastrado para assinar'; END IF;
  IF i.kind='training' THEN
    IF NOT EXISTS (SELECT 1 FROM public.learning_stages WHERE training_id=i.id)
      OR EXISTS (SELECT 1 FROM public.learning_stages s WHERE s.training_id=i.id AND NOT EXISTS (
        SELECT 1 FROM public.learning_stage_progress p WHERE p.stage_id=s.id AND p.user_id=auth.uid() AND p.completed_at IS NOT NULL))
      THEN RAISE EXCEPTION 'Conclua todas as etapas antes de assinar'; END IF;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.learning_track_courses WHERE track_id=i.id)
      OR EXISTS (SELECT 1 FROM public.learning_track_courses c WHERE c.track_id=i.id AND NOT EXISTS (
        SELECT 1 FROM public.learning_attendance a WHERE a.item_id=c.training_id AND a.user_id=auth.uid()))
      THEN RAISE EXCEPTION 'Conclua todos os treinamentos da trilha antes de assinar'; END IF;
  END IF;
  INSERT INTO public.learning_attendance(establishment_id,item_id,user_id,signed_name)
    VALUES (i.establishment_id,i.id,auth.uid(),btrim(p_name)) ON CONFLICT (item_id,user_id) DO NOTHING;
  SELECT * INTO attendance FROM public.learning_attendance WHERE item_id=i.id AND user_id=auth.uid();
  RETURN attendance;
END $$;

REVOKE ALL ON FUNCTION public.learning_public_questions(uuid),public.learning_assert_stage(uuid),
  public.learning_record_access(uuid,integer),public.learning_submit_quiz(uuid,integer[]),
  public.learning_complete_stage(uuid),public.learning_sign_attendance(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.learning_public_questions(uuid),public.learning_record_access(uuid,integer),
  public.learning_submit_quiz(uuid,integer[]),public.learning_complete_stage(uuid),
  public.learning_sign_attendance(uuid,text) TO authenticated;
