-- Make task completion preservation safe for legacy plans with duplicate task IDs.
DO $$
DECLARE
  definition text;
  fixed_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.save_operation_plan(uuid,timestamp with time zone,jsonb,text)'::regprocedure
  ) INTO definition;

  fixed_definition := replace(
    definition,
    $old$coalesce((SELECT (x->>'completed')::boolean FROM jsonb_array_elements(coalesce(old.tasks,'[]'::jsonb)) x WHERE x->>'id'=value->>'id'),false)$old$,
    $new$coalesce((SELECT bool_or((x->>'completed')::boolean) FROM jsonb_array_elements(coalesce(old.tasks,'[]'::jsonb)) x WHERE x->>'id'=value->>'id'),false)$new$
  );

  IF fixed_definition = definition THEN
    RAISE EXCEPTION 'Could not find task completion lookup in save_operation_plan';
  END IF;

  EXECUTE fixed_definition;
END $$;
