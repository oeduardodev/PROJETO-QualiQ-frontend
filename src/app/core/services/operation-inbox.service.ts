import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { OperationInbox } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class OperationInboxService {
  private readonly client = inject(SupabaseService).client;
  readonly items = signal<OperationInbox[]>([]);
  readonly error = signal(false);

  async load(): Promise<void> {
    const { data, error } = await this.client
      .from('operation_inbox')
      .select('*')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(100);
    this.error.set(!!error);
    if (!error)
      this.items.set(
        data.map((item) =>
          item.route.startsWith('/notificacoes/')
            ? {
                ...item,
                route: item.route.replace('/notificacoes/', '/incidentes/'),
                title: item.title.replace(/^Notificação encaminhada:/, 'Incidente encaminhado:'),
              }
            : item,
        ),
      );
  }

  async read(item: OperationInbox): Promise<void> {
    const { error } = await this.client
      .from('operation_inbox')
      .update({ read_at: new Date().toISOString() })
      .eq('id', item.id);
    if (!error) this.items.update((items) => items.filter((i) => i.id !== item.id));
  }
}
