import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('@features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'valor',
    loadComponent: () =>
      import('@features/strategy/value-matrix/value-matrix.component').then(
        (m) => m.ValueMatrixComponent,
      ),
  },
  {
    path: 'dimensoes',
    loadComponent: () =>
      import('@features/strategy/dimensions/dimensions.component').then(
        (m) => m.DimensionsComponent,
      ),
  },
  {
    path: 'processos/gerenciamento',
    loadComponent: () =>
      import('@features/processes/process-management/process-management.component').then(
        (m) => m.ProcessManagementComponent,
      ),
  },
  {
    path: 'processos/sipoc',
    loadComponent: () =>
      import('@features/processes/sipoc/sipoc.component').then((m) => m.SipocComponent),
  },
  {
    path: 'processos/slas/painel',
    data: { mode: 'panel' },
    loadComponent: () =>
      import('@features/processes/slas/slas.component').then((m) => m.SlasComponent),
  },
  {
    path: 'processos/slas/gerenciamento',
    data: { mode: 'management' },
    loadComponent: () =>
      import('@features/processes/slas/slas.component').then((m) => m.SlasComponent),
  },
  {
    path: 'riscos/painel',
    data: { mode: 'panel' },
    loadComponent: () => import('@features/risks/risks.component').then((m) => m.RisksComponent),
  },
  {
    path: 'riscos/gerenciamento',
    data: { mode: 'management' },
    loadComponent: () => import('@features/risks/risks.component').then((m) => m.RisksComponent),
  },
  {
    path: 'documentos/painel',
    data: { mode: 'panel' },
    loadComponent: () =>
      import('@features/documents/documents.component').then((m) => m.DocumentsComponent),
  },
  {
    path: 'documentos/hierarquia',
    data: { mode: 'hierarchy' },
    loadComponent: () =>
      import('@features/documents/documents.component').then((m) => m.DocumentsComponent),
  },
  {
    path: 'documentos/gerenciamento',
    canDeactivate: [
      (component: { leaveEditor: () => Promise<boolean> }) => component.leaveEditor(),
    ],
    data: { mode: 'management' },
    loadComponent: () =>
      import('@features/documents/documents.component').then((m) => m.DocumentsComponent),
  },
  {
    path: 'documentos/copias',
    data: { mode: 'copies' },
    loadComponent: () =>
      import('@features/documents/documents.component').then((m) => m.DocumentsComponent),
  },
  {
    path: 'incidentes/realizacao',
    data: { mode: 'realize' },
    loadComponent: () =>
      import('@features/incidents/incidents.component').then((m) => m.IncidentsComponent),
  },
  {
    path: 'incidentes/painel',
    data: { mode: 'panel' },
    loadComponent: () =>
      import('@features/incidents/incidents.component').then((m) => m.IncidentsComponent),
  },
  {
    path: 'incidentes/parametrizacao',
    data: { mode: 'settings' },
    loadComponent: () =>
      import('@features/incidents/incidents.component').then((m) => m.IncidentsComponent),
  },
  // Preserve bookmarked links and routes stored in the operation inbox.
  {
    path: 'notificacoes/realizacao',
    redirectTo: 'incidentes/realizacao',
    pathMatch: 'full',
  },
  {
    path: 'notificacoes/painel',
    redirectTo: 'incidentes/painel',
    pathMatch: 'full',
  },
  {
    path: 'notificacoes/parametrizacao',
    redirectTo: 'incidentes/parametrizacao',
    pathMatch: 'full',
  },
  {
    path: 'helpdesk',
    loadComponent: () =>
      import('@features/helpdesk/helpdesk.component').then((m) => m.HelpdeskComponent),
  },
  {
    path: 'indicadores/painel',
    loadComponent: () =>
      import('@features/indicators/indicator-panel.component').then(
        (m) => m.IndicatorPanelComponent,
      ),
  },
  {
    path: 'indicadores/alimentacao',
    data: { mode: 'feed' },
    loadComponent: () =>
      import('@features/indicators/indicators.component').then((m) => m.IndicatorsComponent),
  },
  {
    path: 'indicadores/analises',
    redirectTo: 'indicadores/alimentacao',
    pathMatch: 'full',
  },
  {
    path: 'indicadores/cadastro',
    data: { mode: 'registration' },
    loadComponent: () =>
      import('@features/indicators/indicators.component').then((m) => m.IndicatorsComponent),
  },
  {
    path: 'planos-acao',
    loadComponent: () =>
      import('@features/actions/action-plans.component').then((m) => m.ActionPlansComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];
