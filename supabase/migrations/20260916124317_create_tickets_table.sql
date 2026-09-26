/*
# Create tickets table (Chamados / Não-conformidades)

1. New Tables
- `tickets` — Chamados e não-conformidades vinculados a processos
  - `id` (uuid, primary key)
  - `title` (text, not null — título do chamado)
  - `description` (text, nullable — descrição detalhada)
  - `process_id` (uuid, foreign key -> processes, on delete cascade)
  - `status` (text, not null, check in 'aberto','analise','plano','concluido')
  - `severity` (text, not null, check in 'baixa','media','alta','critica')
  - `custom_fields` (jsonb, default '{}' — armazena Ishikawa 6M e atributos customizados)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Indexes
- `idx_tickets_status` on tickets(status)
- `idx_tickets_process` on tickets(process_id)

3. Security
- RLS enabled on tickets.
- Single-tenant (no auth): policies use TO anon, authenticated with USING(true) / WITH CHECK(true).

4. Seed Data
- 6 tickets across different statuses and severities, linked to existing processes.
*/

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','analise','plano','concluido')),
  severity text NOT NULL DEFAULT 'media' CHECK (severity IN ('baixa','media','alta','critica')),
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tickets" ON tickets;
CREATE POLICY "anon_select_tickets" ON tickets FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tickets" ON tickets;
CREATE POLICY "anon_insert_tickets" ON tickets FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tickets" ON tickets;
CREATE POLICY "anon_update_tickets" ON tickets FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tickets" ON tickets;
CREATE POLICY "anon_delete_tickets" ON tickets FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_process ON tickets(process_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_tickets_updated ON tickets;
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed data: link to existing processes by title
INSERT INTO tickets (title, description, process_id, status, severity, custom_fields)
SELECT v.title, v.description, p.id, v.status, v.severity, v.custom_fields::jsonb
FROM processes p
JOIN (VALUES
  ('Defeito em lote de produção — POP-0042', 'Lote 2026-09-15 apresentou falha dimensional em 12% das unidades. Necessária análise de causa raiz.', 'Produção', 'aberto', 'alta', '{"ishikawa":{"maquina":"Calibração do equipamento de corte verificada","metodo":"Procedimento POP-0042 revisado em 2026-08","mao_de_obra":"Operador em treinamento — 3 dias de experiência","material":"Lote de matéria-prima do Fornecedor A","meio_ambiente":"Temperatura do galpão em 35°C","medida":"Inspeção dimensional a cada 50 peças"}}'::text),
  ('Atraso na entrega ao Cliente X', 'Expedição atrasou 48h na entrega do pedido PX-1234. Cliente registrou reclamação formal.', 'Expedição', 'analise', 'media', '{"ishikawa":{"maquina":"Veículo com manutenção preventiva em dia","metodo":"Roteirização manual sem sistema automatizado","mao_de_obra":"Motorista substituto sem familiaridade com rota","material":"Embalagem inadequada gerou retrabalho","meio_ambiente":"Chuva intensa no dia da entrega","medida":"SLA de entrega: 24h, realizado: 72h"}}'::text),
  ('Erro de cadastro no sistema de vendas', 'Proposta comercial enviada com preço incorreto devido a erro de digitação.', 'Vendas', 'plano', 'media', '{"ishikawa":{"maquina":"Sistema CRM funcionando normalmente","metodo":"Falta de dupla verificação no cadastro de propostas","mao_de_obra":"Analista de vendas sobrecarregado","material":"Tabela de preços desatualizada","meio_ambiente":"Sem fatores ambientais identificados","medida":"Auditoria de propostas: semanal"}}'::text),
  ('Falha de comunicação entre TI e Operações', 'Sistema de gestão parou por 2h sem aviso prévio à operação.', 'Tecnologia da Informação', 'aberto', 'critica', '{"ishikawa":{"maquina":"Servidor apresentou instabilidade no disco SSD","metodo":"Plano de manutenção de servidores não contempla monitoramento proativo","mao_de_obra":"Equipe de TI reduzida (2 pessoas para 4 sistemas)","material":"Disco SSD fora do período de garantia","meio_ambiente":"Data center sem ar condicionado redundante","medida":"Monitoramento: manual, a cada 4h"}}'::text),
  ('Não-conformidade em auditoria interna de RH', 'Documentação de treinamento de 3 colaboradores não localizada durante auditoria.', 'Recursos Humanos', 'concluido', 'baixa', '{"ishikawa":{"maquina":"Sistema de gestão documental recém-implementado","metodo":"Procedimento de arquivamento não padronizado","mao_de_obra":"Analista de RH em período de férias","material":"Fichas físicas migradas para digital","meio_ambiente":"Sem fatores relevantes","medida":"Auditoria interna trimestral"}}'::text),
  ('Parada não programada de equipamento', 'Máquina de envase parou por 6h devido a falha mecânica.', 'Produção', 'analise', 'alta', '{"ishikawa":{"maquina":"Rolamento da esteira quebrou após 18 meses de uso","metodo":"Plano de manutenção previa troca a cada 24 meses","mao_de_obra":"Técnico de manutenção em outro atendimento","material":"Peça de reposição não estava em estoque","meio_ambiente":"Vibração excessiva no piso do galpão","medida":"Termografia: não realizada nos últimos 6 meses"}}'::text)
) AS v(title, description, process_title, status, severity, custom_fields)
ON p.title = v.process_title
ON CONFLICT DO NOTHING;
