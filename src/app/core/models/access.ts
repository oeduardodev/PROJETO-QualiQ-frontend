export interface AccessPage {
  key: string;
  label: string;
  module: string;
}

// The route is the permission key. Keep this list aligned with app.routes.ts.
export const ACCESS_PAGES: AccessPage[] = [
  { key: 'dashboard', label: 'Dashboard', module: 'dashboard' },
  { key: 'valor', label: 'Matriz de Valor', module: 'strategy' },
  { key: 'dimensoes', label: 'Dimensões', module: 'strategy' },
  { key: 'indicadores/painel', label: 'Painel de Indicadores', module: 'indicators' },
  { key: 'indicadores/alimentacao', label: 'Alimentação e Análise Crítica', module: 'indicators' },
  { key: 'indicadores/cadastro', label: 'Ficha do Indicador', module: 'indicators' },
  { key: 'processos/gerenciamento', label: 'Gerenciamento de Processos', module: 'processes' },
  { key: 'processos/sipoc', label: 'SIPOC e Mapeamento', module: 'processes' },
  { key: 'processos/slas/painel', label: 'Painel de SLAs', module: 'slas' },
  { key: 'processos/slas/gerenciamento', label: 'Gerenciamento de SLAs', module: 'slas' },
  { key: 'riscos/painel', label: 'Painel de Riscos', module: 'risks' },
  { key: 'riscos/gerenciamento', label: 'Gerenciamento de Riscos', module: 'risks' },
  { key: 'documentos/painel', label: 'Painel de Documentos', module: 'documents' },
  { key: 'documentos/hierarquia', label: 'Hierarquia e Parametrização', module: 'documents' },
  { key: 'documentos/gerenciamento', label: 'Gerenciamento de Documentos', module: 'documents' },
  { key: 'documentos/copias', label: 'Controle de Cópias', module: 'documents' },
  { key: 'incidentes/realizacao', label: 'Registrar Incidente', module: 'incidents' },
  { key: 'incidentes/painel', label: 'Painel de Incidentes', module: 'incidents' },
  { key: 'incidentes/parametrizacao', label: 'Parametrização e Tipos', module: 'incidents' },
  { key: 'helpdesk', label: 'Helpdesk', module: 'helpdesk' },
  { key: 'planos-acao', label: 'Planos de Ação', module: 'action_plans' },
  { key: 'pesquisas/painel', label: 'Painel de Pesquisas', module: 'surveys' },
  { key: 'pesquisas/parametrizacao', label: 'Parametrização de Pesquisas', module: 'surveys' },
  { key: 'formularios/painel', label: 'Painel de Formulários', module: 'form_builder' },
  { key: 'formularios/construcao', label: 'Construção de Formulários', module: 'form_builder' },
  { key: 'usuarios', label: 'Usuários e Acessos', module: 'users' },
  { key: 'educacao/painel', label: 'Painel de Educação', module: 'education' },
  { key: 'educacao/treinamentos', label: 'Treinamentos e Trilhas', module: 'education' },
  { key: 'educacao/gerenciamento', label: 'Montagem de Treinamentos', module: 'education' },
];

export const ACCESS_MODULES = [...new Set(ACCESS_PAGES.map((page) => page.module))];

export function pageModule(page: string): string | undefined {
  return ACCESS_PAGES.find((entry) => entry.key === page)?.module;
}
