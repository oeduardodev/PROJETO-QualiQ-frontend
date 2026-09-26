/*
# Create indicators table (KPIs)

1. New Table
- `indicators` — Indicadores-chave de desempenho (KPIs) vinculados a processos
  - `id` (uuid, pk)
  - `title` (text, not null)
  - `process_id` (uuid, fk -> processes, on delete cascade)
  - `goal_value` (numeric, not null — meta a ser atingida)
  - `unit` (text, not null — ex: '%', 'R$', 'Horas')
  - `current_value` (numeric, not null — valor atual)
  - `frequency` (text, not null, check in 'diario','semanal','mensal')
  - `status` (text, not null, check in 'no_alvo','atencao','critico') — computed by app
  - `created_at`, `updated_at`

2. Indexes
- `idx_indicators_process` on indicators(process_id)
- `idx_indicators_status` on indicators(status)

3. Security
- RLS enabled, TO anon/authenticated, USING(true)/WITH CHECK(true) — shared data.

4. Seed
- 4 indicators linked to existing processes by title.
*/

CREATE TABLE IF NOT EXISTS indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  goal_value numeric NOT NULL,
  unit text NOT NULL,
  current_value numeric NOT NULL,
  frequency text NOT NULL DEFAULT 'mensal' CHECK (frequency IN ('diario','semanal','mensal')),
  status text NOT NULL DEFAULT 'no_alvo' CHECK (status IN ('no_alvo','atencao','critico')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE indicators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_indicators" ON indicators;
CREATE POLICY "anon_select_indicators" ON indicators FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_indicators" ON indicators;
CREATE POLICY "anon_insert_indicators" ON indicators FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_indicators" ON indicators;
CREATE POLICY "anon_update_indicators" ON indicators FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_indicators" ON indicators;
CREATE POLICY "anon_delete_indicators" ON indicators FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_indicators_process ON indicators(process_id);
CREATE INDEX IF NOT EXISTS idx_indicators_status ON indicators(status);

DROP TRIGGER IF EXISTS trg_indicators_updated ON indicators;
CREATE TRIGGER trg_indicators_updated BEFORE UPDATE ON indicators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed: 4 indicators linked to existing processes
INSERT INTO indicators (title, process_id, goal_value, unit, current_value, frequency, status)
SELECT v.title, p.id, v.goal_value, v.unit, v.current_value, v.frequency, v.status
FROM processes p
JOIN (VALUES
  ('Índice de Refugo', 'Produção', 2.0, '%', 3.5, 'semanal', 'atencao'),
  ('Tempo de Ciclo Médio', 'Produção', 48.0, 'Horas', 52.0, 'diario', 'atencao'),
  ('Taxa de Conformidade', 'Gestão da Qualidade', 98.0, '%', 96.5, 'mensal', 'atencao'),
  ('Disponibilidade de Equipamentos', 'Manutenção', 95.0, '%', 91.0, 'semanal', 'critico')
) AS v(title, process_title, goal_value, unit, current_value, frequency, status)
ON p.title = v.process_title
ON CONFLICT DO NOTHING;
