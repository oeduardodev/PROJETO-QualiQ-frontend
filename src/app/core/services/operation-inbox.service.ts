import { inject, Injectable, signal } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { OperationInbox } from '@core/models/database';

const HISTORY_PAGE_SIZE = 30;

@Injectable({ providedIn: 'root' })
export class OperationInboxService {
  private readonly client = inject(SupabaseService).client;
  private channel: RealtimeChannel | null = null;
  private userId: string | null = null;
  private requestId = 0;
  private historyRequestId = 0;
  private historyVisible = false;
  private historyPage = 0;
  private historyUnreadOnly = false;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  readonly items = signal<OperationInbox[]>([]);
  readonly unreadCount = signal(0);
  readonly error = signal(false);
  readonly history = signal<OperationInbox[]>([]);
  readonly historyCount = signal(0);
  readonly historyLoading = signal(false);
  readonly historyError = signal(false);
  readonly pageSize = HISTORY_PAGE_SIZE;

  start(userId: string): void {
    if (this.userId === userId) return;
    this.stop();
    this.userId = userId;
    this.channel = this.client
      .channel(`operation-inbox-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'operation_inbox',
          filter: `user_id=eq.${userId}`,
        },
        () => this.refresh(),
      )
      .subscribe();
    void this.load();
    if (this.historyVisible) void this.loadHistory(this.historyPage, this.historyUnreadOnly);
  }

  stop(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
    this.requestId++;
    this.historyRequestId++;
    this.userId = null;
    this.items.set([]);
    this.unreadCount.set(0);
    this.history.set([]);
    this.historyCount.set(0);
    this.historyLoading.set(false);
    this.historyError.set(false);
    this.error.set(false);
    if (this.channel) {
      void this.client.removeChannel(this.channel);
      this.channel = null;
    }
  }

  async load(): Promise<void> {
    const userId = this.userId;
    if (!userId) return;
    const requestId = ++this.requestId;
    const { data, count, error } = await this.client
      .from('operation_inbox')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(20);
    if (requestId !== this.requestId || userId !== this.userId) return;
    this.error.set(!!error);
    if (!error) {
      this.items.set(data.map((item) => this.normalizeLegacyRoute(item)));
      this.unreadCount.set(count ?? data.length);
    }
  }

  async loadHistory(page = 0, unreadOnly = false): Promise<void> {
    const userId = this.userId;
    if (!userId) return;
    this.historyPage = page;
    this.historyUnreadOnly = unreadOnly;
    const requestId = ++this.historyRequestId;
    this.historyLoading.set(true);
    let query = this.client
      .from('operation_inbox')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(page * HISTORY_PAGE_SIZE, (page + 1) * HISTORY_PAGE_SIZE - 1);
    if (unreadOnly) query = query.is('read_at', null);
    const { data, count, error } = await query;
    if (userId !== this.userId || requestId !== this.historyRequestId) return;
    this.historyLoading.set(false);
    this.historyError.set(!!error);
    if (!error) {
      this.history.set(data.map((item) => this.normalizeLegacyRoute(item)));
      this.historyCount.set(count ?? data.length);
    }
  }

  watchHistory(visible: boolean): void {
    this.historyVisible = visible;
  }

  queryParams(item: OperationInbox): Record<string, string> {
    return item.route === '/pesquisas/painel'
      ? { resposta: item.record_id }
      : item.route === '/documentos/painel'
        ? { document: item.record_id }
        : { id: item.record_id };
  }

  async read(item: OperationInbox): Promise<void> {
    const userId = this.userId;
    if (!userId || item.read_at) return;
    const { error } = await this.client
      .from('operation_inbox')
      .update({ read_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('user_id', userId)
      .is('read_at', null);
    if (error) {
      this.error.set(true);
      this.historyError.set(true);
      return;
    }
    this.refresh();
  }

  async readAll(): Promise<void> {
    const userId = this.userId;
    if (!userId) return;
    const { error } = await this.client
      .from('operation_inbox')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);
    if (error) {
      this.error.set(true);
      this.historyError.set(true);
      return;
    }
    this.refresh();
  }

  private refresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.load();
      if (this.historyVisible) void this.loadHistory(this.historyPage, this.historyUnreadOnly);
    }, 100);
  }

  private normalizeLegacyRoute(item: OperationInbox): OperationInbox {
    return item.route.startsWith('/notificacoes/')
      ? {
          ...item,
          route: item.route.replace('/notificacoes/', '/incidentes/'),
          title: item.title.replace(/^Notificação encaminhada:/, 'Incidente encaminhado:'),
        }
      : item;
  }
}
