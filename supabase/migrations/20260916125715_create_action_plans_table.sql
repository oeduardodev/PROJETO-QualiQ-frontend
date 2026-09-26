/*
# Create action_plans table (Planos de Ação 5W2H)

1. New Tables
- `action_plans` — Planos de ação vinculados a chamados/notificações
  - `id` (uuid, primary key)
  - `title` (text, not null — resumo da ação)
  - `ticket_id` (uuid, foreign key -> tickets, on delete cascade)
  - `what` (text, nullable — O que será feito?)
  - `why` (text, nullable — Por que?)
  - `where` (text, nullable — Onde?)
  - `when` (date, nullable — Quando? Prazo)
  - `who` (text, nullable — Quem fará?)
  - `how` (text, nullable — Como?)
  - `how_much` (text, nullable — Quanto custa?)
  - `status` (text, not null, check in 'pendente','andamento','concluido','atrasado')
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Indexes
- `idx_action_plans_ticket` on action_plans(ticket_id)
- `idx_action_plans_status` on action_plans(status)

3. Security
- RLS enabled on action_plans.
- Single-tenant (no auth): policies use TO anon, authenticated with USING(true) / WITH CHECK(true).

4. Seed Data
- 2 action plans linked to existing tickets by title.
*/

CREATE TABLE IF NOT EXISTS action_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  what text,
  why text,
  "where" text,
  "when" date,
  who text,
  how text,
  how_much text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','andamento','concluido','atrasado')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_action_plans" ON action_plans;
CREATE POLICY "anon_select_action_plans" ON action_plans FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_action_plans" ON action_plans;
CREATE POLICY "anon_insert_action_plans" ON action_plans FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_action_plans" ON action_plans;
CREATE POLICY "anon_update_action_plans" ON action_plans FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_action_plans" ON action_plans;
CREATE POLICY "anon_delete_action_plans" ON action_plans FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_action_plans_ticket ON action_plans(ticket_id);
CREATE INDEX IF NOT EXISTS idx_action_plans_status ON action_plans(status);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_action_plans_updated ON action_plans;
CREATE TRIGGER trg_action_plans_updated BEFORE UPDATE ON action_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed data: link to existing tickets by title
INSERT INTO action_plans (title, ticket_id, what, why, "where", "when", who, how, how_much, status)
SELECT v.title, t.id, v.what, v.why, v.where_loc, v.when_date::date, v.who, v.how, v.how_much, v.status
FROM tickets t
JOIN (VALUES
  ('Recalibrar equipamento de corte e revisar POP-0042',
   'Defeito em lote de produção — POP-0042',
   'Recalibrar máquina de corte e revisar procedimento operacional POP-0042',
   'Garantir conformidade dimensional e evitar reincidência de falhas no lote',
   'Linha de produção — Setor de Corte',
   '2026-09-25',
   'João Silva (Líder de Produção)',
   '1. Parar linha 2. Solicitar calibração da máquina 3. Revisar POP com supervisão 4. Treinar operadores 5. Validar lote piloto',
   'R$ 2.500 (calibração) + R$ 800 (treinamento)',
   'andamento'),
  ('Implementar roteirização automatizada no sistema de expedição',
   'Atraso na entrega ao Cliente X',
   'Implementar módulo de roteirização automatizada integrado ao sistema de gestão',
   'Reduzir tempo de planejamento de rotas e evitar atrasos de entrega',
   'Departamento de Logística',
   '2026-10-15',
   'Ana Costa (Coordenadora de Logística)',
   '1. Levantar requisitos 2. Avaliar fornecedores de software 3. Piloto em 1 rota 4. Treinar equipe 5. Deploy completo',
   'R$ 15.000 (software) + R$ 3.000 (implantação)',
   'pendente')
) AS v(title, ticket_title, what, why, where_loc, when_date, who, how, how_much, status)
ON t.title = v.ticket_title
ON CONFLICT DO NOTHING;
