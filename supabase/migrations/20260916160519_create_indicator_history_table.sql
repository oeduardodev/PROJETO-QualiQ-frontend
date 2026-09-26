/*
# Create indicator_history table for real chart data (replaces mock data)

1. New Table
- `indicator_history` — Historical values of indicators for chart rendering
  - `id` (uuid, pk)
  - `indicator_id` (uuid, fk -> indicators, on delete cascade)
  - `period` (text, not null — ex: 'Set 2026', 'Ago 2026')
  - `value` (numeric, not null — recorded value at that period)
  - `goal` (numeric, not null — goal at that period)
  - `created_at` (timestamptz)

2. Indexes
- `idx_indicator_history_indicator` on indicator_history(indicator_id)

3. Security
- RLS enabled, TO anon/authenticated, USING(true)/WITH CHECK(true)

4. Seed
- 6 historical entries for the "Índice de Refugo" indicator
*/

CREATE TABLE IF NOT EXISTS indicator_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id uuid NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  period text NOT NULL,
  value numeric NOT NULL,
  goal numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE indicator_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_indicator_history" ON indicator_history;
CREATE POLICY "anon_select_indicator_history" ON indicator_history FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_indicator_history" ON indicator_history;
CREATE POLICY "anon_insert_indicator_history" ON indicator_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_indicator_history" ON indicator_history;
CREATE POLICY "anon_update_indicator_history" ON indicator_history FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_indicator_history" ON indicator_history;
CREATE POLICY "anon_delete_indicator_history" ON indicator_history FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_indicator_history_indicator ON indicator_history(indicator_id);

-- Seed: 6 historical entries for the first indicator (Índice de Refugo)
INSERT INTO indicator_history (indicator_id, period, value, goal)
SELECT i.id, v.period, v.value, v.goal
FROM indicators i
JOIN (VALUES
  ('Abr', 4.2, 2.0),
  ('Mai', 3.8, 2.0),
  ('Jun', 3.5, 2.0),
  ('Jul', 4.1, 2.0),
  ('Ago', 3.2, 2.0),
  ('Set', 3.5, 2.0)
) AS v(period, value, goal)
ON i.title = 'Índice de Refugo'
ON CONFLICT DO NOTHING;
