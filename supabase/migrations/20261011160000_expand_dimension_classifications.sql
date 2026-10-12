-- Expand the allowed dimension classification keys and migrate the former BSC values.
ALTER TABLE public.dimensions
  DROP CONSTRAINT IF EXISTS dimensions_classification_key_check,
  DROP CONSTRAINT IF EXISTS dimensions_classification_check;

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
  ALTER COLUMN classification_key
  SET DEFAULT 'processos_operacionais';

ALTER TABLE public.dimensions
  ADD CONSTRAINT dimensions_classification_key_check
  CHECK (classification_key IN (
    'financeira',
    'mercado_cliente',
    'processos_operacionais',
    'pessoas_cultura',
    'qualidade_seguranca',
    'compliance_regulatorio',
    'infraestrutura_tecnologia',
    'esg_sustentabilidade',
    'inovacao_melhoria',
    'estrategica_governanca'
  ));
