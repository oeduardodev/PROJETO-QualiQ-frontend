/*
# SIPOC Step Associations + Step-level indicators/tickets

## Problem
The user wants the classic SIPOC 5-column layout (S-I-P-O-C) with P in the middle.
When a P step is selected, only the S/I/O/C items for THAT step should show.
New S/I/O/C items should auto-associate with all P steps of the process.
Indicators and tickets should optionally link to a specific step (P node).

## Changes

### New Table: sipoc_step_associations
Links S/I/O/C nodes to specific P-step nodes.
- `id` (uuid, primary key)
- `step_node_id` (uuid, FK -> sipoc_nodes ON DELETE CASCADE) — the P node
- `associated_node_id` (uuid, FK -> sipoc_nodes ON DELETE CASCADE) — the S/I/O/C node
- `created_at` (timestamptz)
- Unique constraint on (step_node_id, associated_node_id)

### Modified Table: indicators
- Added `step_id` (uuid, nullable, FK -> sipoc_nodes ON DELETE SET NULL)
  When set, the indicator belongs to a specific P step. When null, it's process-level.

### Modified Table: tickets
- Added `step_id` (uuid, nullable, FK -> sipoc_nodes ON DELETE SET NULL)
  When set, the ticket belongs to a specific P step. When null, it's process-level.

### Security
- RLS enabled on sipoc_step_associations with full anon+authenticated CRUD
*/

CREATE TABLE IF NOT EXISTS sipoc_step_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_node_id uuid NOT NULL REFERENCES sipoc_nodes(id) ON DELETE CASCADE,
  associated_node_id uuid NOT NULL REFERENCES sipoc_nodes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (step_node_id, associated_node_id)
);

ALTER TABLE sipoc_step_associations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_step_assoc" ON sipoc_step_associations;
CREATE POLICY "anon_select_step_assoc" ON sipoc_step_associations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_step_assoc" ON sipoc_step_associations;
CREATE POLICY "anon_insert_step_assoc" ON sipoc_step_associations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_step_assoc" ON sipoc_step_associations;
CREATE POLICY "anon_update_step_assoc" ON sipoc_step_associations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_step_assoc" ON sipoc_step_associations;
CREATE POLICY "anon_delete_step_assoc" ON sipoc_step_associations FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_step_assoc_step ON sipoc_step_associations(step_node_id);
CREATE INDEX IF NOT EXISTS idx_step_assoc_node ON sipoc_step_associations(associated_node_id);

-- Add step_id to indicators (nullable, links indicator to a specific P step)
ALTER TABLE indicators ADD COLUMN IF NOT EXISTS step_id uuid REFERENCES sipoc_nodes(id) ON DELETE SET NULL;

-- Add step_id to tickets (nullable, links ticket to a specific P step)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS step_id uuid REFERENCES sipoc_nodes(id) ON DELETE SET NULL;
