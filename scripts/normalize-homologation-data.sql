-- Saneamento pontual dos dados sintéticos do projeto QualiQ Homologação.
-- Executar somente no projeto mgmfjmiuzjapyisxcjwu, após guardar um snapshot.
-- Mantém os históricos de auditoria e os IDs dos registros restantes.
-- Remove três raias vazias e ajusta vínculos que deixaram de ser válidos.
BEGIN;

SELECT pg_advisory_xact_lock(hashtext('qualiq-homologation-normalization-2026-10-22'));
SELECT set_config('app.process_change_reason', 'Saneamento dos dados sintéticos de homologação', true);
SELECT set_config('app.risk_change_reason', 'Saneamento dos dados sintéticos de homologação', true);
SELECT set_config('app.indicator_change_reason', 'Saneamento dos dados sintéticos de homologação', true);
SELECT set_config('app.sla_change_reason', 'Saneamento dos dados sintéticos de homologação', true);
SELECT set_config('app.edit_reason', 'Saneamento dos dados sintéticos de homologação', true);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.processes WHERE (id, code) IN
      (('05133f8e-12ca-4c86-ba50-51ffb18cdcb3'::uuid, 'SDG'),
       ('1eb4459e-4bfb-4e11-b701-cc0795faa153'::uuid, 'WQT'))) <> 2
    OR (SELECT count(*) FROM public.value_chain_categories) <> 6
    OR (SELECT count(*) FROM public.dimensions) <> 32
    OR (SELECT count(*) FROM public.documents) <> 6 THEN
    RAISE EXCEPTION 'Os dados de homologação mudaram; reavalie o saneamento antes de executar';
  END IF;
END $$;

CREATE TEMP TABLE _original_tickets ON COMMIT DROP AS
SELECT id, to_jsonb(t) AS before_data FROM public.tickets t;
CREATE TEMP TABLE _original_document_types ON COMMIT DROP AS
SELECT id, to_jsonb(t) AS before_data FROM public.document_types t;

UPDATE public.value_chain_categories AS c
SET name = v.name, description = v.description, color_key = v.color_key, order_index = v.order_index
FROM (VALUES
  ('796f5ee2-0243-4fce-ad87-4f859869e457'::uuid, 'Gerencial', 'Planejamento, governança e melhoria do sistema de gestão.', '#006ACC', 0),
  ('20cefe73-44c7-4e68-9e78-2fd3a5c30136'::uuid, 'Finalístico', 'Processos que transformam insumos em produtos para o cliente.', '#379951', 1),
  ('913fe236-d50b-4e04-80dd-507e52cef6be'::uuid, 'Apoio', 'Processos que sustentam a operação e a disponibilidade dos recursos.', '#F59E0B', 2)
) AS v(id, name, description, color_key, order_index)
WHERE c.id = v.id;

DELETE FROM public.value_chain_categories
WHERE id IN ('968f14ca-7cee-496a-9bfe-bc31899b540b',
             '51fe1b47-a44d-4c2a-b3a3-9e79d1ebc610',
             '57537055-01e7-4f0b-af1c-3f4078a1a1d8')
  AND NOT EXISTS (SELECT 1 FROM public.processes p WHERE p.category_id = value_chain_categories.id)
  AND NOT EXISTS (SELECT 1 FROM public.profiles u WHERE u.category_id = value_chain_categories.id);

-- A troca da sigla aciona os gatilhos de recodificação dos módulos ligados ao processo.
UPDATE public.processes
SET title = 'Produção e controle de qualidade', code = 'PRD',
    description = 'Transforma matérias-primas em produtos acabados e verifica a conformidade dos lotes antes da liberação.',
    objective = 'Entregar lotes conformes, rastreáveis e dentro do prazo acordado.',
    owner = 'Coordenação de Produção'
WHERE id = '05133f8e-12ca-4c86-ba50-51ffb18cdcb3';

UPDATE public.processes
SET title = 'Manutenção de equipamentos', code = 'MNT',
    description = 'Planeja e executa manutenção preventiva e corretiva dos equipamentos utilizados na operação.',
    objective = 'Assegurar a disponibilidade e a segurança dos equipamentos produtivos.',
    owner = 'Equipe de Manutenção'
WHERE id = '1eb4459e-4bfb-4e11-b701-cc0795faa153';

UPDATE public.sipoc_nodes AS n
SET title = v.title, description = v.description
FROM (VALUES
  ('b02f7c48-8d7e-4006-b619-fdf686dd2b18'::uuid, 'Planejamento da manutenção', 'Fornece o plano preventivo e a programação das intervenções.'),
  ('f9bbf042-1d63-46f3-881e-f922ca90bf1c'::uuid, 'Almoxarifado', 'Disponibiliza matérias-primas identificadas para a produção.'),
  ('6da1b35c-492a-4370-a01f-69665a2d50cd'::uuid, 'Plano de produção', 'Define lotes, volumes e datas de fabricação.'),
  ('dc0e999b-4412-44e6-88b0-395943fea8ce'::uuid, 'Especificação do produto', 'Estabelece requisitos técnicos e critérios de aceitação.'),
  ('a6a9d133-399b-4027-b317-03a76da998ca'::uuid, 'Ordem de serviço', 'Solicita e descreve a intervenção de manutenção.'),
  ('ff2a85f0-5662-49c6-978b-aa90a5c8d1fc'::uuid, 'Solicitação de inspeção de lote', 'Identifica o lote que deve ser inspecionado antes da liberação.'),
  ('e2d6ed08-802d-44af-a0d7-233f773cad94'::uuid, 'Execução da manutenção', 'Inspeciona o equipamento, corrige falhas e registra os testes de retorno.'),
  ('f324ea75-b528-4064-9720-905fc165e5c3'::uuid, 'Inspeção e liberação de lote', 'Verifica o produto, registra resultados e decide a liberação do lote.'),
  ('150eff85-69a3-4f05-bf52-80a73b3a73bf'::uuid, 'Lote liberado', 'Lote aprovado e identificado para expedição.'),
  ('f969e604-fa61-4f15-966c-de104c91a655'::uuid, 'Equipamento liberado', 'Equipamento testado e disponível para operação.'),
  ('943a8272-2747-4fa7-92eb-938f3872dedb'::uuid, 'Expedição', 'Recebe os lotes liberados para preparação da entrega.')
) AS v(id, title, description)
WHERE n.id = v.id;

UPDATE public.dimension_versions SET label = CASE version_number
  WHEN 1 THEN 'Diagnóstico inicial 2026'
  WHEN 2 THEN 'Planejamento 2026'
  WHEN 3 THEN 'Planejamento 2027 — proposta'
  WHEN 4 THEN 'Planejamento 2027 — revisão'
END WHERE version_number BETWEEN 1 AND 4;

-- O mesmo código mantém o mesmo significado nas quatro versões existentes.
UPDATE public.dimensions AS d
SET name = v.name, description = v.description, objective = v.objective,
    classification_key = v.classification_key
FROM (VALUES
  ('DIM-0001', 'Eficiência operacional', 'Produtividade e estabilidade das rotinas de fabricação.', 'Reduzir perdas e melhorar o fluxo de produção.', 'processos_operacionais'),
  ('DIM-0002', 'Gestão de pessoas', 'Capacitação e participação das equipes na melhoria dos processos.', 'Desenvolver competências para uma operação segura e consistente.', 'pessoas_cultura'),
  ('DIM-0003', 'Padronização dos processos', 'Definição e aplicação uniforme das instruções de trabalho.', 'Reduzir variações entre turnos e equipes.', 'processos_operacionais'),
  ('DIM-0004', 'Produtividade industrial', 'Uso eficiente de tempo, materiais e capacidade produtiva.', 'Aumentar a produção conforme sem ampliar desperdícios.', 'processos_operacionais'),
  ('DIM-0005', 'Satisfação do cliente', 'Qualidade percebida pelo cliente e tratamento de reclamações.', 'Reduzir reclamações e elevar a confiança nas entregas.', 'mercado_cliente'),
  ('DIM-0006', 'Qualidade do atendimento', 'Tempo e clareza na resposta às solicitações internas e externas.', 'Cumprir prazos de atendimento com informações completas.', 'processos_operacionais'),
  ('DIM-0007', 'Desenvolvimento de mercado', 'Identificação de segmentos e necessidades de novos clientes.', 'Ampliar oportunidades com propostas aderentes ao mercado.', 'mercado_cliente'),
  ('DIM-0008', 'Sustentabilidade financeira', 'Controle de custos e equilíbrio econômico das operações.', 'Preservar margens por meio da redução de perdas.', 'financeira'),
  ('DIM-0009', 'Inovação e melhoria contínua', 'Adoção de soluções para aperfeiçoar produtos e processos.', 'Transformar dados de desempenho em melhorias verificáveis.', 'inovacao_melhoria'),
  ('DIM-0010', 'Desenvolvimento de competências', 'Formação técnica e disseminação do conhecimento operacional.', 'Manter equipes aptas aos padrões de qualidade e segurança.', 'pessoas_cultura'),
  ('DIM-0011', 'Qualidade e segurança', 'Prevenção de defeitos e condições inseguras na operação.', 'Proteger pessoas e assegurar produtos conformes.', 'qualidade_seguranca'),
  ('DIM-0013', 'Conformidade regulatória', 'Atendimento aos requisitos legais e normativos aplicáveis.', 'Manter evidências atualizadas de conformidade.', 'compliance_regulatorio'),
  ('DIM-0014', 'Desempenho operacional', 'Tempo e confiabilidade das etapas de produção e inspeção.', 'Reduzir o tempo de liberação sem comprometer a qualidade.', 'processos_operacionais'),
  ('DIM-0015', 'Continuidade operacional', 'Disponibilidade de recursos e resposta a interrupções.', 'Diminuir paradas não planejadas da produção.', 'processos_operacionais'),
  ('DIM-0016', 'Rastreabilidade e conformidade', 'Registros que comprovam a origem, a inspeção e a liberação dos lotes.', 'Garantir evidências completas para cada lote produzido.', 'compliance_regulatorio'),
  ('DIM-0017', 'Governança estratégica', 'Acompanhamento de objetivos, riscos e decisões da gestão.', 'Priorizar ações com base em indicadores e riscos.', 'estrategica_governanca')
) AS v(code, name, description, objective, classification_key)
WHERE d.code = v.code;

UPDATE public.indicators
SET title = 'Tempo médio de liberação de lote',
    objective = 'Medir o intervalo entre o fim da produção e a liberação do lote após inspeção.',
    goal_value = 30, current_value = 35, goal_direction = 'lower',
    unit = 'tempo_minutos', frequency = 'mensal', acceptable_variation = 0
WHERE id = '5a07bde7-dde6-4a1b-bcfe-637d996a10d8';

UPDATE public.indicators
SET title = 'Reclamações de clientes por mês',
    objective = 'Acompanhar reclamações de clientes relacionadas à qualidade dos produtos entregues.',
    goal_value = 2, current_value = 4, goal_direction = 'lower',
    unit = 'numero_absoluto', frequency = 'mensal', acceptable_variation = 0
WHERE id = '9c6e30cd-397b-48fa-a53b-804c9697d91c';

UPDATE public.indicator_history AS h
SET period_date = v.period_date::date, period = v.period_date,
    value = v.value, goal = v.goal
FROM (VALUES
  ('28f4636b-3b4c-4fe5-9b78-f1b2eb9459dc'::uuid, '2026-08-01', 33::numeric, 30::numeric),
  ('f9b2a630-891e-40e2-80ae-9c76df20f3b7'::uuid, '2026-09-01', 31::numeric, 30::numeric),
  ('f8c33050-1636-4e73-aced-f860bedd8a20'::uuid, '2026-10-01', 35::numeric, 30::numeric),
  ('11d0c652-4625-4cb1-bfc8-60921c62712f'::uuid, '2026-10-01', 4::numeric, 2::numeric)
) AS v(id, period_date, value, goal)
WHERE h.id = v.id;

UPDATE public.indicator_result_analyses AS a
SET observed_value = h.value, observed_goal = h.goal, observed_period = h.period,
    diagnostic = CASE a.id
      WHEN 'ec2798ab-6d1f-49d5-aef3-246f428ee1d1'::uuid THEN 'A liberação levou 31 minutos, um minuto acima da meta. Verificar a fila de inspeção do período.'
      WHEN '544aa19f-fe9e-4489-8ccb-54c0bbcb6b5d'::uuid THEN 'O tempo subiu para 35 minutos. Avaliar disponibilidade de inspetores e retrabalho nos lotes.'
      WHEN '290702fd-84df-40b7-9774-4c674cdb904d'::uuid THEN 'A medição de outubro confirma atraso de cinco minutos em relação à meta de liberação.'
      WHEN 'fe45bce7-bff0-4704-ac6f-bf548d02af46'::uuid THEN 'Foram registradas quatro reclamações, acima da meta de duas. Classificar as causas e priorizar ações corretivas.'
    END
FROM public.indicator_history h
WHERE h.id = a.history_id;

-- O próprio gatilho de aprovação devolve estes dois riscos a rascunho.
UPDATE public.risks
SET title = 'Falha na rastreabilidade de lotes',
    description = 'Perda ou preenchimento incompleto dos registros de matéria-prima, inspeção e liberação.',
    barriers = 'Identificação por lote, conferência dos registros e bloqueio de liberação sem evidências completas.',
    owner = 'Coordenação de Produção'
WHERE id = '1dedda90-aa46-47f3-ab49-5a0b13a802c6';

UPDATE public.risks
SET title = 'Parada não planejada de equipamento crítico',
    description = 'Falha mecânica ou elétrica interrompe a produção e atrasa a entrega dos lotes.',
    barriers = 'Plano preventivo, inspeções periódicas e disponibilidade de peças críticas.',
    owner = 'Equipe de Manutenção'
WHERE id = 'dc8fbf70-c74e-428d-b57a-e178c8fe996c';

UPDATE public.slas AS s
SET title = v.title, description = v.description,
    business_rules = v.business_rules, quality_criteria = v.quality_criteria,
    lead_time_hours = v.lead_time_hours, criticality = v.criticality::public.sla_criticality_level
FROM (VALUES
  ('e5defe2e-d54d-40a2-9978-a66a96d85132'::uuid,
   'Comunicação de condição insegura à Manutenção',
   'A Produção comunica condições inseguras identificadas durante a operação para análise da Manutenção.',
   'Registrar equipamento, localização, condição observada e medida imediata de contenção antes do encaminhamento.',
   'Registro identificável, descrição objetiva e confirmação de recebimento pela Manutenção.', 4, 'alta'),
  ('a371d115-7316-4a33-8d59-4339d2c905d2'::uuid,
   'Liberação de lote após inspeção',
   'A área de Produção conclui a inspeção e disponibiliza o resultado para a programação de expedição.',
   'A liberação exige registros de inspeção e identificação do lote.',
   'Resultados completos e lote rastreável antes da expedição.', 16, 'media'),
  ('6c7755dc-98e7-4c03-85c7-812b072ed443'::uuid,
   'Atendimento de manutenção corretiva',
   'A Manutenção atende falhas comunicadas pela Produção e registra a liberação do equipamento.',
   'A ordem de serviço deve informar sintoma, prioridade, intervenção e teste de retorno.',
   'Equipamento testado, condição segura e ordem de serviço concluída.', 8, 'media')
) AS v(id, title, description, business_rules, quality_criteria, lead_time_hours, criticality)
WHERE s.id = v.id;

-- Conteúdo alterado exige nova aprovação. O vínculo do tipo é retirado para
-- que novas notificações não tentem utilizar um SLA agora inativo.
UPDATE public.slas
SET status = 'Inativo', approval_state = 'draft', submitted_at = NULL, approved_at = NULL
WHERE id = 'e5defe2e-d54d-40a2-9978-a66a96d85132';

ALTER TABLE public.notification_types DISABLE TRIGGER guard_sla_notification_link;
UPDATE public.notification_types SET sla_id = NULL
WHERE id = '40f4e5a8-7efb-44e2-b18e-e27a58b6a283';
ALTER TABLE public.notification_types ENABLE TRIGGER guard_sla_notification_link;

-- O SLA em rascunho passa a representar a prestação da Manutenção à Produção.
UPDATE public.slas
SET supplier_process_id = '1eb4459e-4bfb-4e11-b701-cc0795faa153',
    client_process_id = '05133f8e-12ca-4c86-ba50-51ffb18cdcb3'
WHERE id = '6c7755dc-98e7-4c03-85c7-812b072ed443';

UPDATE public.notification_classifications AS c
SET name = v.name, code = v.code, description = v.description,
    sla_hours = v.sla_hours
FROM (VALUES
  ('f585aba3-69e5-4cad-8ca4-bdf2df65a081'::uuid, 'Não conformidade de qualidade', 'NCQ', 'Desvio de especificação identificado em produto ou processo.', 24),
  ('0c229f6d-a3c7-4f94-ab2c-d5014efc90fe'::uuid, 'Falha de matéria-prima', 'FMP', 'Insumo recebido fora dos requisitos de qualidade.', 24),
  ('4dbbe1f1-4062-4017-87df-bf35709f087a'::uuid, 'Atraso de entrega', 'ATR', 'Entrega interna ou externa fora do prazo acordado.', 8),
  ('54a34197-aa29-42f2-8ae7-87758618ce73'::uuid, 'Tratativa de evento de segurança', 'TES', 'Condição ou ocorrência que pode comprometer a segurança operacional.', 4)
) AS v(id, name, code, description, sla_hours)
WHERE c.id = v.id;

UPDATE public.notification_types
SET name = 'Ocorrência de segurança operacional',
    description = 'Registro de condição insegura em equipamento ou área de produção.'
WHERE id = '40f4e5a8-7efb-44e2-b18e-e27a58b6a283';

-- O código do tipo legado estava vazio; o gatilho mantém códigos em edições normais.
ALTER TABLE public.notification_types DISABLE TRIGGER notification_type_code;
UPDATE public.notification_types SET code = 'TES.0001'
WHERE id = '40f4e5a8-7efb-44e2-b18e-e27a58b6a283' AND code IS NULL;
ALTER TABLE public.notification_types ENABLE TRIGGER notification_type_code;
INSERT INTO public.operation_code_counters(scope, last_number) VALUES ('type:TES', 1)
ON CONFLICT (scope) DO UPDATE SET last_number = greatest(public.operation_code_counters.last_number, 1);

UPDATE public.tickets
SET title = 'Proteção de máquina removida durante a operação',
    description = 'Foi identificada a operação de equipamento com proteção de acesso removida.',
    classification_flag = 'Tratativa de evento de segurança',
    incident_type = 'Ocorrência de segurança operacional'
WHERE id = 'e13160d1-70e4-4420-8c40-3809fda9917f';

UPDATE public.tickets
SET title = 'Falha no bloqueio de equipamento para intervenção',
    description = 'O equipamento foi encaminhado para manutenção sem bloqueio e sinalização completos.',
    classification_flag = 'Tratativa de evento de segurança',
    incident_type = 'Ocorrência de segurança operacional'
WHERE id = '9b3acbd3-a3d1-487e-9d15-3595d02c9d3b';

INSERT INTO public.ticket_history(ticket_id, action, reason, before_data, after_data)
SELECT t.id, 'updated', 'Saneamento dos dados sintéticos de homologação', o.before_data, to_jsonb(t)
FROM public.tickets t JOIN _original_tickets o ON o.id = t.id
WHERE t.id IN ('e13160d1-70e4-4420-8c40-3809fda9917f',
               '9b3acbd3-a3d1-487e-9d15-3595d02c9d3b');

UPDATE public.helpdesk_tickets
SET title = 'Falha de acesso ao painel de indicadores',
    description = 'A equipe de Produção não consegue abrir o painel de indicadores após a autenticação.',
    requester_name = 'Equipe de Produção', assigned_to = 'Suporte de TI'
WHERE id = 'ec241f17-6248-4b96-bb5a-1ba43e9e196e';

UPDATE public.document_types AS t
SET name = v.name, acronym = v.acronym, updated_at = clock_timestamp()
FROM (VALUES
  ('4544cf5f-de7b-4497-8503-923c67417907'::uuid, 'Procedimento Operacional Padrão', 'POP'),
  ('a6d7a6d5-6910-434a-a511-60cfb21ff59d'::uuid, 'Instrução de Trabalho', 'IT')
) AS v(id, name, acronym)
WHERE t.id = v.id;

INSERT INTO public.document_type_history(type_id, action, justification, before_data, after_data)
SELECT t.id, 'updated', 'Saneamento dos dados sintéticos de homologação', o.before_data, to_jsonb(t)
FROM public.document_types t JOIN _original_document_types o ON o.id = t.id;

-- Mantém o código antigo em legacy_code e preserva a numeração de cada documento.
ALTER TABLE public.documents DISABLE TRIGGER assign_document_code;
UPDATE public.documents AS d
SET legacy_code = coalesce(d.legacy_code, d.code),
    code = p.code || '.' || t.acronym || '.' || split_part(d.code, '.', 3)
FROM public.processes p, public.document_types t
WHERE d.process_id = p.id AND d.type_id = t.id
  AND d.code ~ '^[A-Z]{3}\.[A-Z0-9]{2,8}\.[0-9]{3,}$';
ALTER TABLE public.documents ENABLE TRIGGER assign_document_code;

DELETE FROM public.document_code_counters
WHERE process_acronym IN ('SDG', 'WQT');
INSERT INTO public.document_code_counters(process_acronym, type_acronym, last_number)
SELECT p.code, t.acronym, max(split_part(d.code, '.', 3)::bigint)
FROM public.documents d
JOIN public.processes p ON p.id = d.process_id
JOIN public.document_types t ON t.id = d.type_id
GROUP BY p.code, t.acronym
ON CONFLICT (process_acronym, type_acronym) DO UPDATE
SET last_number = greatest(public.document_code_counters.last_number, EXCLUDED.last_number);

UPDATE public.documents AS d
SET title = v.title, updated_at = clock_timestamp()
FROM (VALUES
  ('62c2b56c-fb55-4abe-b367-36b07b46b7a6'::uuid, 'Arquivo legado de teste — inspeção de lote'),
  ('993a9b8c-7290-42ce-8bd2-f7424e8aed42'::uuid, 'Arquivo legado de teste — segurança de equipamento'),
  ('aa3c51af-e1c2-4285-a539-fe3c06c7129e'::uuid, 'Arquivo legado de teste — manutenção preventiva'),
  ('a9e31585-490e-482b-94e3-259b87fa372b'::uuid, 'Arquivo legado de teste — modelo importado'),
  ('8bff38bc-6a1f-43b0-9643-dfe676fb1900'::uuid, 'Instrução de inspeção visual do produto'),
  ('bc5c03b3-fbd9-4c48-8b5e-dade7d420499'::uuid, 'Instrução de registro de não conformidade')
) AS v(id, title)
WHERE d.id = v.id;

-- Os dois rascunhos nativos podem receber conteúdo novo sem invalidar PDFs publicados.
UPDATE public.documents AS d
SET content_json = jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', 'Objetivo: padronizar a inspeção visual antes da liberação do lote.'))),
      jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', 'Verifique identificação, integridade e acabamento das unidades conforme a especificação do produto. Registre os resultados e segregue itens não conformes.')))
    )),
    content_html = '<p>Objetivo: padronizar a inspeção visual antes da liberação do lote.</p><p>Verifique identificação, integridade e acabamento das unidades conforme a especificação do produto. Registre os resultados e segregue itens não conformes.</p>',
    content_revision = content_revision + 1, content_pdf_path = NULL,
    content_synced_version = NULL, updated_at = clock_timestamp()
WHERE d.id = '8bff38bc-6a1f-43b0-9643-dfe676fb1900' AND d.status = 'rascunho';

UPDATE public.documents AS d
SET content_json = jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', 'Objetivo: registrar e tratar desvios identificados na produção ou na inspeção.'))),
      jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', 'Identifique o lote, descreva o desvio, registre a contenção e encaminhe a análise de causa. A liberação depende da decisão da Qualidade.')))
    )),
    content_html = '<p>Objetivo: registrar e tratar desvios identificados na produção ou na inspeção.</p><p>Identifique o lote, descreva o desvio, registre a contenção e encaminhe a análise de causa. A liberação depende da decisão da Qualidade.</p>',
    content_revision = content_revision + 1, content_pdf_path = NULL,
    content_synced_version = NULL, updated_at = clock_timestamp()
WHERE d.id = 'bc5c03b3-fbd9-4c48-8b5e-dade7d420499' AND d.status = 'rascunho';

INSERT INTO public.document_workflows(document_id, from_status, to_status, notes, version)
SELECT id, status, status, 'Saneamento dos dados sintéticos de homologação', version
FROM public.documents;

UPDATE public.strategic_identity
SET mission = 'Produzir com segurança e qualidade, entregando produtos confiáveis e rastreáveis.',
    vision = 'Ser referência em eficiência operacional e melhoria contínua no setor industrial.',
    purpose = 'Gerar valor para clientes e colaboradores por meio de processos responsáveis.',
    values = 'Segurança; qualidade; transparência; colaboração; melhoria contínua.'
WHERE id = 'd8e1cb44-64b5-4603-a9e8-19422f13c654';

UPDATE public.swot_analyses
SET title = 'Análise SWOT da operação industrial', period = '2026',
    description = 'Avaliação dos fatores internos e externos que afetam a qualidade, a produção e a entrega.'
WHERE id = '624cb8c2-c141-467f-ac6a-7a2a241fa5aa';

UPDATE public.swot_items AS i
SET title = v.title, description = v.description
FROM (VALUES
  ('4f5486c6-c408-4c13-9e14-b2a203fd07e0'::uuid, 'Equipe experiente', 'Conhecimento técnico dos operadores e inspetores sobre o processo produtivo.'),
  ('e6985963-4054-4356-b8cf-ad7890375bf6'::uuid, 'Registros manuais dispersos', 'A consolidação manual dificulta rastreabilidade e análise rápida de desvios.'),
  ('07ac062c-e74c-4a32-80a9-6cb7d1fc59b2'::uuid, 'Digitalização da inspeção', 'O registro digital pode reduzir atrasos e melhorar a confiabilidade das evidências.'),
  ('89d3056d-1111-48cc-a0f3-0ad09916d56a'::uuid, 'Oscilação no fornecimento', 'Atrasos ou falhas em matérias-primas podem comprometer a programação de produção.')
) AS v(id, title, description)
WHERE i.id = v.id;

UPDATE public.pestel_analyses
SET title = 'Análise PESTEL da indústria', period = '2026',
    description = 'Monitoramento de fatores políticos, econômicos, sociais, tecnológicos, ambientais e legais.'
WHERE id = '5528967c-9db8-48f6-8fe0-cacbe71edd8b';

UPDATE public.porter_analyses
SET title = 'Cinco forças do mercado industrial', period = '2026',
    description = 'Avaliação de concorrência, fornecedores, clientes, entrantes e produtos substitutos.'
WHERE id = '48750982-e705-4a9e-98ca-b0bc34755b0c';

UPDATE public.environmental_analyses
SET title = 'Diagnóstico do ambiente de negócios',
    description = 'Síntese das análises estratégicas que orientam prioridades da operação industrial.'
WHERE id = '9c90f274-bf26-4c4a-be3a-be8240016b2a';

DO $$
BEGIN
  IF (SELECT count(*) FROM public.value_chain_categories) <> 3
     OR (SELECT count(*) FROM public.processes WHERE code IN ('PRD', 'MNT')) <> 2
     OR (SELECT count(*) FROM public.risks WHERE approval_state = 'draft') <> 2
     OR NOT EXISTS (SELECT 1 FROM public.slas
                    WHERE id = 'e5defe2e-d54d-40a2-9978-a66a96d85132'
                      AND approval_state = 'draft' AND status = 'Inativo')
     OR EXISTS (SELECT 1 FROM public.notification_types
                WHERE id = '40f4e5a8-7efb-44e2-b18e-e27a58b6a283' AND sla_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.documents d JOIN public.processes p ON p.id = d.process_id
                JOIN public.document_types t ON t.id = d.type_id
                WHERE d.code !~ ('^' || p.code || '\.' || t.acronym || '\.[0-9]{3,}$'))
     OR EXISTS (SELECT 1 FROM public.indicator_result_analyses a JOIN public.indicator_history h ON h.id = a.history_id
                WHERE (a.observed_value, a.observed_goal, a.observed_period)
                  IS DISTINCT FROM (h.value, h.goal, h.period)) THEN
    RAISE EXCEPTION 'Falha na verificação final; transação cancelada';
  END IF;
END $$;

SELECT 'categories' AS entity, count(*) AS records FROM public.value_chain_categories
UNION ALL SELECT 'processes', count(*) FROM public.processes
UNION ALL SELECT 'dimensions', count(*) FROM public.dimensions
UNION ALL SELECT 'risks_in_draft', count(*) FROM public.risks WHERE approval_state = 'draft'
UNION ALL SELECT 'documents', count(*) FROM public.documents;

COMMIT;
