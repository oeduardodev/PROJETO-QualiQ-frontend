-- Keep the SLA criticality field available in environments created from migrations.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'sla_criticality_level'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.sla_criticality_level AS ENUM ('baixa', 'media', 'alta', 'critica');
  END IF;
END $$;

ALTER TABLE public.slas
  ADD COLUMN IF NOT EXISTS criticality public.sla_criticality_level;

CREATE INDEX IF NOT EXISTS idx_slas_criticality ON public.slas (criticality);
