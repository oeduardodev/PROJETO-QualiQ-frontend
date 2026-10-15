import { Component, inject } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { LoginComponent } from '@features/auth/login.component';
import { AppShellComponent } from './layout/app-shell.component';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { ToastOutletComponent } from '@shared/components/toast-outlet/toast-outlet.component';
import { AlertDialogOutletComponent } from '@shared/components/alert-dialog-outlet/alert-dialog-outlet.component';

@Component({
  imports: [
    LoginComponent,
    AppShellComponent,
    IconDirective,
    ToastOutletComponent,
    AlertDialogOutletComponent,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  readonly auth = inject(AuthService);

  constructor() {
    void this.auth.initialize();
  }
}
