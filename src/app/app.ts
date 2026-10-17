import { Component, inject } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { LoginComponent } from '@features/auth/login.component';
import { AppShellComponent } from './layout/app-shell.component';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { ToastOutletComponent } from '@shared/components/toast-outlet/toast-outlet.component';
import { AlertDialogOutletComponent } from '@shared/components/alert-dialog-outlet/alert-dialog-outlet.component';
import { PublicIncidentComponent } from '@features/incidents/public-incident.component';

@Component({
  imports: [
    LoginComponent,
    AppShellComponent,
    IconDirective,
    ToastOutletComponent,
    AlertDialogOutletComponent,
    PublicIncidentComponent,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  readonly publicIncident = /^\/(?:incidente-publico|notificacao-publica)\/[0-9a-f-]{36}\/?$/.test(
    window.location.pathname,
  );
  readonly auth = inject(AuthService);

  constructor() {
    void this.auth.initialize();
  }
}
