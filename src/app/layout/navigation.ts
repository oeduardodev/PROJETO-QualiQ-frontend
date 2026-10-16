export interface NavLeaf {
  id: string;
  label: string;
  icon: string;
  route: string;
  adminOnly?: boolean;
}
export interface NavSubGroup {
  id: string;
  label: string;
  icon: string;
  leaves: NavLeaf[];
}
export interface NavGroup {
  id: string;
  label: string;
  color: string;
  items: NavSubGroup[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'planejamento',
    label: 'Estratégia',
    color: 'bg-blue-400',
    items: [
      {
        id: 'valor',
        label: 'Matriz de Valor',
        icon: 'Grid3X3',
        leaves: [{ id: 'valor', label: 'Matriz de Valor', icon: 'Grid3X3', route: 'valor' }],
      },
      {
        id: 'dimensoes',
        label: 'Dimensões',
        icon: 'Layers',
        leaves: [{ id: 'dimensoes', label: 'Dimensões', icon: 'Layers', route: 'dimensoes' }],
      },
    ],
  },
  {
    id: 'monitoramento',
    label: 'Monitoramento',
    color: 'bg-amber-400',
    items: [
      {
        id: 'indicadores-group',
        label: 'Gestão de Indicadores',
        icon: 'Target',
        leaves: [
          {
            id: 'indicadores/painel',
            label: 'Painel de Indicadores',
            icon: 'ChartLine',
            route: 'indicadores/painel',
          },
          {
            id: 'indicadores/alimentacao',
            label: 'Alimentação e Análise Crítica',
            icon: 'SlidersHorizontal',
            route: 'indicadores/alimentacao',
          },
          {
            id: 'indicadores/cadastro',
            label: 'Ficha do Indicador (Admin)',
            icon: 'Target',
            route: 'indicadores/cadastro',
            adminOnly: true,
          },
        ],
      },
    ],
  },
  {
    id: 'execucao',
    label: 'Operação',
    color: 'bg-emerald-400',
    items: [
      {
        id: 'processos-group',
        label: 'Gestão de Processos',
        icon: 'GitBranch',
        leaves: [
          {
            id: 'processos/gerenciamento',
            label: 'Gerenciamento de Processos',
            icon: 'GitBranch',
            route: 'processos/gerenciamento',
            adminOnly: true,
          },
          {
            id: 'processos/sipoc',
            label: 'SIPOC e Mapeamento',
            icon: 'GitBranch',
            route: 'processos/sipoc',
          },
          {
            id: 'processos/slas/painel',
            label: 'Painel de SLAs',
            icon: 'Gauge',
            route: 'processos/slas/painel',
          },
          {
            id: 'processos/slas/gerenciamento',
            label: 'Gerenciamento de SLAs',
            icon: 'Gauge',
            route: 'processos/slas/gerenciamento',
          },
        ],
      },
      {
        id: 'riscos-group',
        label: 'Gestão de Riscos',
        icon: 'Shield',
        leaves: [
          {
            id: 'riscos/painel',
            label: 'Painel de Riscos (Matriz)',
            icon: 'Shield',
            route: 'riscos/painel',
          },
          {
            id: 'riscos/gerenciamento',
            label: 'Gerenciamento de Riscos (Admin)',
            icon: 'Shield',
            route: 'riscos/gerenciamento',
            adminOnly: true,
          },
        ],
      },
      {
        id: 'documentos',
        label: 'Gestão de Documentos',
        icon: 'FileText',
        leaves: [
          {
            id: 'documentos/painel',
            label: 'Painel de Documentos Públicos',
            icon: 'BookOpen',
            route: 'documentos/painel',
          },
          {
            id: 'documentos/hierarquia',
            label: 'Hierarquia e Parametrização',
            icon: 'Pyramid',
            route: 'documentos/hierarquia',
          },
          {
            id: 'documentos/gerenciamento',
            label: 'Gerenciamento de Documentos',
            icon: 'Workflow',
            route: 'documentos/gerenciamento',
            adminOnly: true,
          },
          {
            id: 'documentos/copias',
            label: 'Controle de Cópias',
            icon: 'Printer',
            route: 'documentos/copias',
            adminOnly: true,
          },
        ],
      },
      {
        id: 'notificacoes-group',
        label: 'Gestão de Notificações',
        icon: 'Bell',
        leaves: [
          {
            id: 'notificacoes/realizacao',
            label: 'Realizar Notificação',
            icon: 'Bell',
            route: 'notificacoes/realizacao',
          },
          {
            id: 'notificacoes/painel',
            label: 'Painel de Notificações',
            icon: 'TriangleAlert',
            route: 'notificacoes/painel',
          },
          {
            id: 'notificacoes/parametrizacao',
            label: 'Parametrização e Tipos (Admin)',
            icon: 'SlidersHorizontal',
            route: 'notificacoes/parametrizacao',
            adminOnly: true,
          },
        ],
      },
      {
        id: 'helpdesk',
        label: 'Helpdesk',
        icon: 'Headphones',
        leaves: [{ id: 'helpdesk', label: 'Helpdesk', icon: 'Headphones', route: 'helpdesk' }],
      },
    ],
  },
  {
    id: 'acao',
    label: 'Melhoria',
    color: 'bg-rose-400',
    items: [
      {
        id: 'planos-acao',
        label: 'Planos de Ação',
        icon: 'ClipboardList',
        leaves: [
          {
            id: 'planos-acao',
            label: 'Planos de Ação',
            icon: 'ClipboardList',
            route: 'planos-acao',
          },
        ],
      },
    ],
  },
];

export const ROUTE_SUBTITLES: Record<string, string> = {
  dashboard: 'Visão geral do sistema de gestão da qualidade',
  valor: 'Avaliação estratégica de processos',
  dimensoes: 'Dimensões estratégicas com indicadores e planos vinculados ao SIPOC',
  'processos/gerenciamento': 'Cadastro, histórico e obsolescência de processos',
  'processos/sipoc':
    'Mapeamento de processos — Fornecedores, Entradas, Processo, Saídas e Clientes',
  'processos/slas/painel': 'Acordos de nível de serviço entre processos — acompanhamento',
  'processos/slas/gerenciamento': 'Cadastro e edição de SLAs entre processos (CRUD completo)',
  'documentos/painel': 'Documentos publicados e disponíveis para consulta',
  'documentos/hierarquia': 'Pirâmide documental, SLAs e matriz de responsabilidades',
  'documentos/gerenciamento': 'Workflow de documentos — rascunho, revisão, aprovação e obsoletos',
  'documentos/copias': 'Gestão de cópias controladas (impressão)',
  'notificacoes/realizacao':
    'Preencha o formulário parametrizado para registrar uma nova notificação',
  'notificacoes/painel':
    'Acompanhamento de notificações registradas — fluxo de trabalho e análise de causa raiz',
  'notificacoes/parametrizacao':
    'Criação de tipos de notificação, vínculos com SLAs e riscos, e construção de formulários dinâmicos',
  helpdesk: 'Chamados de TI, Manutenção e Almoxarifado',
  'riscos/painel': 'Gestão de riscos com matriz de probabilidade x impacto (FMEA)',
  'riscos/gerenciamento':
    'Gerenciamento de riscos, fatores, ações preventivas e planos de contingência',
  'indicadores/painel': 'Dashboard de indicadores com gráficos cruzados e comparação de evolução',
  'indicadores/alimentacao': 'Lançamento de resultados, análises críticas e sugestões da IA',
  'indicadores/cadastro': 'Cadastro e configuração de indicadores',
  'planos-acao': 'Planos de ação estruturados pelo método 5W2H em quadro Kanban',
};

export function visibleNavigation(isOperator: boolean, isAdmin: boolean): NavGroup[] {
  if (isAdmin) return NAV_GROUPS;
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .map((item) => ({
        ...item,
        leaves: item.leaves.filter(
          (leaf) =>
            leaf.id !== 'processos/gerenciamento' &&
            (!isOperator || (!leaf.adminOnly && leaf.id !== 'processos/slas/gerenciamento')),
        ),
      }))
      .filter((item) => item.leaves.length),
  })).filter((group) => group.items.length);
}
