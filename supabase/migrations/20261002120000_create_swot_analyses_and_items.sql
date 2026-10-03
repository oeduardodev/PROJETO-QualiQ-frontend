-- Strategic SWOT analysis: versioned 2x2 panels plus the items behind them.

-- ## Purpose
-- The Strategy module needs an editable SWOT panel. Each analysis keeps its own
-- period/label so revisions of the same exercise can be compared over time.

-- ## New Table: swot_analyses
-- - `id` (uuid, primary key)
-- - `title` (text, not null)
-- - `period` (text, nullable) — free label such as "1º semestre 2026"
-- - `description` (text, nullable) — scope and participants of the workshop
-- - `status` (text, not null) — 'em_construcao' | 'em_revisao' | 'concluida'
-- - `order_index` (int, default 0)
-- - `created_at` / `updated_at` (timestamptz)

-- ## New Table: swot_items
-- - `id` (uuid, primary key)
-- - `analysis_id` (uuid, FK -> swot_analyses ON DELETE CASCADE)
-- - `quadrant` (text, not null) — 'forcas' | 'fraquezas' | 'oportunidades' | 'ameacas'
-- - `title` (text, not null)
-- - `description` (text, nullable)
-- - `order_index` (int, default 0)
-- - `created_at` / `updated_at` (timestamptz)

-- ## Security
-- Read is open to every authenticated role (operators consume the panel); writes
-- follow the same admin/gestor restriction used by the rest of the Strategy module.

CREATE TABLE IF NOT EXISTS swot_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  period text,
  description text,
  status text NOT NULL DEFAULT 'em_construcao'
    CHECK (status IN ('em_construcao', 'em_revisao', 'concluida')),
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE swot_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_swot_analyses_all_roles" ON swot_analyses;
CREATE POLICY "select_swot_analyses_all_roles" ON swot_analyses
  FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "insert_swot_analyses_admin_gestor" ON swot_analyses;
CREATE POLICY "insert_swot_analyses_admin_gestor" ON swot_analyses
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "update_swot_analyses_admin_gestor" ON swot_analyses;
CREATE POLICY "update_swot_analyses_admin_gestor" ON swot_analyses
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_gestor()) WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "delete_swot_analyses_admin_gestor" ON swot_analyses;
CREATE POLICY "delete_swot_analyses_admin_gestor" ON swot_analyses
  FOR DELETE TO authenticated USING (public.is_admin_or_gestor());

CREATE TABLE IF NOT EXISTS swot_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES swot_analyses(id) ON DELETE CASCADE,
  quadrant text NOT NULL
    CHECK (quadrant IN ('forcas', 'fraquezas', 'oportunidades', 'ameacas')),
  title text NOT NULL,
  description text,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE swot_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_swot_items_all_roles" ON swot_items;
CREATE POLICY "select_swot_items_all_roles" ON swot_items
  FOR SELECT TO authenticated USING (public.get_user_role() IS NOT NULL);
DROP POLICY IF EXISTS "insert_swot_items_admin_gestor" ON swot_items;
CREATE POLICY "insert_swot_items_admin_gestor" ON swot_items
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "update_swot_items_admin_gestor" ON swot_items;
CREATE POLICY "update_swot_items_admin_gestor" ON swot_items
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_gestor()) WITH CHECK (public.is_admin_or_gestor());
DROP POLICY IF EXISTS "delete_swot_items_admin_gestor" ON swot_items;
CREATE POLICY "delete_swot_items_admin_gestor" ON swot_items
  FOR DELETE TO authenticated USING (public.is_admin_or_gestor());

CREATE INDEX IF NOT EXISTS idx_swot_analyses_order ON swot_analyses(order_index, id);
CREATE INDEX IF NOT EXISTS idx_swot_items_analysis ON swot_items(analysis_id);
CREATE INDEX IF NOT EXISTS idx_swot_items_quadrant ON swot_items(analysis_id, quadrant);