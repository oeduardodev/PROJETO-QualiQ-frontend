/*
# Strategic Dimensions — Balanced Scorecard style grouping

## Purpose
The user wants to create Dimensions (e.g. Financeira, Clientes, Processos Internos)
and hang Indicators and Action Plans on them, with the system forcing linkage to
SIPOC processes.

## New Table: dimensions
- `id` (uuid, primary key)
- `name` (text, not null)
- `description` (text, nullable)
- `color_key` (text, not null) — 'blue' | 'green' | 'orange' | 'amber' | 'rose' | 'violet'
- `order_index` (int, default 0)
- `custom_fields` (jsonb, nullable)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

## New Table: dimension_links
Links indicators and action_plans to dimensions AND processes.
- `id` (uuid, primary key)
- `dimension_id` (uuid, FK -> dimensions ON DELETE CASCADE)
- `item_type` (text, not null) — 'indicator' | 'action_plan'
- `item_id` (uuid, not null) — FK to indicators or action_plans (no hard FK since polymorphic)
- `process_id` (uuid, FK -> processes ON DELETE CASCADE, not null) — forces SIPOC linkage
- `created_at` (timestamptz, default now())
- Unique on (dimension_id, item_type, item_id) to prevent duplicates

## Security
- RLS enabled on both tables with full anon+authenticated CRUD (single-tenant shared data)
*/

CREATE TABLE IF NOT EXISTS dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color_key text NOT NULL DEFAULT 'blue',
  order_index int DEFAULT 0,
  custom_fields jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE dimensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_dims" ON dimensions;
CREATE POLICY "anon_select_dims" ON dimensions FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_dims" ON dimensions;
CREATE POLICY "anon_insert_dims" ON dimensions FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_dims" ON dimensions;
CREATE POLICY "anon_update_dims" ON dimensions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_dims" ON dimensions;
CREATE POLICY "anon_delete_dims" ON dimensions FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS dimension_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_id uuid NOT NULL REFERENCES dimensions(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('indicator', 'action_plan')),
  item_id uuid NOT NULL,
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (dimension_id, item_type, item_id)
);

ALTER TABLE dimension_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_dlinks" ON dimension_links;
CREATE POLICY "anon_select_dlinks" ON dimension_links FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_dlinks" ON dimension_links;
CREATE POLICY "anon_insert_dlinks" ON dimension_links FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_dlinks" ON dimension_links;
CREATE POLICY "anon_update_dlinks" ON dimension_links FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_dlinks" ON dimension_links;
CREATE POLICY "anon_delete_dlinks" ON dimension_links FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_dlinks_dim ON dimension_links(dimension_id);
CREATE INDEX IF NOT EXISTS idx_dlinks_item ON dimension_links(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_dlinks_process ON dimension_links(process_id);
