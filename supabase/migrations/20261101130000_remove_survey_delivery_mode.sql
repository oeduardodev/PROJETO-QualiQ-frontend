-- A survey URL can be shared through any channel. Keep each existing link and its responses.
CREATE OR REPLACE FUNCTION public.validate_survey_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
      NEW.process_id IS DISTINCT FROM OLD.process_id OR NEW.token IS DISTINCT FROM OLD.token) THEN
    RAISE EXCEPTION 'Contexto do link é imutável';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.read_public_survey(p_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object('title', s.title, 'description', s.description,
    'process', p.title, 'questions', s.questions)
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

DROP INDEX public.survey_links_context_unique;
ALTER TABLE public.survey_links DROP CONSTRAINT survey_links_check;
ALTER TABLE public.survey_links DROP COLUMN delivery_mode;

NOTIFY pgrst, 'reload schema';
