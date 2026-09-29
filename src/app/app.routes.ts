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
  // {
  //   path: 'processos/gerenciamento',
  //   loadComponent: () =>
  //     import('@features/processes/process-management/process-management.component').then(
  //       (m) => m.ProcessManagementComponent,
  //     ),
  // },
  // {
  //   path: 'processos/sipoc',
  //   loadComponent: () =>
  //     import('@features/processes/sipoc/sipoc.component').then((m) => m.SipocComponent),
  // },
  // {
  //   path: 'processos/slas/painel',
  //   data: { mode: 'panel' },
  //   loadComponent: () =>
  //     import('@features/processes/slas/slas.component').then((m) => m.SlasComponent),
  // },
  // {
  //   path: 'processos/slas/gerenciamento',
  //   data: { mode: 'management' },
  //   loadComponent: () =>
  //     import('@features/processes/slas/slas.component').then((m) => m.SlasComponent),
  // },
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
    path: 'notificacoes/realizacao',
    data: { mode: 'realize' },
    loadComponent: () =>
      import('@features/notifications/notifications.component').then(
        (m) => m.NotificationsComponent,
      ),
  },
  {
    path: 'notificacoes/painel',
    data: { mode: 'panel' },
    loadComponent: () =>
      import('@features/notifications/notifications.component').then(
        (m) => m.NotificationsComponent,
      ),
  },
  {
    path: 'notificacoes/parametrizacao',
    data: { mode: 'settings' },
    loadComponent: () =>
      import('@features/notifications/notifications.component').then(
        (m) => m.NotificationsComponent,
      ),
  },
  {
    path: 'helpdesk',
    loadComponent: () =>
      import('@features/helpdesk/helpdesk.component').then((m) => m.HelpdeskComponent),
  },
  // {
  //   path: 'indicadores/painel',
  //   data: { mode: 'panel' },
  //   loadComponent: () =>
  //     import('@features/indicators/indicators.component').then((m) => m.IndicatorsComponent),
  // },
  // {
  //   path: 'indicadores/alimentacao',
  //   data: { mode: 'feed' },
  //   loadComponent: () =>
  //     import('@features/indicators/indicators.component').then((m) => m.IndicatorsComponent),
  // },
  {
    path: 'indicadores/analises',
    data: { mode: 'analysis' },
    loadComponent: () =>
      import('@features/indicators/indicators.component').then((m) => m.IndicatorsComponent),
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
  {
    path: 'motor-dinamico',
    data: { mode: 'engine' },
    loadComponent: () =>
      import('@features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'configuracoes',
    data: { mode: 'settings' },
    loadComponent: () =>
      import('@features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];
