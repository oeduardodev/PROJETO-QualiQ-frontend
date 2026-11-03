-- Remove the color customization and keep the public form response contract in sync.
CREATE OR REPLACE FUNCTION public.read_public_built_form(p_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'title', f.title, 'description', f.description, 'sector', f.sector,
    'thank_you_message', f.thank_you_message, 'questions', f.questions, 'process', p.title
  ) INTO result FROM public.built_forms f
  JOIN public.establishments e ON e.id = f.establishment_id AND e.status = 'active'
  LEFT JOIN public.processes p ON p.id = f.process_id AND p.establishment_id = f.establishment_id
  WHERE f.token = p_token AND f.status = 'published' AND (p.id IS NULL OR NOT p.obsolete)
    AND EXISTS (SELECT 1 FROM public.establishment_modules m WHERE m.establishment_id = f.establishment_id
      AND m.module_id = 'form_builder' AND m.enabled);
  IF result IS NULL THEN RAISE EXCEPTION 'Link inválido ou formulário encerrado'; END IF;
  RETURN result;
END; $$;

ALTER TABLE public.built_forms DROP COLUMN accent_color;
