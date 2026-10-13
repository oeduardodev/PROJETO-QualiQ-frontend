-- Keep dimension classification options and display labels in Supabase.
CREATE TABLE IF NOT EXISTS public.dimension_classifications (
  classification_key text PRIMARY KEY,
  label text NOT NULL CHECK (length(btrim(label)) > 0),
  icon text NOT NULL DEFAULT 'Workflow',
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dimension_classifications_single_default_idx
  ON public.dimension_classifications (is_default)
  WHERE is_default;

INSERT INTO public.dimension_classifications (
  classification_key, label, icon, order_index, is_default
) VALUES
  ('financeira', 'Financeira', 'TrendingUp', 10, false),
  ('mercado_cliente', 'Mercado e Cliente', 'Users', 20, false),
  ('processos_operacionais', 'Processos Operacionais', 'Workflow', 30, true),
  ('pessoas_cultura', 'Pessoas e Cultura', 'UserCheck', 40, false),
  ('qualidade_seguranca', 'Qualidade e Segurança', 'ShieldCheck', 50, false),
  ('compliance_regulatorio', 'Compliance Regulatório', 'LockKeyhole', 60, false),
  ('infraestrutura_tecnologia', 'Infraestrutura e Tecnologia', 'Cpu', 70, false),
  ('esg_sustentabilidade', 'ESG e Sustentabilidade', 'Activity', 80, false),
  ('inovacao_melhoria', 'Inovação e Melhoria', 'Sparkles', 90, false),
  ('estrategica_governanca', 'Estratégia e Governança', 'Target', 100, false)
ON CONFLICT (classification_key) DO NOTHING;

ALTER TABLE public.dimensions
  DROP CONSTRAINT IF EXISTS dimensions_classification_key_check,
  DROP CONSTRAINT IF EXISTS dimensions_classification_check,
  DROP CONSTRAINT IF EXISTS dimensions_classification_key_fkey;

UPDATE public.dimensions
SET classification_key = CASE classification_key
  WHEN 'clientes' THEN 'mercado_cliente'
  WHEN 'processos_internos' THEN 'processos_operacionais'
  WHEN 'aprendizado_crescimento' THEN 'pessoas_cultura'
  ELSE classification_key
END
WHERE classification_key IN (
  'clientes',
  'processos_internos',
  'aprendizado_crescimento'
);

ALTER TABLE public.dimensions
  ALTER COLUMN classification_key SET DEFAULT 'processos_operacionais',
  ADD CONSTRAINT dimensions_classification_key_fkey
    FOREIGN KEY (classification_key)
    REFERENCES public.dimension_classifications (classification_key)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

ALTER TABLE public.dimension_classifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dimension_classifications_read ON public.dimension_classifications;
CREATE POLICY dimension_classifications_read ON public.dimension_classifications
  FOR SELECT TO authenticated
  USING (public.get_user_role() IS NOT NULL);

GRANT SELECT ON public.dimension_classifications TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.dimension_classifications FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
