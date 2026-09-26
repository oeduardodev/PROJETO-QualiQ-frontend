/*
# Add SLAs, Notification Types, and Indicator Enhancement

## Overview
This migration adds two new tables (`slas`, `notification_types`) and enhances the `indicators` table with a `requires_critical_analysis` boolean toggle. These support the restructured SGQ navigation.

## 1. New Tables

### `slas`
- Service Level Agreement tracking linked to SIPOC input nodes.
- `id` (uuid PK)
- `input_id` (uuid FK → sipoc_nodes, ON DELETE CASCADE) — the SIPOC Input node this SLA monitors
- `process_id` (uuid FK → processes, ON DELETE CASCADE) — the process context
- `name` (text) — SLA description (e.g. "Tempo máximo de resposta do fornecedor")
- `target_days` (integer) — agreed target in days
- `actual_days` (integer) — current measured performance
- `unit` (text, default 'dias') — unit of measurement
- `status` (text: 'no_prazo' | 'atencao' | 'atrasado', default 'no_prazo')
- `custom_fields` (JSONB) — extensible fields
- `created_at`, `updated_at` (timestamptz)

### `notification_types`
- Configurable notification/incident types with JSONB custom fields schema.
- `id` (uuid PK)
- `name` (text) — type name (e.g. "Não Conformidade", "Reclamação", "Incidente")
- `code` (text) — short code
- `description` (text)
- `default_severity` (text: 'baixa' | 'media' | 'alta' | 'critica', default 'media')
- `requires_root_cause` (boolean, default false) — whether Ishikawa analysis is required
- `custom_fields_schema` (JSONB) — JSON schema definition for customizable form fields
- `active` (boolean, default true)
- `created_at`, `updated_at` (timestamptz)

## 2. Modified Tables

### `indicators`
- Added `requires_critical_analysis` boolean column (default false) — toggle to flag indicators that require formal critical analysis review.

## 3. Security
- RLS enabled on both new tables with `TO anon, authenticated` open policies (shared data model, consistent with existing tables like indicators, tickets).
- RLS already enabled on `indicators`; no policy changes needed (column addition doesn't affect existing policies).

## 4. Indexes
- `idx_slas_input` on `slas.input_id`
- `idx_slas_process` on `slas.process_id`
- `idx_notification_types_active` on `notification_types.active`
*/

-- =====================================================
-- 1. Add requires_critical_analysis to indicators
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'indicators' AND column_name = 'requires_critical_analysis'
  ) THEN
    ALTER TABLE indicators ADD COLUMN requires_critical_analysis boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- =====================================================
-- 2. Create slas table
-- =====================================================
CREATE TABLE IF NOT EXISTS slas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  input_id uuid REFERENCES sipoc_nodes(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_days integer NOT NULL DEFAULT 30,
  actual_days integer,
  unit text NOT NULL DEFAULT 'dias',
  status text NOT NULL DEFAULT 'no_prazo' CHECK (status IN ('no_prazo', 'atencao', 'atrasado')),
  custom_fields jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE slas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_slas" ON slas;
CREATE POLICY "anon_select_slas" ON slas FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_slas" ON slas;
CREATE POLICY "anon_insert_slas" ON slas FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_slas" ON slas;
CREATE POLICY "anon_update_slas" ON slas FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_slas" ON slas;
CREATE POLICY "anon_delete_slas" ON slas FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_slas_input ON slas(input_id);
CREATE INDEX IF NOT EXISTS idx_slas_process ON slas(process_id);

-- =====================================================
-- 3. Create notification_types table
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  description text,
  default_severity text NOT NULL DEFAULT 'media' CHECK (default_severity IN ('baixa', 'media', 'alta', 'critica')),
  requires_root_cause boolean NOT NULL DEFAULT false,
  custom_fields_schema jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notification_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_notification_types" ON notification_types;
CREATE POLICY "anon_select_notification_types" ON notification_types FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_notification_types" ON notification_types;
CREATE POLICY "anon_insert_notification_types" ON notification_types FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_notification_types" ON notification_types;
CREATE POLICY "anon_update_notification_types" ON notification_types FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_notification_types" ON notification_types;
CREATE POLICY "anon_delete_notification_types" ON notification_types FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_notification_types_active ON notification_types(active);

-- =====================================================
-- 4. updated_at triggers for new tables
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_slas_updated ON slas;
CREATE TRIGGER trg_slas_updated BEFORE UPDATE ON slas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_notification_types_updated ON notification_types;
CREATE TRIGGER trg_notification_types_updated BEFORE UPDATE ON notification_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
