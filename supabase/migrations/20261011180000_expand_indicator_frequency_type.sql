-- Add the expanded frequency choices to the existing indicator frequency enum.
ALTER TYPE public.indicator_frequency_type ADD VALUE IF NOT EXISTS 'diario';
ALTER TYPE public.indicator_frequency_type ADD VALUE IF NOT EXISTS 'semanal';
ALTER TYPE public.indicator_frequency_type ADD VALUE IF NOT EXISTS 'quinzenal';
ALTER TYPE public.indicator_frequency_type ADD VALUE IF NOT EXISTS 'mensal';
ALTER TYPE public.indicator_frequency_type ADD VALUE IF NOT EXISTS 'bimestral';
ALTER TYPE public.indicator_frequency_type ADD VALUE IF NOT EXISTS 'trimestral';
ALTER TYPE public.indicator_frequency_type ADD VALUE IF NOT EXISTS 'semestral';
ALTER TYPE public.indicator_frequency_type ADD VALUE IF NOT EXISTS 'anual';
ALTER TYPE public.indicator_frequency_type ADD VALUE IF NOT EXISTS 'por_evento';

-- Expose the enum values and their user-facing labels through Supabase RPC.
CREATE OR REPLACE FUNCTION public.get_indicator_frequency_options()
RETURNS TABLE(value text, label text)
LANGUAGE sql
STABLE
AS $$
  SELECT
    options.value::text,
    CASE options.value::text
      WHEN 'diario' THEN 'Diário'
      WHEN 'semanal' THEN 'Semanal'
      WHEN 'quinzenal' THEN 'Quinzenal'
      WHEN 'mensal' THEN 'Mensal'
      WHEN 'bimestral' THEN 'Bimestral'
      WHEN 'trimestral' THEN 'Trimestral'
      WHEN 'semestral' THEN 'Semestral'
      WHEN 'anual' THEN 'Anual'
      WHEN 'por_evento' THEN 'Por evento'
      ELSE options.value::text
    END
  FROM unnest(enum_range(NULL::public.indicator_frequency_type))
    WITH ORDINALITY AS options(value, sort_order)
  ORDER BY options.sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.get_indicator_frequency_options() TO anon, authenticated;
