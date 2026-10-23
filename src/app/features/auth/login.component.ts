import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { errorMessage } from '@shared/utils/error.utils';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  readonly submitting = signal(false);
  readonly sendingPasswordLink = signal(false);
  readonly error = signal<string | null>(null);
  readonly passwordLinkMessage = signal<string | null>(null);
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.error.set(null);
    this.passwordLinkMessage.set(null);
    const result = await this.auth.signIn(
      this.form.controls.email.value,
      this.form.controls.password.value,
    );
    this.error.set(result.error);
    this.submitting.set(false);
  }

  async sendPasswordLink(): Promise<void> {
    const email = this.form.controls.email;
    if (email.invalid || this.sendingPasswordLink()) {
      email.markAsTouched();
      this.error.set('Informe seu e-mail para receber o link de definição de senha.');
      return;
    }
    this.sendingPasswordLink.set(true);
    this.error.set(null);
    this.passwordLinkMessage.set(null);
    try {
      await this.auth.sendPasswordSetupLink(email.value.trim());
      this.passwordLinkMessage.set(
        'Se o e-mail estiver cadastrado, enviaremos um link para definir sua senha.',
      );
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível enviar o link. Tente novamente.'));
    } finally {
      this.sendingPasswordLink.set(false);
    }
  }
}
