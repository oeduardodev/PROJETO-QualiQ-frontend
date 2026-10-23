import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { errorMessage } from '@shared/utils/error.utils';

@Component({
  selector: 'app-set-password',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective],
  templateUrl: './set-password.component.html',
  styleUrl: './login.component.scss',
})
export class SetPasswordComponent {
  readonly auth = inject(AuthService);
  private readonly params = new URLSearchParams(window.location.search);
  private readonly emailFromLink = this.readEmailFromLink();
  readonly linkTokenHash = this.params.get('token_hash');
  readonly linkType: 'invite' | 'recovery' | null =
    this.params.get('type') === 'invite' || this.params.get('type') === 'recovery'
      ? (this.params.get('type') as 'invite' | 'recovery')
      : null;
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });

  get accountEmail(): string | null {
    return this.auth.user()?.email ?? this.emailFromLink;
  }

  get canSetPassword(): boolean {
    return (
      Boolean(this.auth.session() && this.auth.user()?.email) ||
      Boolean(this.linkTokenHash && this.linkType)
    );
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting() || !this.canSetPassword) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      if (this.linkTokenHash && this.linkType) {
        await this.auth.verifyPasswordSetupLink(this.linkTokenHash, this.linkType);
      } else if (!this.auth.session()) {
        throw new Error('O link para definir senha está ausente ou expirou.');
      }
      await this.auth.updatePassword(this.form.controls.password.value);
      window.location.replace('/dashboard');
    } catch (error) {
      this.error.set(
        errorMessage(error, 'Não foi possível salvar a senha. Abra novamente o link do convite.'),
      );
      this.submitting.set(false);
    }
  }

  private readEmailFromLink(): string | null {
    const raw = window.location.search.match(/[?&]email=([^&]*)/)?.[1];
    if (raw === undefined) return null;
    try {
      return decodeURIComponent(raw.replace(/\+/g, '%2B'));
    } catch {
      return null;
    }
  }
}
