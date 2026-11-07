import { effect, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { UserManagementService } from '@features/users/data-access/user-management.service';
import { ToastService } from '@shared/services/toast.service';
import { errorMessage } from '@shared/utils/error.utils';

export type ThemePreference = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly auth = inject(AuthService);
  private readonly userManagement = inject(UserManagementService);
  private readonly toast = inject(ToastService);
  readonly theme = signal<ThemePreference>('light');
  readonly saving = signal(false);

  constructor() {
    effect(() => {
      const preference = this.auth.profile()?.theme_preference;
      this.apply(preference === 'dark' ? 'dark' : 'light');
    });
  }

  async setTheme(preference: ThemePreference): Promise<void> {
    const userId = this.auth.user()?.id;
    if (this.saving() || !userId || preference === this.theme()) return;
    const previous = this.theme();
    this.saving.set(true);
    this.apply(preference);
    try {
      await this.userManagement.save({ action: 'update_theme', theme_preference: preference });
      if (this.auth.user()?.id === userId) this.auth.setThemePreference(preference);
    } catch (error) {
      if (this.auth.user()?.id === userId) {
        this.apply(previous);
        this.toast.error(errorMessage(error, 'Não foi possível salvar o tema.'));
      }
    } finally {
      this.saving.set(false);
    }
  }

  private apply(preference: ThemePreference): void {
    this.theme.set(preference);
    document.documentElement.classList.toggle('dark', preference === 'dark');
    document.documentElement.dataset['theme'] = preference;
  }
}
