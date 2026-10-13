-- Add the new unit choices to the existing enum used by indicators.unit.
-- Preserve existing monetary indicators under the clearer 'moeda_reais' key.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'indicator_unit_type'
      AND e.enumlabel = 'monetario'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'indicator_unit_type'
      AND e.enumlabel = 'moeda_reais'
  ) THEN
    ALTER TYPE public.indicator_unit_type RENAME VALUE 'monetario' TO 'moeda_reais';
  END IF;
END $$;

ALTER TYPE public.indicator_unit_type ADD VALUE IF NOT EXISTS 'percentual';
ALTER TYPE public.indicator_unit_type ADD VALUE IF NOT EXISTS 'numero_absoluto';
ALTER TYPE public.indicator_unit_type ADD VALUE IF NOT EXISTS 'taxa_indice';
ALTER TYPE public.indicator_unit_type ADD VALUE IF NOT EXISTS 'tempo_minutos';
ALTER TYPE public.indicator_unit_type ADD VALUE IF NOT EXISTS 'tempo_horas';
ALTER TYPE public.indicator_unit_type ADD VALUE IF NOT EXISTS 'tempo_dias';
ALTER TYPE public.indicator_unit_type ADD VALUE IF NOT EXISTS 'moeda_reais';
ALTER TYPE public.indicator_unit_type ADD VALUE IF NOT EXISTS 'moeda_outras';
ALTER TYPE public.indicator_unit_type ADD VALUE IF NOT EXISTS 'escala_score';
ALTER TYPE public.indicator_unit_type ADD VALUE IF NOT EXISTS 'peso_massa';
ALTER TYPE public.indicator_unit_type ADD VALUE IF NOT EXISTS 'volume_capacidade';
ALTER TYPE public.indicator_unit_type ADD VALUE IF NOT EXISTS 'comprimento_area';
ALTER TYPE public.indicator_unit_type ADD VALUE IF NOT EXISTS 'binario_booleano';
ALTER TYPE public.indicator_unit_type ADD VALUE IF NOT EXISTS 'outro';

-- Expose the enum and its user-facing labels to the application through Supabase RPC.
CREATE OR REPLACE FUNCTION public.get_indicator_unit_options()
RETURNS TABLE(value text, label text)
LANGUAGE sql
STABLE
AS $$
  SELECT
    options.value::text,
    CASE options.value::text
      WHEN 'percentual' THEN 'Percentual (%)'
      WHEN 'numero_absoluto' THEN 'Número absoluto (un)'
      WHEN 'taxa_indice' THEN 'Taxa / Índice'
      WHEN 'tempo_minutos' THEN 'Tempo (minutos)'
      WHEN 'tempo_horas' THEN 'Tempo (horas)'
      WHEN 'tempo_dias' THEN 'Tempo (dias)'
      WHEN 'moeda_reais' THEN 'Moeda (R$)'
      WHEN 'monetario' THEN 'Moeda (R$)'
      WHEN 'moeda_outras' THEN 'Moeda (outras)'
      WHEN 'escala_score' THEN 'Escala / score'
      WHEN 'peso_massa' THEN 'Peso / Massa'
      WHEN 'volume_capacidade' THEN 'Volume / Capacidade'
      WHEN 'comprimento_area' THEN 'Comprimento / Área'
      WHEN 'binario_booleano' THEN 'Binário / Booleano'
      WHEN 'outro' THEN 'Outro'
      ELSE options.value::text
    END
  FROM unnest(enum_range(NULL::public.indicator_unit_type))
    WITH ORDINALITY AS options(value, sort_order)
  ORDER BY options.sort_order;
$$;

GRANT EXECUTE ON FUNCTION public.get_indicator_unit_options() TO anon, authenticated;
