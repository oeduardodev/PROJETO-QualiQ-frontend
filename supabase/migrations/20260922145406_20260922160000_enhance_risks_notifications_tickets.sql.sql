/*
# Enhance Risks, Notification Types, and Tickets

## Overview
This migration adds new fields to the `risks`, `notification_types`, and `tickets` tables
to support the Risk Management module, Notification Parametrization, and ticket-to-risk/SLA linking.

## 1. Modified Tables

### `risks`
- Added `risk_type` (text: 'Operacional' | 'Estratégico' | 'Financeiro' | 'Compliance', default 'Operacional')
- Added `barriers` (text, nullable — description of existing controls/barriers)

### `notification_types`
- Added `analysis_tool` (text: 'Ishikawa' | '5 Porquês' | 'Nenhuma', default 'Nenhuma') — which root-cause tool is required
- Added `sla_hours` (integer, nullable) — SLA in hours for resolution

### `tickets`
- Added `risk_id` (uuid, nullable, FK → risks ON DELETE SET NULL) — link incident to a risk
- Added `sla_id` (uuid, nullable, FK → slas ON DELETE SET NULL) — link incident to an SLA
- Added `notification_type_id` (uuid, nullable, FK → notification_types ON DELETE SET NULL) — link to notification type for analysis tool enforcement
- Added `analysis_completed` (boolean, default false) — whether the required analysis tool has been filled

## 2. Indexes
- `idx_tickets_risk` on tickets(risk_id)
- `idx_tickets_sla` on tickets(sla_id)
- `idx_tickets_notification_type` on tickets(notification_type_id)
- `idx_risks_risk_type` on risks(risk_type)

## 3. Security
- No new tables, RLS already enabled on all affected tables.
- No policy changes needed (column additions don't affect existing policies).
*/

-- =====================================================
-- 1. Enhance risks table
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'risk_type'
  ) THEN
    ALTER TABLE risks ADD COLUMN risk_type text NOT NULL DEFAULT 'Operacional'
      CHECK (risk_type IN ('Operacional', 'Estratégico', 'Financeiro', 'Compliance'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'barriers'
  ) THEN
    ALTER TABLE risks ADD COLUMN barriers text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_risks_risk_type ON risks(risk_type);

-- =====================================================
-- 2. Enhance notification_types table
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_types' AND column_name = 'analysis_tool'
  ) THEN
    ALTER TABLE notification_types ADD COLUMN analysis_tool text NOT NULL DEFAULT 'Nenhuma'
      CHECK (analysis_tool IN ('Ishikawa', '5 Porquês', 'Nenhuma'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_types' AND column_name = 'sla_hours'
  ) THEN
    ALTER TABLE notification_types ADD COLUMN sla_hours integer;
  END IF;
END $$;

-- =====================================================
-- 3. Enhance tickets table with risk/SLA/notification_type links
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'risk_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN risk_id uuid REFERENCES risks(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'sla_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN sla_id uuid REFERENCES slas(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'notification_type_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN notification_type_id uuid REFERENCES notification_types(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'analysis_completed'
  ) THEN
    ALTER TABLE tickets ADD COLUMN analysis_completed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_risk ON tickets(risk_id);
CREATE INDEX IF NOT EXISTS idx_tickets_sla ON tickets(sla_id);
CREATE INDEX IF NOT EXISTS idx_tickets_notification_type ON tickets(notification_type_id);