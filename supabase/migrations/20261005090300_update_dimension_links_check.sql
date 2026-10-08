-- Allow dimension_links to reference the new strategic analysis types
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE t.relname = 'dimension_links'
    AND n.nspname = 'public'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%item_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.dimension_links DROP CONSTRAINT %I', constraint_name);
  END IF;
END
$$;
ALTER TABLE public.dimension_links
  ADD CONSTRAINT dimension_links_item_type_check
  CHECK (item_type IN (
    'indicator',
    'action_plan',
    'swot_analysis',
    'pestel_analysis',
    'porter_five_forces_analysis',
    'environmental_analysis'
  ));
