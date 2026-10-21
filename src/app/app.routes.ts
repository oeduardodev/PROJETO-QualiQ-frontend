import { Routes } from '@angular/router';
import { moduleAccessGuard } from '@core/guards/module-access.guard';

export const routes: Routes = [
  {
    path: 'dashboard',
    canActivate: [moduleAccessGuard],
    data: { module: 'dashboard' },
    loadComponent: () =>
      import('@features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'valor',
    canActivate: [moduleAccessGuard],
    data: { module: 'strategy' },
    loadComponent: () =>
      import('@features/strategy/value-matrix/value-matrix.component').then(
        (m) => m.ValueMatrixComponent,
      ),
  },
  {
    path: 'dimensoes',
    canActivate: [moduleAccessGuard],
    data: { module: 'strategy' },
    loadComponent: () =>
      import('@features/strategy/dimensions/dimensions.component').then(
        (m) => m.DimensionsComponent,
      ),
  },
  {
    path: 'processos/gerenciamento',
    canActivate: [moduleAccessGuard],
    data: { module: 'processes', adminOnly: true },
    loadComponent: () =>
      import('@features/processes/process-management/process-management.component').then(
        (m) => m.ProcessManagementComponent,
      ),
  },
  {
    path: 'processos/sipoc',
    canActivate: [moduleAccessGuard],
    data: { module: 'processes' },
    loadComponent: () =>
      import('@features/processes/sipoc/sipoc.component').then((m) => m.SipocComponent),
  },
  {
    path: 'processos/slas/painel',
    canActivate: [moduleAccessGuard],
    data: { mode: 'panel', module: 'slas' },
    loadComponent: () =>
      import('@features/processes/slas/slas.component').then((m) => m.SlasComponent),
  },
  {
    path: 'processos/slas/gerenciamento',
    canActivate: [moduleAccessGuard],
    data: { mode: 'management', module: 'slas', adminOrGestor: true },
    loadComponent: () =>
      import('@features/processes/slas/slas.component').then((m) => m.SlasComponent),
  },
  {
    path: 'riscos/painel',
    canActivate: [moduleAccessGuard],
    data: { mode: 'panel', module: 'risks' },
    loadComponent: () => import('@features/risks/risks.component').then((m) => m.RisksComponent),
  },
  {
    path: 'riscos/gerenciamento',
    canActivate: [moduleAccessGuard],
    data: { mode: 'management', module: 'risks', adminOrGestor: true },
    loadComponent: () => import('@features/risks/risks.component').then((m) => m.RisksComponent),
  },
  {
    path: 'documentos/painel',
    canActivate: [moduleAccessGuard],
    data: { mode: 'panel', module: 'documents' },
    loadComponent: () =>
      import('@features/documents/documents.component').then((m) => m.DocumentsComponent),
  },
  {
    path: 'documentos/hierarquia',
    canActivate: [moduleAccessGuard],
    data: { mode: 'hierarchy', module: 'documents' },
    loadComponent: () =>
      import('@features/documents/documents.component').then((m) => m.DocumentsComponent),
  },
  {
    path: 'documentos/gerenciamento',
    canActivate: [moduleAccessGuard],
    canDeactivate: [
      (component: { leaveEditor: () => Promise<boolean> }) => component.leaveEditor(),
    ],
    data: { mode: 'management', module: 'documents', adminOnly: true },
    loadComponent: () =>
      import('@features/documents/documents.component').then((m) => m.DocumentsComponent),
  },
  {
    path: 'documentos/copias',
    canActivate: [moduleAccessGuard],
    data: { mode: 'copies', module: 'documents', adminOnly: true },
    loadComponent: () =>
      import('@features/documents/documents.component').then((m) => m.DocumentsComponent),
  },
  {
    path: 'incidentes/realizacao',
    canActivate: [moduleAccessGuard],
    data: { mode: 'realize', module: 'incidents' },
    loadComponent: () =>
      import('@features/incidents/incidents.component').then((m) => m.IncidentsComponent),
  },
  {
    path: 'incidentes/painel',
    canActivate: [moduleAccessGuard],
    data: { mode: 'panel', module: 'incidents' },
    loadComponent: () =>
      import('@features/incidents/incidents.component').then((m) => m.IncidentsComponent),
  },
  {
    path: 'incidentes/parametrizacao',
    canActivate: [moduleAccessGuard],
    data: { mode: 'settings', module: 'incidents', adminOnly: true },
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
    canActivate: [moduleAccessGuard],
    data: { module: 'helpdesk' },
    loadComponent: () =>
      import('@features/helpdesk/helpdesk.component').then((m) => m.HelpdeskComponent),
  },
  {
    path: 'indicadores/painel',
    canActivate: [moduleAccessGuard],
    data: { module: 'indicators' },
    loadComponent: () =>
      import('@features/indicators/indicator-panel.component').then(
        (m) => m.IndicatorPanelComponent,
      ),
  },
  {
    path: 'indicadores/alimentacao',
    canActivate: [moduleAccessGuard],
    data: { mode: 'feed', module: 'indicators' },
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
    canActivate: [moduleAccessGuard],
    data: { mode: 'registration', module: 'indicators', adminOnly: true },
    loadComponent: () =>
      import('@features/indicators/indicators.component').then((m) => m.IndicatorsComponent),
  },
  {
    path: 'planos-acao',
    canActivate: [moduleAccessGuard],
    data: { module: 'action_plans' },
    loadComponent: () =>
      import('@features/actions/action-plans.component').then((m) => m.ActionPlansComponent),
  },
  {
    path: 'usuarios',
    canActivate: [moduleAccessGuard],
    data: { module: 'users', adminOnly: true },
    loadComponent: () => import('@features/users/users.component').then((m) => m.UsersComponent),
  },
  {
    path: 'perfil',
    canActivate: [moduleAccessGuard],
    data: { module: 'profile' },
    loadComponent: () => import('@features/users/users.component').then((m) => m.UsersComponent),
  },
  {
    path: 'definir-senha',
    loadComponent: () =>
      import('@features/auth/set-password.component').then((m) => m.SetPasswordComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];
