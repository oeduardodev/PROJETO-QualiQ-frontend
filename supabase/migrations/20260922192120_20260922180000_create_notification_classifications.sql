/*
# Create notification_classifications and restructure notification types

## Summary
Restructures the notification system so that the dynamic form, SLA hours, analysis tool,
and root-cause requirement belong to a CLASSIFICATION (e.g. "Falha de Processo",
"Não Conformidade"), not to an individual notification type. Notification types become
lightweight labels linked to a classification. This separates concerns:
- Classification = the form template + treatment rules (admin-configured)
- Type = a specific named notification within a classification (e.g. "Atraso de Produção" under "Falha de Processo")

## 1. New Table: notification_classifications
- `id` (uuid PK)
- `name` (text, not null) — e.g. "Falha de Processo", "Não Conformidade", "Melhoria"
- `code` (text, nullable) — short code
- `description` (text, nullable)
- `default_severity` (text, default 'media', check in baixa/media/alta/critica)
- `sla_hours` (integer, nullable) — treatment SLA in hours
- `analysis_tool` (text, default 'Nenhuma', check in Nenhuma/Ishikawa/5 Porquês)
- `requires_root_cause` (boolean, default false)
- `form_schema` (jsonb, nullable) — dynamic form fields the collaborator fills
- `active` (boolean, default true)
- `created_at`, `updated_at` (timestamptz)

## 2. Modified Table: notification_types
- Added `classification_id` (uuid, nullable, references notification_classifications, ON DELETE SET NULL)
- The existing form_schema, sla_hours, analysis_tool, requires_root_cause columns remain
  for backward compatibility but are superseded by the classification's values.

## 3. Security
- RLS enabled on notification_classifications with shared-data policies (TO anon, authenticated).
- Existing notification_types policies unchanged.

## 4. Indexes
- idx_notification_classifications_active on notification_classifications(active)
- idx_notification_types_classification_id on notification_types(classification_id)
*/

CREATE TABLE IF NOT EXISTS notification_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  description text,
  default_severity text NOT NULL DEFAULT 'media' CHECK (default_severity IN ('baixa', 'media', 'alta', 'critica')),
  sla_hours integer,
  analysis_tool text NOT NULL DEFAULT 'Nenhuma' CHECK (analysis_tool IN ('Nenhuma', 'Ishikawa', '5 Porquês')),
  requires_root_cause boolean NOT NULL DEFAULT false,
  form_schema jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notification_classifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_notification_classifications" ON notification_classifications;
CREATE POLICY "anon_select_notification_classifications" ON notification_classifications FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_notification_classifications" ON notification_classifications;
CREATE POLICY "anon_insert_notification_classifications" ON notification_classifications FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_notification_classifications" ON notification_classifications;
CREATE POLICY "anon_update_notification_classifications" ON notification_classifications FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_notification_classifications" ON notification_classifications;
CREATE POLICY "anon_delete_notification_classifications" ON notification_classifications FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_notification_classifications_active ON notification_classifications(active);

-- Add classification_id to notification_types
ALTER TABLE notification_types
  ADD COLUMN IF NOT EXISTS classification_id uuid REFERENCES notification_classifications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notification_types_classification_id ON notification_types(classification_id);

-- updated_at trigger for notification_classifications
DROP TRIGGER IF EXISTS trg_notification_classifications_updated ON notification_classifications;
CREATE TRIGGER trg_notification_classifications_updated BEFORE UPDATE ON notification_classifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();