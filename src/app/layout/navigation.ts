export interface NavLeaf {
  id: string;
  label: string;
  icon: string;
  route: string;
  adminOnly?: boolean;
}

function moduleForRoute(route: string): string {
  if (route === 'dashboard') return 'dashboard';
  if (route === 'valor' || route === 'dimensoes') return 'strategy';
  if (route.startsWith('indicadores/')) return 'indicators';
  if (route.startsWith('processos/slas/')) return 'slas';
  if (route.startsWith('processos/')) return 'processes';
  if (route.startsWith('riscos/')) return 'risks';
  if (route.startsWith('documentos/')) return 'documents';
  if (route.startsWith('incidentes/')) return 'incidents';
  if (route === 'helpdesk') return 'helpdesk';
  if (route === 'planos-acao') return 'action_plans';
  if (route === 'usuarios') return 'users';
  return 'dashboard';
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
    color: 'bg-blue-300',
    items: [
      {
        id: 'indicadores-group',
        label: 'Indicadores',
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
        label: 'Processos',
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
        label: 'Riscos',
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
        label: 'Documentos',
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
        id: 'incidentes-group',
        label: 'Incidentes',
        icon: 'TriangleAlert',
        leaves: [
          {
            id: 'incidentes/realizacao',
            label: 'Registrar Incidente',
            icon: 'ClipboardList',
            route: 'incidentes/realizacao',
          },
          {
            id: 'incidentes/painel',
            label: 'Painel de Incidentes',
            icon: 'TriangleAlert',
            route: 'incidentes/painel',
          },
          {
            id: 'incidentes/parametrizacao',
            label: 'Parametrização e Tipos (Admin)',
            icon: 'SlidersHorizontal',
            route: 'incidentes/parametrizacao',
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
    color: 'bg-emerald-500',
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
  {
    id: 'administracao',
    label: 'Administração',
    color: 'bg-blue-600',
    items: [
      {
        id: 'usuarios',
        label: 'Usuários',
        icon: 'Users',
        leaves: [
          {
            id: 'usuarios',
            label: 'Usuários e acessos',
            icon: 'Users',
            route: 'usuarios',
            adminOnly: true,
          },
        ],
      },
    ],
  },
];

export const ROUTE_SUBTITLES: Record<string, string> = {
  dashboard: 'Visão geral do sistema de gestão da qualidade',
  usuarios: 'Perfis, responsabilidades e módulos de acesso',
  perfil: 'Seus dados pessoais e preferências',
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
  'incidentes/realizacao': 'Preencha o formulário parametrizado para registrar um novo incidente',
  'incidentes/painel':
    'Acompanhamento de incidentes registrados — fluxo de trabalho e análise de causa raiz',
  'incidentes/parametrizacao':
    'Criação de tipos de incidente, vínculos com SLAs e riscos, e construção de formulários dinâmicos',
  helpdesk: 'Chamados de TI, Manutenção e Almoxarifado',
  'riscos/painel': 'Gestão de riscos com matriz de probabilidade x impacto (FMEA)',
  'riscos/gerenciamento':
    'Gerenciamento de riscos, fatores, ações preventivas e planos de contingência',
  'indicadores/painel': 'Dashboard de indicadores com gráficos cruzados e comparação de evolução',
  'indicadores/alimentacao': 'Lançamento de resultados, análises críticas e sugestões da IA',
  'indicadores/cadastro': 'Cadastro e configuração de indicadores',
  'planos-acao': 'Planos de ação estruturados pelo método 5W2H em quadro Kanban',
};

export function visibleNavigation(
  isOperator: boolean,
  isAdmin: boolean,
  hasModuleAccess: (module: string) => boolean,
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .map((item) => ({
        ...item,
        leaves: item.leaves.filter(
          (leaf) =>
            (!leaf.adminOnly || isAdmin) &&
            hasModuleAccess(moduleForRoute(leaf.route)) &&
            (isAdmin || leaf.id !== 'processos/gerenciamento') &&
            (!isOperator || (!leaf.adminOnly && leaf.id !== 'processos/slas/gerenciamento')),
        ),
      }))
      .filter((item) => item.leaves.length),
  })).filter((group) => group.items.length);
}
