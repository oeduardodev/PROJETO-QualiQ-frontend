/*
# SIPOC Node Associations — Shared S/I/O/C nodes across processes

## Problem
Currently each sipoc_node is hard-linked to a single process via `process_id NOT NULL`.
This means if "Ordem de Produção" is an input to 3 different processes, it must be
duplicated 3 times — one per process. The user wants to create a node once and
associate it with multiple processes.

## Solution
1. Make `sipoc_nodes.process_id` nullable — P-type nodes stay bound to one process
   (they ARE the process step), but S/I/O/C nodes can exist independently as
   "shared library" items.
2. Create `sipoc_node_associations` — a join table linking shared S/I/O/C nodes
   to processes. This allows one node to appear in multiple processes' SIPOCs
   without duplication.
3. P-type nodes are always process-bound (process_id NOT NULL for them), so
   they continue to work as before.

## New Table: sipoc_node_associations
- `id` (uuid, primary key)
- `node_id` (uuid, FK -> sipoc_nodes ON DELETE CASCADE)
- `process_id` (uuid, FK -> processes ON DELETE CASCADE)
- `created_at` (timestamptz)
- Unique constraint on (node_id, process_id) to prevent duplicates

## Modified Table: sipoc_nodes
- `process_id` changed from NOT NULL to NULLABLE
- P-type nodes must still have process_id set (enforced at app level)

## Security
- RLS enabled on sipoc_node_associations with full anon+authenticated CRUD
  (single-tenant, intentionally shared data)

## Important Notes
1. Existing sipoc_nodes keep their process_id — they continue to work as
   process-bound nodes. The migration only makes the column nullable so new
   shared nodes can be created without a process.
2. Existing nodes that have process_id set are treated as "legacy bound" nodes.
   The app will show them in their process's SIPOC as before.
3. New shared nodes (process_id = null) appear in a process's SIPOC only when
   an association exists in sipoc_node_associations.
*/

-- Make process_id nullable on sipoc_nodes
ALTER TABLE sipoc_nodes ALTER COLUMN process_id DROP NOT NULL;

-- Create associations table
CREATE TABLE IF NOT EXISTS sipoc_node_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES sipoc_nodes(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (node_id, process_id)
);

ALTER TABLE sipoc_node_associations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_assoc" ON sipoc_node_associations;
CREATE POLICY "anon_select_assoc" ON sipoc_node_associations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_assoc" ON sipoc_node_associations;
CREATE POLICY "anon_insert_assoc" ON sipoc_node_associations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_assoc" ON sipoc_node_associations;
CREATE POLICY "anon_update_assoc" ON sipoc_node_associations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_assoc" ON sipoc_node_associations;
CREATE POLICY "anon_delete_assoc" ON sipoc_node_associations FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_assoc_node ON sipoc_node_associations(node_id);
CREATE INDEX IF NOT EXISTS idx_assoc_process ON sipoc_node_associations(process_id);
