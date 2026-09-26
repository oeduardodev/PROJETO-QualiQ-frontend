/*
# Create Value Chain and SIPOC Tables

1. New Tables
- `value_chain_categories` — Categorias da cadeia de valor (Gerencial, Finalístico, Apoio)
  - `id` (uuid, primary key)
  - `name` (text, not null — ex: "Gerencial", "Finalístico", "Apoio")
  - `description` (text, nullable)
  - `color_key` (text — chave de cor para o frontend: "blue", "green", "orange")
  - `order_index` (int — ordem de exibição das raias)
  - `created_at` (timestamptz)

- `processes` — Processos da Matriz de Valor, vinculados a uma categoria
  - `id` (uuid, primary key)
  - `category_id` (uuid, foreign key -> value_chain_categories, on delete cascade)
  - `title` (text, not null)
  - `code` (text — código do processo, ex: "EST-001")
  - `impact_score` (int, default 5, check 1-10)
  - `complexity_score` (int, default 5, check 1-10)
  - `maturity_level` (int, default 1, check 1-5)
  - `owner` (text, nullable — responsável)
  - `custom_fields` (jsonb, default '{}' — parametrização flexível)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

- `sipoc_nodes` — Itens do Kanban SIPOC (Fornecedores, Entradas, Processo, Saídas, Clientes)
  - `id` (uuid, primary key)
  - `process_id` (uuid, foreign key -> processes, on delete cascade)
  - `node_type` (text, not null, check in ('S','I','P','O','C'))
  - `title` (text, not null)
  - `description` (text, nullable)
  - `order_index` (int, default 0 — ordem dos cards no Kanban)
  - `custom_fields` (jsonb, default '{}' — parametrização flexível)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Indexes
- `idx_processes_category_id` on processes(category_id)
- `idx_sipoc_nodes_process_id` on sipoc_nodes(process_id)
- `idx_sipoc_nodes_type` on sipoc_nodes(process_id, node_type)

3. Security
- RLS enabled on all three tables.
- Single-tenant (no auth screen): policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)` because all data is intentionally shared/public.

4. Seed Data
- 3 categories: Gerencial (blue), Finalístico (green), Apoio (orange)
- 8 processes across the 3 categories
- SIPOC nodes for each process (S, I, P, O, C)
*/

-- =============================================================
-- value_chain_categories
-- =============================================================
CREATE TABLE IF NOT EXISTS value_chain_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color_key text NOT NULL DEFAULT 'blue',
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE value_chain_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_categories" ON value_chain_categories;
CREATE POLICY "anon_select_categories" ON value_chain_categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_categories" ON value_chain_categories;
CREATE POLICY "anon_insert_categories" ON value_chain_categories FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_categories" ON value_chain_categories;
CREATE POLICY "anon_update_categories" ON value_chain_categories FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_categories" ON value_chain_categories;
CREATE POLICY "anon_delete_categories" ON value_chain_categories FOR DELETE
  TO anon, authenticated USING (true);

-- =============================================================
-- processes
-- =============================================================
CREATE TABLE IF NOT EXISTS processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES value_chain_categories(id) ON DELETE CASCADE,
  title text NOT NULL,
  code text,
  impact_score int NOT NULL DEFAULT 5 CHECK (impact_score >= 1 AND impact_score <= 10),
  complexity_score int NOT NULL DEFAULT 5 CHECK (complexity_score >= 1 AND complexity_score <= 10),
  maturity_level int NOT NULL DEFAULT 1 CHECK (maturity_level >= 1 AND maturity_level <= 5),
  owner text,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE processes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_processes" ON processes;
CREATE POLICY "anon_select_processes" ON processes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_processes" ON processes;
CREATE POLICY "anon_insert_processes" ON processes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_processes" ON processes;
CREATE POLICY "anon_update_processes" ON processes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_processes" ON processes;
CREATE POLICY "anon_delete_processes" ON processes FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_processes_category_id ON processes(category_id);

-- =============================================================
-- sipoc_nodes
-- =============================================================
CREATE TABLE IF NOT EXISTS sipoc_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  node_type text NOT NULL CHECK (node_type IN ('S','I','P','O','C')),
  title text NOT NULL,
  description text,
  order_index int NOT NULL DEFAULT 0,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE sipoc_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sipoc" ON sipoc_nodes;
CREATE POLICY "anon_select_sipoc" ON sipoc_nodes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sipoc" ON sipoc_nodes;
CREATE POLICY "anon_insert_sipoc" ON sipoc_nodes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sipoc" ON sipoc_nodes;
CREATE POLICY "anon_update_sipoc" ON sipoc_nodes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sipoc" ON sipoc_nodes;
CREATE POLICY "anon_delete_sipoc" ON sipoc_nodes FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_sipoc_nodes_process ON sipoc_nodes(process_id);
CREATE INDEX IF NOT EXISTS idx_sipoc_nodes_type ON sipoc_nodes(process_id, node_type);

-- =============================================================
-- updated_at trigger
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_processes_updated ON processes;
CREATE TRIGGER trg_processes_updated BEFORE UPDATE ON processes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_sipoc_nodes_updated ON sipoc_nodes;
CREATE TRIGGER trg_sipoc_nodes_updated BEFORE UPDATE ON sipoc_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- Seed: categories
-- =============================================================
INSERT INTO value_chain_categories (name, description, color_key, order_index)
VALUES
  ('Gerencial', 'Processos estratégicos e de gestão', 'blue', 1),
  ('Finalístico', 'Processos core da cadeia de valor', 'green', 2),
  ('Apoio', 'Processos de suporte e infraestrutura', 'orange', 3)
ON CONFLICT DO NOTHING;

-- =============================================================
-- Seed: processes
-- =============================================================
INSERT INTO processes (category_id, title, code, impact_score, complexity_score, maturity_level, owner)
SELECT c.id, p.title, p.code, p.impact, p.complexity, p.maturity, p.owner
FROM value_chain_categories c
JOIN (VALUES
  ('Gerencial', 'Planejamento Estratégico', 'GER-001', 9, 7, 4, 'Diretoria'),
  ('Gerencial', 'Gestão de Riscos', 'GER-002', 8, 8, 3, 'Compliance'),
  ('Gerencial', 'Gestão da Qualidade', 'GER-003', 8, 6, 4, 'Qualidade'),
  ('Finalístico', 'Produção', 'FIN-001', 9, 7, 4, 'Operações'),
  ('Finalístico', 'Vendas', 'FIN-002', 9, 5, 3, 'Comercial'),
  ('Finalístico', 'Expedição', 'FIN-003', 7, 4, 3, 'Logística'),
  ('Apoio', 'Tecnologia da Informação', 'APO-001', 6, 8, 2, 'TI'),
  ('Apoio', 'Recursos Humanos', 'APO-002', 5, 4, 3, 'RH'),
  ('Apoio', 'Manutenção', 'APO-003', 5, 3, 3, 'Facilities')
) AS p(category_name, title, code, impact, complexity, maturity, owner)
ON c.name = p.category_name
ON CONFLICT DO NOTHING;

-- =============================================================
-- Seed: SIPOC nodes for each process
-- =============================================================
INSERT INTO sipoc_nodes (process_id, node_type, title, description, order_index)
SELECT p.id, v.node_type, v.title, v.description, v.order_index
FROM processes p
JOIN (VALUES
  -- Planejamento Estratégico
  ('Planejamento Estratégico', 'S', 'Acionistas', 'Fornecem diretrizes e capital', 1),
  ('Planejamento Estratégico', 'I', 'Análise de Mercado', 'Dados de mercado e concorrência', 1),
  ('Planejamento Estratégico', 'P', 'Definição de Metas', 'Planejamento estratégico anual', 1),
  ('Planejamento Estratégico', 'O', 'Plano Estratégico', 'Documento com metas e KPIs', 1),
  ('Planejamento Estratégico', 'C', 'Gestão Executiva', 'Recebe o plano estratégico', 1),
  -- Gestão de Riscos
  ('Gestão de Riscos', 'S', 'Áreas Operacionais', 'Reportam riscos identificados', 1),
  ('Gestão de Riscos', 'I', 'Eventos de Risco', 'Registros de incidentes e near-misses', 1),
  ('Gestão de Riscos', 'P', 'Avaliação de Riscos', 'Análise e priorização de riscos', 1),
  ('Gestão de Riscos', 'O', 'Matriz de Riscos', 'Mapa de calor e plano de mitigação', 1),
  ('Gestão de Riscos', 'C', 'Comitê de Riscos', 'Aprova ações de mitigação', 1),
  -- Gestão da Qualidade
  ('Gestão da Qualidade', 'S', 'Áreas Produtivas', 'Geram dados de qualidade', 1),
  ('Gestão da Qualidade', 'I', 'Indicadores de Qualidade', 'Métricas de conformidade', 1),
  ('Gestão da Qualidade', 'P', 'Auditoria Interna', 'Verificação de conformidade', 1),
  ('Gestão da Qualidade', 'O', 'Relatórios de Auditoria', 'Resultados e recomendações', 1),
  ('Gestão da Qualidade', 'C', 'Alta Gestão', 'Toma ações corretivas', 1),
  -- Produção
  ('Produção', 'S', 'Fornecedor de Matéria-Prima', 'Fornece insumos para produção', 1),
  ('Produção', 'I', 'Ordem de Produção', 'Requisição formal de fabricação', 1),
  ('Produção', 'P', 'Fabricação', 'Transformação de insumos em produto', 1),
  ('Produção', 'O', 'Produto Acabado', 'Item conforme especificação', 1),
  ('Produção', 'C', 'Controle de Qualidade', 'Inspeciona e libera o lote', 1),
  -- Vendas
  ('Vendas', 'S', 'Marketing', 'Gera leads qualificados', 1),
  ('Vendas', 'I', 'Proposta Comercial', 'Cotação enviada ao cliente', 1),
  ('Vendas', 'P', 'Negociação', 'Fechamento de pedido', 1),
  ('Vendas', 'O', 'Pedido Confirmado', 'Contrato assinado', 1),
  ('Vendas', 'C', 'Cliente Final', 'Recebe o produto/serviço', 1),
  -- Expedição
  ('Expedição', 'S', 'Almoxarifado', 'Disponibiliza produtos acabados', 1),
  ('Expedição', 'I', 'Ordem de Envio', 'Instrução de logística', 1),
  ('Expedição', 'P', 'Embalagem e Envio', 'Preparação e despacho', 1),
  ('Expedição', 'O', 'Produto Entregue', 'Mercadoria em trânsito', 1),
  ('Expedição', 'C', 'Distribuidor', 'Recebe e armazena', 1),
  -- TI
  ('Tecnologia da Informação', 'S', 'Fornecedores de TI', 'Fornecem software e hardware', 1),
  ('Tecnologia da Informação', 'I', 'Requisitos de Sistema', 'Demandas das áreas', 1),
  ('Tecnologia da Informação', 'P', 'Suporte e Infraestrutura', 'Manutenção de sistemas', 1),
  ('Tecnologia da Informação', 'O', 'Sistemas Disponíveis', 'Plataformas operacionais', 1),
  ('Tecnologia da Informação', 'C', 'Usuários Internos', 'Utilizam os sistemas', 1),
  -- RH
  ('Recursos Humanos', 'S', 'Gestores de Áreas', 'Identificam necessidades de pessoal', 1),
  ('Recursos Humanos', 'I', 'Requisição de Pessoal', 'Solicitação de contratação', 1),
  ('Recursos Humanos', 'P', 'Recrutamento e Seleção', 'Captação e triagem de candidatos', 1),
  ('Recursos Humanos', 'O', 'Colaborador Contratado', 'Profissional admitido', 1),
  ('Recursos Humanos', 'C', 'Área Solicitante', 'Recebe o novo colaborador', 1),
  -- Manutenção
  ('Manutenção', 'S', 'Fabricantes de Equipamentos', 'Fornecem peças e suporte técnico', 1),
  ('Manutenção', 'I', 'Ordem de Manutenção', 'Solicitação de intervenção', 1),
  ('Manutenção', 'P', 'Manutenção Preventiva/Corretiva', 'Intervenção no equipamento', 1),
  ('Manutenção', 'O', 'Equipamento Operante', 'Máquina restaurada', 1),
  ('Manutenção', 'C', 'Operação', 'Utiliza o equipamento', 1)
) AS v(process_title, node_type, title, description, order_index)
ON p.title = v.process_title
ON CONFLICT DO NOTHING;
