import { Component, inject } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { LoginComponent } from '@features/auth/login.component';
import { SetPasswordComponent } from '@features/auth/set-password.component';
import { AppShellComponent } from './layout/app-shell.component';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { ToastOutletComponent } from '@shared/components/toast-outlet/toast-outlet.component';
import { AlertDialogOutletComponent } from '@shared/components/alert-dialog-outlet/alert-dialog-outlet.component';
import { PublicIncidentComponent } from '@features/incidents/public-incident.component';
import { PublicSurveyComponent } from '@features/surveys/public-survey.component';
import { PublicBuiltFormComponent } from '@features/form-builder/public-built-form.component';

@Component({
  imports: [
    LoginComponent,
    SetPasswordComponent,
    AppShellComponent,
    IconDirective,
    ToastOutletComponent,
    AlertDialogOutletComponent,
    PublicIncidentComponent,
    PublicSurveyComponent,
    PublicBuiltFormComponent,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  readonly passwordSetup = window.location.pathname.replace(/\/$/, '') === '/definir-senha';
  readonly publicIncident = /^\/(?:incidente-publico|notificacao-publica)\/[0-9a-f-]{36}\/?$/.test(
    window.location.pathname,
  );
  readonly publicSurvey = /^\/pesquisa-publica\/[0-9a-f-]{36}\/?$/.test(window.location.pathname);
  readonly publicBuiltForm = /^\/formulario-publico\/[0-9a-f-]{36}\/?$/.test(
    window.location.pathname,
  );
  readonly auth = inject(AuthService);

  constructor() {
    void this.auth.initialize();
  }
}
