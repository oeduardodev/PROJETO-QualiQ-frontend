/*
# Create risk management tables (Gestão de Riscos)

1. New Tables
- `risks` — Registro principal de riscos vinculados a processos do SIPOC
  - `id` (uuid, primary key)
  - `title` (text, not null — nome/descrição curta do risco)
  - `description` (text, nullable — descrição detalhada)
  - `process_id` (uuid, foreign key -> processes, on delete cascade — processo do SIPOC)
  - `step_id` (uuid, nullable, foreign key -> sipoc_nodes — subprocesso/etapa específica)
  - `probability` (int, not null, 1-5 — probabilidade de ocorrência, estilo FMEA)
  - `impact` (int, not null, 1-5 — impacto/severidade do risco, estilo FMEA)
  - `risk_score` (int, generated — probability * impact, calculado automaticamente)
  - `risk_level` (text, generated — 'baixo' | 'moderado' | 'alto' | 'critico' baseado no score)
  - `status` (text, not null, default 'identificado' — 'identificado' | 'em_analise' | 'tratado' | 'monitorado')
  - `owner` (text, nullable — responsável pelo risco)
  - `custom_fields` (jsonb, default '{}' — campos adicionais)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

- `risk_factors` — Fatores de risco levantados para cada risco
  - `id` (uuid, primary key)
  - `risk_id` (uuid, foreign key -> risks, on delete cascade)
  - `description` (text, not null — descrição do fator de risco)
  - `category` (text, nullable — categoria do fator, ex: humano, técnico, externo, operacional)
  - `created_at` (timestamptz)

- `risk_preventive_actions` — Ações preventivas para mitigar fatores de risco
  - `id` (uuid, primary key)
  - `risk_id` (uuid, foreign key -> risks, on delete cascade)
  - `factor_id` (uuid, nullable, foreign key -> risk_factors — fator específico que a ação previne)
  - `description` (text, not null — descrição da ação preventiva)
  - `responsible` (text, nullable — responsável pela execução)
  - `status` (text, not null, default 'pendente' — 'pendente' | 'em_andamento' | 'concluida')
  - `created_at` (timestamptz)

- `risk_contingency_plans` — Planos de contingência se o risco se materializar
  - `id` (uuid, primary key)
  - `risk_id` (uuid, foreign key -> risks, on delete cascade)
  - `description` (text, not null — plano de contingência/resposta)
  - `trigger` (text, nullable — gatilho que ativa o plano)
  - `responsible` (text, nullable — responsável pela ativação)
  - `estimated_cost` (text, nullable — custo estimado)
  - `status` (text, not null, default 'ativo' — 'ativo' | 'inativo')
  - `created_at` (timestamptz)

2. Indexes
- `idx_risks_process` on risks(process_id)
- `idx_risks_status` on risks(status)
- `idx_risks_risk_level` on risks(risk_level)
- `idx_risk_factors_risk` on risk_factors(risk_id)
- `idx_risk_preventive_risk` on risk_preventive_actions(risk_id)
- `idx_risk_contingency_risk` on risk_contingency_plans(risk_id)

3. Security
- RLS enabled on all 4 tables.
- Single-tenant (no auth): policies use TO anon, authenticated with USING(true) / WITH CHECK(true).

4. Notes
- risk_score and risk_level are GENERATED ALWAYS columns computed from probability * impact.
- Score ranges: 1-4 = baixo, 5-9 = moderado, 10-15 = alto, 16-25 = critico.
- step_id links to sipoc_nodes (subprocesso), allowing risk mapping at subprocess level.
*/

CREATE TABLE IF NOT EXISTS risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  step_id uuid REFERENCES sipoc_nodes(id) ON DELETE SET NULL,
  probability int NOT NULL DEFAULT 3 CHECK (probability >= 1 AND probability <= 5),
  impact int NOT NULL DEFAULT 3 CHECK (impact >= 1 AND impact <= 5),
  risk_score int GENERATED ALWAYS AS (probability * impact) STORED,
  risk_level text GENERATED ALWAYS AS (
    CASE
      WHEN probability * impact <= 4 THEN 'baixo'
      WHEN probability * impact <= 9 THEN 'moderado'
      WHEN probability * impact <= 15 THEN 'alto'
      ELSE 'critico'
    END
  ) STORED,
  status text NOT NULL DEFAULT 'identificado' CHECK (status IN ('identificado', 'em_analise', 'tratado', 'monitorado')),
  owner text,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE risks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_risks" ON risks;
CREATE POLICY "anon_select_risks" ON risks FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_risks" ON risks;
CREATE POLICY "anon_insert_risks" ON risks FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_risks" ON risks;
CREATE POLICY "anon_update_risks" ON risks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_risks" ON risks;
CREATE POLICY "anon_delete_risks" ON risks FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_risks_process ON risks(process_id);
CREATE INDEX IF NOT EXISTS idx_risks_status ON risks(status);
CREATE INDEX IF NOT EXISTS idx_risks_risk_level ON risks(risk_level);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_risks_updated ON risks;
CREATE TRIGGER trg_risks_updated BEFORE UPDATE ON risks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- risk_factors
CREATE TABLE IF NOT EXISTS risk_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id uuid NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  description text NOT NULL,
  category text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE risk_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_risk_factors" ON risk_factors;
CREATE POLICY "anon_select_risk_factors" ON risk_factors FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_risk_factors" ON risk_factors;
CREATE POLICY "anon_insert_risk_factors" ON risk_factors FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_risk_factors" ON risk_factors;
CREATE POLICY "anon_update_risk_factors" ON risk_factors FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_risk_factors" ON risk_factors;
CREATE POLICY "anon_delete_risk_factors" ON risk_factors FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_risk_factors_risk ON risk_factors(risk_id);

-- risk_preventive_actions
CREATE TABLE IF NOT EXISTS risk_preventive_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id uuid NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  factor_id uuid REFERENCES risk_factors(id) ON DELETE SET NULL,
  description text NOT NULL,
  responsible text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE risk_preventive_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_risk_preventive" ON risk_preventive_actions;
CREATE POLICY "anon_select_risk_preventive" ON risk_preventive_actions FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_risk_preventive" ON risk_preventive_actions;
CREATE POLICY "anon_insert_risk_preventive" ON risk_preventive_actions FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_risk_preventive" ON risk_preventive_actions;
CREATE POLICY "anon_update_risk_preventive" ON risk_preventive_actions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_risk_preventive" ON risk_preventive_actions;
CREATE POLICY "anon_delete_risk_preventive" ON risk_preventive_actions FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_risk_preventive_risk ON risk_preventive_actions(risk_id);

-- risk_contingency_plans
CREATE TABLE IF NOT EXISTS risk_contingency_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id uuid NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  description text NOT NULL,
  trigger text,
  responsible text,
  estimated_cost text,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE risk_contingency_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_risk_contingency" ON risk_contingency_plans;
CREATE POLICY "anon_select_risk_contingency" ON risk_contingency_plans FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_risk_contingency" ON risk_contingency_plans;
CREATE POLICY "anon_insert_risk_contingency" ON risk_contingency_plans FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_risk_contingency" ON risk_contingency_plans;
CREATE POLICY "anon_update_risk_contingency" ON risk_contingency_plans FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_risk_contingency" ON risk_contingency_plans;
CREATE POLICY "anon_delete_risk_contingency" ON risk_contingency_plans FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_risk_contingency_risk ON risk_contingency_plans(risk_id);
