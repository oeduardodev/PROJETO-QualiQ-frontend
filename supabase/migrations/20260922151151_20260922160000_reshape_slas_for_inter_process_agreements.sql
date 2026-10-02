/*
# Reshape slas table for inter-process SLA agreements

## Summary
The slas table previously tracked simple per-input deadlines (input_id, target_days, actual_days, unit, status).
This migration reshapes it to model proper inter-process Service Level Agreements:
each SLA links a supplier process, a client process, and a specific SIPOC input node,
with agreed lead time, quality criteria, and a lifecycle status.

## Changes to `slas` table
1. New columns:
   - `title` (text, NOT NULL) — Nome do Acordo
   - `supplier_process_id` (uuid, FK → processes) — processo que fornece
   - `client_process_id` (uuid, FK → processes) — processo que recebe
   - `sipoc_input_id` (uuid, FK → sipoc_nodes) — a Entrada/Input exata do SIPOC
   - `lead_time_hours` (integer, NOT NULL DEFAULT 24) — prazo acordado em horas
   - `quality_criteria` (text) — critérios de aceitação
2. Modified columns:
   - `status` — changed CHECK constraint to new enum values: 'Ativo', 'Em Revisão', 'Inativo'
3. Removed columns (data loss acceptable — table was newly created and has no production data):
   - `input_id` (replaced by `sipoc_input_id`)
   - `process_id` (replaced by `supplier_process_id` + `client_process_id`)
   - `name` (replaced by `title`)
   - `target_days`, `actual_days`, `unit` (replaced by `lead_time_hours`)

## Security
- RLS already enabled on slas. Policies remain TO anon, authenticated (shared data model).
- The existing anon CRUD policies remain valid.

## Indexes
- `idx_slas_supplier` on `supplier_process_id`
- `idx_slas_client` on `client_process_id`
- `idx_slas_sipoc_input` on `sipoc_input_id`
- Old indexes `idx_slas_input` and `idx_slas_process` dropped (columns removed).

## Notes
1. The `name` column data is migrated to `title` before drop.
2. The `input_id` data is migrated to `sipoc_input_id` before drop.
3. The `process_id` data is migrated to `supplier_process_id` before drop (best-effort).
4. This table was created in a prior migration this sprint and contains no production data;
   column drops are safe.
*/

-- Step 1: Add new columns
ALTER TABLE slas ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE slas ADD COLUMN IF NOT EXISTS supplier_process_id uuid REFERENCES processes(id) ON DELETE SET NULL;
ALTER TABLE slas ADD COLUMN IF NOT EXISTS client_process_id uuid REFERENCES processes(id) ON DELETE SET NULL;
ALTER TABLE slas ADD COLUMN IF NOT EXISTS sipoc_input_id uuid REFERENCES sipoc_nodes(id) ON DELETE SET NULL;
ALTER TABLE slas ADD COLUMN IF NOT EXISTS lead_time_hours integer NOT NULL DEFAULT 24;
ALTER TABLE slas ADD COLUMN IF NOT EXISTS quality_criteria text;

-- Step 2: Migrate data from old columns to new ones (best-effort)
UPDATE slas SET title = name WHERE title IS NULL AND name IS NOT NULL;
UPDATE slas SET sipoc_input_id = input_id WHERE sipoc_input_id IS NULL AND input_id IS NOT NULL;
UPDATE slas SET supplier_process_id = process_id WHERE supplier_process_id IS NULL AND process_id IS NOT NULL;
UPDATE slas
SET lead_time_hours = target_days * 24,
    custom_fields = coalesce(custom_fields, '{}'::jsonb) || jsonb_build_object(
      'legacy_sla', jsonb_build_object(
        'target_days', target_days, 'actual_days', actual_days, 'unit', unit,
        'previous_status', status
      )
    )
WHERE target_days IS NOT NULL;

-- Step 3: Set title NOT NULL (after backfill)
UPDATE slas SET title = 'Acordo sem nome' WHERE title IS NULL;
ALTER TABLE slas ALTER COLUMN title SET NOT NULL;

-- Step 4: Drop old columns
ALTER TABLE slas DROP COLUMN IF EXISTS input_id;
ALTER TABLE slas DROP COLUMN IF EXISTS process_id;
ALTER TABLE slas DROP COLUMN IF EXISTS name;
ALTER TABLE slas DROP COLUMN IF EXISTS target_days;
ALTER TABLE slas DROP COLUMN IF EXISTS actual_days;
ALTER TABLE slas DROP COLUMN IF EXISTS unit;

-- Step 5: Replace status CHECK constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'slas' AND constraint_name = 'slas_status_check'
  ) THEN
    ALTER TABLE slas DROP CONSTRAINT slas_status_check;
  END IF;
END $$;
-- Update existing status values to new enum
UPDATE slas SET status = 'Ativo' WHERE status NOT IN ('Ativo', 'Em Revisão', 'Inativo');
ALTER TABLE slas ADD CONSTRAINT slas_status_check
  CHECK (status IN ('Ativo', 'Em Revisão', 'Inativo'));

-- Step 6: Drop old indexes, create new ones
DROP INDEX IF EXISTS idx_slas_input;
DROP INDEX IF EXISTS idx_slas_process;
CREATE INDEX IF NOT EXISTS idx_slas_supplier ON slas(supplier_process_id);
CREATE INDEX IF NOT EXISTS idx_slas_client ON slas(client_process_id);
CREATE INDEX IF NOT EXISTS idx_slas_sipoc_input ON slas(sipoc_input_id);
