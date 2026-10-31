import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';

export type MaintenanceStatus = 'checking' | 'ready' | 'maintenance' | 'unavailable';

@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly destroyRef = inject(DestroyRef);
  readonly status = signal<MaintenanceStatus>('checking');
  readonly refreshing = signal(false);

  private initialized = false;
  private pending: Promise<void> | null = null;
  private revision = 0;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    const channel = this.supabase
      .channel('system-maintenance')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'system_settings' },
        (payload) => {
          const active = payload.new['active_maintenance'];
          if (typeof active !== 'boolean') return;
          this.revision++;
          this.status.set(active ? 'maintenance' : 'ready');
        },
      )
      .subscribe();

    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') void this.refresh();
    };
    document.addEventListener('visibilitychange', refreshOnReturn);
    window.addEventListener('focus', refreshOnReturn);
    const interval = window.setInterval(() => void this.refresh(), 15_000);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshOnReturn);
      window.removeEventListener('focus', refreshOnReturn);
      void this.supabase.removeChannel(channel);
    });

    void this.refresh();
  }

  refresh(): Promise<void> {
    if (this.pending) return this.pending;
    this.pending = this.load().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async load(): Promise<void> {
    this.refreshing.set(true);
    const revision = this.revision;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const { data, error } = await this.supabase
        .from('system_settings')
        .select('active_maintenance')
        .eq('id', true)
        .abortSignal(controller.signal)
        .single();
      if (error || !data) throw error ?? new Error('Configuração de manutenção ausente.');
      if (revision === this.revision) {
        this.status.set(data.active_maintenance ? 'maintenance' : 'ready');
      }
    } catch {
      if (revision === this.revision) this.status.set('unavailable');
    } finally {
      window.clearTimeout(timeout);
      this.refreshing.set(false);
    }
  }
}
