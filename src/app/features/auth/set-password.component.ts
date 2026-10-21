import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { errorMessage } from '@shared/utils/error.utils';

@Component({
  selector: 'app-set-password',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective],
  template: `
    <main class="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <section
        class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"
        >
          <span appIcon="KeyRound" class="h-5 w-5"></span>
        </span>
        <h2 class="mt-5 text-xl font-semibold text-slate-900">Defina sua senha</h2>
        <p class="mt-1 text-sm leading-6 text-slate-500">
          Crie uma senha para acessar o Orbis. Use pelo menos 8 caracteres.
        </p>
        <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()">
          <label class="block"
            ><span class="mb-1.5 block text-xs font-medium text-slate-600">Nova senha</span
            ><input
              type="password"
              formControlName="password"
              autocomplete="new-password"
              class="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
          /></label>
          <label class="block"
            ><span class="mb-1.5 block text-xs font-medium text-slate-600">Confirme a senha</span
            ><input
              type="password"
              formControlName="confirmation"
              autocomplete="new-password"
              class="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
          /></label>
          @if (error()) {
            <p class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {{ error() }}
            </p>
          }
          <button
            type="submit"
            [disabled]="form.invalid || submitting()"
            class="ui-button-primary w-full justify-center"
          >
            {{ submitting() ? 'Salvando...' : 'Salvar senha e entrar' }}
          </button>
        </form>
      </section>
    </main>
  `,
})
export class SetPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
    confirmation: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) return;
    const { password, confirmation } = this.form.getRawValue();
    if (password !== confirmation) {
      this.error.set('As senhas não coincidem.');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.auth.updatePassword(password);
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.error.set(
        errorMessage(
          error,
          'Não foi possível atualizar a senha. Abra novamente o link do convite.',
        ),
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
