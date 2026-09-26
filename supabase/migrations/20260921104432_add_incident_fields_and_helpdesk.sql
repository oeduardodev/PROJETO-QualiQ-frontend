/*
# Refine tickets (incidents) + create helpdesk_tickets

## Part 1: Add incident fields to tickets table
- classification_flag (text, nullable) — 'incidente' | 'nao_conformidade' | 'melhoria' | 'reclamacao'
- incident_type (text, nullable) — free-form type label
- free_description (text, nullable) — extended free-form description
- incident_datetime (timestamptz, nullable) — when the incident occurred

## Part 2: Create helpdesk_tickets table
Dedicated helpdesk module for TI, Manutenção, Almoxarifado.
- id, title, description
- category ('ti' | 'manutencao' | 'almoxarifado')
- status ('aberto' | 'em_andamento' | 'resolvido' | 'fechado')
- priority ('baixa' | 'media' | 'alta' | 'urgente')
- requester_name, assigned_to
- process_id (optional link to SIPOC process)
- custom_fields (jsonb)
- created_at, updated_at
*/

-- Part 1: Add incident fields to tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS classification_flag text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS incident_type text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS free_description text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS incident_datetime timestamptz;

-- Part 2: Create helpdesk_tickets table
CREATE TABLE IF NOT EXISTS helpdesk_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'ti' CHECK (category IN ('ti', 'manutencao', 'almoxarifado')),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'resolvido', 'fechado')),
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
  requester_name text,
  assigned_to text,
  process_id uuid REFERENCES processes(id) ON DELETE SET NULL,
  custom_fields jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE helpdesk_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_helpdesk" ON helpdesk_tickets;
CREATE POLICY "anon_select_helpdesk" ON helpdesk_tickets FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_helpdesk" ON helpdesk_tickets;
CREATE POLICY "anon_insert_helpdesk" ON helpdesk_tickets FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_helpdesk" ON helpdesk_tickets;
CREATE POLICY "anon_update_helpdesk" ON helpdesk_tickets FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_helpdesk" ON helpdesk_tickets;
CREATE POLICY "anon_delete_helpdesk" ON helpdesk_tickets FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_helpdesk_category ON helpdesk_tickets(category);
CREATE INDEX IF NOT EXISTS idx_helpdesk_status ON helpdesk_tickets(status);
CREATE INDEX IF NOT EXISTS idx_helpdesk_priority ON helpdesk_tickets(priority);
