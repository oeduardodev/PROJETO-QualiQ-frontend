export interface MethodologyInfo {
  title: string;
  methodology: string;
  reference: string;
  summary: string;
  steps: string[];
  source?: string;
}

export const METHODOLOGIES: Record<string, MethodologyInfo> = {
  dashboard: {
    title: 'Dashboard da Qualidade',
    methodology: 'Sistema de Gestão da Qualidade (SGQ) — ISO 9001',
    reference:
      'ABNT NBR ISO 9001:2015 — Cláusula 9.1 (Monitoramento, medição, análise e avaliação)',
    summary:
      'O Dashboard consolida indicadores-chave de desempenho (KPIs) da qualidade em um painel único, seguindo o princípio de decisão baseada em evidências da ISO 9001. Permite a visualização rápida do estado do sistema de gestão e identificação de tendências.',
    steps: [
      'Definir indicadores de desempenho alinhados aos objetivos da qualidade',
      'Coletar dados de monitoramento dos processos mapeados',
      'Analisar resultados e comparar com metas estabelecidas',
      'Identificar desvios e oportunidades de melhoria contínua',
    ],
    source: 'ISO 9001:2015 — Sistemas de Gestão da Qualidade',
  },
  valor: {
    title: 'Matriz de Valor — Cadeia de Valor',
    methodology: 'Cadeia de Valor de Porter',
    reference: 'Michael Porter, "Competitive Advantage" (1985) — Capítulo 2: The Value Chain',
    summary:
      'A Cadeia de Valor de Porter divide as atividades da organização em processos Gerenciais (estratégicos), Finalísticos (core, que geram valor direto ao cliente) e de Apoio (suporte). Cada categoria recebe uma avaliação de impacto, complexidade e maturidade, permitindo priorizar iniciativas de melhoria.',
    steps: [
      'Identificar e categorizar todos os processos da organização',
      'Avaliar o impacto de cada processo no valor entregue ao cliente',
      'Medir a complexidade operacional de cada processo',
      'Classificar o nível de maturidade (1 a 5) de cada processo',
      'Priorizar ações de melhoria com base na matriz impacto × complexidade × maturidade',
    ],
    source:
      'Porter, M. E. (1985). Competitive Advantage: Creating and Sustaining Superior Performance.',
  },
  sipoc: {
    title: 'SIPOC — Mapeamento de Processos',
    methodology: 'Metodologia SIPOC (Six Sigma / DMAIC)',
    reference: 'ASQ — American Society for Quality: SIPOC Diagram',
    summary:
      'O SIPOC é uma ferramenta do conjunto Six Sigma utilizada na fase "Define" do método DMAIC. Mapeia Fornecedores (S), Entradas (I), Processo (P), Saídas (O) e Clientes (C) para visualizar o fluxo completo de um processo e identificar gargalos, falhas e oportunidades de melhoria.',
    steps: [
      'Identificar o processo a ser mapeado e seu escopo',
      'Listar os Fornecedores (S) que provêm recursos ao processo',
      'Listar as Entradas (I) necessárias para o processo funcionar',
      'Descrever o Processo (P) principal com suas etapas-chave',
      'Listar as Saídas (O) geradas pelo processo',
      'Identificar os Clientes (C) que recebem as saídas',
    ],
    source: 'ASQ Quality Resources — SIPOC Diagram (asq.org/learn-about-quality/six-sigma)',
  },
  tickets: {
    title: 'Gestão de Não-conformidades e Chamados',
    methodology: 'PDCA + Diagrama de Ishikawa (Diagrama de Causa e Efeito)',
    reference: 'Kaoru Ishikawa, "Guide to Quality Control" (1968) — Diagrama 6M',
    summary:
      'A gestão de não-conformidades segue o ciclo PDCA (Plan-Do-Check-Act) da melhoria contínua. Cada chamado é vinculado a um processo da Cadeia de Valor e analisado com o Diagrama de Ishikawa (Espinha de Peixe), que categoriza as causas raiz em 6M: Máquina, Método, Mão de obra, Material, Meio ambiente e Medida.',
    steps: [
      'Registrar a não-conformidade e vinculá-la ao processo de origem',
      'Classificar a severidade (Baixa, Média, Alta, Crítica)',
      'Mover o chamado pelo fluxo: Aberto → Em Análise → Plano de Ação → Concluído',
      'Preencher o Diagrama de Ishikawa (6M) para identificar a causa raiz',
      'Definir e executar o plano de ação corretiva',
      'Verificar a eficácia e encerrar o chamado (Concluído)',
    ],
    source: 'Ishikawa, K. (1968). Guide to Quality Control. JUSE Press.',
  },
  'planos-acao': {
    title: 'Planos de Ação — Método 5W2H',
    methodology: '5W2H (What, Why, Where, When, Who, How, How Much)',
    reference: 'ISO 9001:2015 — Cláusula 10.2 (Não-conformidade e ação corretiva)',
    summary:
      'O 5W2H é uma ferramenta de planejamento estruturado que desdobra uma ação em sete dimensões fundamentais: O que (What), Por que (Why), Onde (Where), Quando (When), Quem (Who), Como (How) e Quanto custa (How Much). Garante que todo plano de ação corretiva seja completo, rastreável e mensurável, conectando a investigação da causa raiz (Ishikawa) à execução da solução.',
    steps: [
      'Definir O QUE será feito (ação concreta)',
      'Justificar POR QUE a ação é necessária (motivo)',
      'Especificar ONDE a ação será executada (local)',
      'Estabelecer QUANDO a ação deve ser concluída (prazo)',
      'Atribuir QUEM será o responsável pela execução',
      'Detalhar COMO a ação será executada (método/etapas)',
      'Estimar QUANTO a ação custará (orçamento)',
      'Monitorar o status: Pendente → Em Andamento → Concluído (ou Atrasado)',
    ],
    source: 'ISO 9001:2015 — Cláusula 10.2: Não-conformidade e ação corretiva',
  },
  indicadores: {
    title: 'Indicadores — Gestão de Desempenho (KPIs)',
    methodology: 'Balanced Scorecard — Indicadores-Chave de Desempenho (KPIs)',
    reference: 'Kaplan & Norton, "The Balanced Scorecard" (1996)',
    summary:
      'O Balanced Scorecard traduz a estratégia em indicadores-chave de desempenho (KPIs) distribuídos em perspectivas equilibradas. Cada KPI é vinculado a um processo da cadeia de valor, possui uma meta (goal_value) e um valor atual (current_value), permitindo monitorar o gap de desempenho e disparar ações corretivas quando o indicador sai da zona de tolerância.',
    steps: [
      'Definir o indicador (KPI) e vinculá-lo ao processo de origem',
      'Estabelecer a meta (goal_value) e a unidade de medida',
      'Registrar o valor atual (current_value) periodicamente',
      'Comparar valor atual com a meta e classificar o status (No Alvo, Atenção, Crítico)',
      'Disparar planos de ação quando o indicador entrar em zona crítica',
      'Revisar e atualizar metas periodicamente (ciclo de melhoria contínua)',
    ],
    source:
      'Kaplan, R. S.; Norton, D. P. (1996). The Balanced Scorecard: Translating Strategy into Action.',
  },
  'analises-criticas': {
    title: 'Análises Críticas — Inteligência Artificial',
    methodology: 'Análise Crítica Assistida por IA (Cruzamento de Dados da Qualidade)',
    reference: 'ISO 9001:2015 — Cláusula 9.3 (Análise Crítica pelo Sistema de Gestão)',
    summary:
      'A Análise Crítica cruzada utiliza inteligência artificial para conectar dados de múltiplos módulos do SGQ — indicadores (KPIs), não-conformidades (tickets) e suas análises de causa raiz (Ishikawa 6M) — identificando padrões ocultos e gerando diagnósticos automáticos com sugestões de planos de ação 5W2H. A IA analisa o gap de desempenho, a frequência de desvios e as causas raiz reportadas para priorizar ações corretivas.',
    steps: [
      'Selecionar um indicador em status de Atenção ou Crítico',
      'A IA recupera as não-conformidades vinculadas ao mesmo processo',
      'Cruza as causas raiz (Ishikawa 6M) dos chamados com o gap do indicador',
      'Gera um diagnóstico textual com correlações identificadas',
      'Propõe 2 planos de ação 5W2H estruturados para corrigir as causas',
      'O usuário aprova e o sistema cria os planos de ação automaticamente',
    ],
    source: 'ISO 9001:2015 — Cláusula 9.3: Análise Crítica pelo Sistema de Gestão da Qualidade',
  },
  dimensoes: {
    title: 'Dimensões Estratégicas — Balanced Scorecard',
    methodology: 'Balanced Scorecard — Perspectivas Estratégicas',
    reference:
      'Kaplan & Norton, "The Balanced Scorecard" (1996) — Capítulo 1: The Four Perspectives',
    summary:
      'As Dimensões Estratégicas agrupam indicadores e planos de ação por perspectiva do Balanced Scorecard (ex: Financeira, Clientes, Processos Internos, Aprendizado e Crescimento). Cada item vinculado a uma dimensão é obrigatoriamente associado a um processo do SIPOC, garantindo rastreabilidade entre a estratégia e a operação.',
    steps: [
      'Criar dimensões que representam as perspectivas estratégicas da organização',
      'Vincular indicadores (KPIs) a cada dimensão, associando-os a um processo do SIPOC',
      'Vincular planos de ação (5W2H) às dimensões correspondentes',
      'Visualizar o agrupamento estratégico e monitorar o desempenho por dimensão',
      'Garantir que todo indicador e plano tenha rastreabilidade ao processo operacional',
    ],
    source:
      'Kaplan, R. S.; Norton, D. P. (1996). The Balanced Scorecard: Translating Strategy into Action.',
  },
  swot: {
    title: 'Análise SWOT — Matriz de Positionamento Estratégico',
    methodology: 'SWOT (Strengths, Weaknesses, Opportunities, Threats) + Cruzamento FOFA',
    reference:
      'Albert Humphrey, SRI International (1960s); Andrews, R. (1971). The Strategy of Corporate Business. Harvard Business Review.',
    summary:
      'A análise SWOT classifica os fatores que influenciam o desempenho da organização em quatro quadrantes: Fatores Internos Positivos (Forças), Fatores Internos Negativos (Fraquezas), Fatores Externos Positivos (Oportunidades) e Fatores Externos Negativos (Ameaças). Cada análise é versionada por período, permitindo comparar revisões do mesmo exercício estratégico. O cruzamento FOFA combina os quadrantes em quatro estratégias de ação: FO (Forças x Oportunidades — usar as forças para aproveitar as oportunidades), FA (Forças x Ameaças — usar as forças para enfrentar as ameaças), OA (Oportunidades x Fraquezas — usar as oportunidades para superar as fraquezas) e AF (Ameaças x Fraquezas — reduzir as fraquezas expostas às ameaças). Cada fator registrado alimenta automaticamente as duas estratégias em que participa, servindo de insumo para os planos de ação do módulo.',
    steps: [
      'Definir o escopo e o período da análise (ex: SWOT 2026 — 1º semestre)',
      'Reunir o comitê diretivo e listar fatores internos (forças e fraquezas) sob controle da organização',
      'Listar fatores externos (oportunidades e ameaças) do ambiente de mercado, regulatório e tecnológico',
      'Priorizar os fatores mais relevantes e descrevê-los com evidências no painel 2x2',
      'Revisar o cruzamento FOFA para definir as estratégias que cada combinação origina',
      'Exportar ou imprimir o painel aprovado e converter as estratégias em planos de ação 5W2H',
    ],
    source:
      'ISO 9001:2015 — Cláusula 4.4 (Processos) e 6.1 (Ações para abordar riscos e oportunidades); Kaplan & Norton (1996).',
  },
  helpdesk: {
    title: 'Helpdesk — TI, Manutenção e Almoxarifado',
    methodology: 'ITIL — Gerenciamento de Incidentes e Requisições',
    reference: 'ITIL v4 — Practice Guides: Incident Management & Service Request Management',
    summary:
      'O Helpdesk centraliza chamados de TI, Manutenção e Almoxarifado seguindo as práticas do ITIL. Cada chamado é categorizado, priorizado e movido pelo fluxo Aberto → Em Andamento → Resolvido → Fechado. O vínculo opcional a um processo do SIPOC mantém a rastreabilidade com o sistema de gestão da qualidade.',
    steps: [
      'Registrar o chamado com título, descrição e categoria (TI, Manutenção, Almoxarifado)',
      'Definir prioridade (Baixa, Média, Alta, Urgente) e atribuir responsável',
      'Mover o chamado pelo fluxo: Aberto → Em Andamento → Resolvido → Fechado',
      'Vincular opcionalmente a um processo do SIPOC para rastreabilidade',
      'Monitorar indicadores de atendimento (tempo de resolução, taxa de fechamento)',
    ],
    source: 'ITIL v4 Foundation: Incident Management & Service Request Management',
  },
  riscos: {
    title: 'Gestão de Riscos — Matriz de Riscos (FMEA)',
    methodology: 'FMEA (Failure Mode and Effects Analysis) + Matriz de Riscos',
    reference: 'ISO 31000:2018 — Risk Management Guidelines; FMEA Manual (AIAG & VDA)',
    summary:
      'A Gestão de Riscos segue a abordagem FMEA (Failure Mode and Effects Analysis), avaliando cada risco pela sua Probabilidade (1-5) e Impacto (1-5). O produto desses dois fatores gera o Score do Risco, classificado em Baixo (1-4), Moderado (5-9), Alto (10-15) e Crítico (16-25). Para cada risco, levantam-se os Fatores de Risco, as Ações Preventivas para reduzir a probabilidade, e os Planos de Contingência para responder caso o risco se materialize. Os riscos são vinculados a processos e subprocessos do SIPOC, garantindo rastreabilidade completa.',
    steps: [
      'Identificar o risco e vinculá-lo a um processo do SIPOC (e opcionalmente a um subprocesso)',
      'Avaliar a Probabilidade (1-5) e o Impacto (1-5) — o Score é calculado automaticamente',
      'Classificar o risco pelo nível: Baixo, Moderado, Alto ou Crítico',
      'Levantar os Fatores de Risco que contribuem para a ocorrência',
      'Definir Ações Preventivas para reduzir a probabilidade de ocorrência',
      'Estabelecer Planos de Contingência para responder se o risco se materializar',
      'Visualizar todos os riscos na Matriz de Riscos (Probabilidade x Impacto)',
      'Monitorar e atualizar o status: Identificado → Em Análise → Tratado → Monitorado',
    ],
    source: 'ISO 31000:2018 — Risk Management; AIAG & VDA FMEA Handbook (2019).',
  },
};
