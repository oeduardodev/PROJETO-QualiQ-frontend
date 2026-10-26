import { DatePipe } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OperationInboxService } from '@core/services/operation-inbox.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    <section class="space-y-5">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="ui-page-title">Notificações</h2>
          <p class="ui-page-subtitle">Atribuições e solicitações recebidas</p>
        </div>
        @if (inbox.unreadCount()) {
          <button type="button" class="ui-button-secondary" (click)="inbox.readAll()">
            Marcar todas como lidas
          </button>
        }
      </header>

      <div class="flex items-center gap-2" role="group" aria-label="Filtrar notificações">
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm"
          [class.bg-blue-600]="!unreadOnly()"
          [class.text-white]="!unreadOnly()"
          (click)="filter(false)"
        >
          Todas
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm"
          [class.bg-blue-600]="unreadOnly()"
          [class.text-white]="unreadOnly()"
          (click)="filter(true)"
        >
          Não lidas ({{ inbox.unreadCount() }})
        </button>
      </div>

      @if (inbox.historyError()) {
        <div
          class="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
          role="alert"
        >
          Não foi possível carregar o histórico.
          <button type="button" class="ml-2 underline" (click)="reload()">Tentar novamente</button>
        </div>
      } @else if (inbox.historyLoading()) {
        <p class="text-sm text-slate-500">Carregando notificações...</p>
      } @else {
        <div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
          @for (item of inbox.history(); track item.id) {
            <a
              class="flex w-full items-start gap-3 border-b border-slate-100 p-4 text-left transition hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 last:border-b-0"
              [class.bg-blue-50]="!item.read_at"
              [routerLink]="item.route"
              [queryParams]="inbox.queryParams(item)"
              (click)="inbox.read(item)"
            >
              <span
                class="mt-2 h-2 w-2 shrink-0 rounded-full"
                [class.bg-blue-500]="!item.read_at"
                [class.bg-slate-200]="item.read_at"
              ></span>
              <div class="min-w-0 flex-1">
                <span class="font-medium text-slate-800">{{ item.title }}</span>
                <p class="mt-1 text-xs text-slate-500">
                  {{ item.actor_name || 'Sistema' }} ·
                  {{ item.created_at | date: 'dd/MM/yyyy HH:mm' }}
                  @if (item.read_at) {
                    · Lida em {{ item.read_at | date: 'dd/MM/yyyy HH:mm' }}
                  }
                </p>
              </div>
              @if (!item.read_at) {
                <span class="shrink-0 text-xs font-medium text-blue-700">Não lida</span>
              }
            </a>
          } @empty {
            <p class="p-8 text-center text-sm text-slate-500">Nenhuma notificação encontrada.</p>
          }
        </div>
        @if (inbox.historyCount() > inbox.pageSize) {
          <nav
            class="flex items-center justify-between gap-3 text-sm"
            aria-label="Páginas de notificações"
          >
            <button
              type="button"
              class="ui-button-secondary"
              [disabled]="page() === 0"
              (click)="goTo(page() - 1)"
            >
              Anterior
            </button>
            <span>Página {{ page() + 1 }} de {{ totalPages() }}</span>
            <button
              type="button"
              class="ui-button-secondary"
              [disabled]="page() + 1 >= totalPages()"
              (click)="goTo(page() + 1)"
            >
              Próxima
            </button>
          </nav>
        }
      }
    </section>
  `,
})
export class NotificationsComponent implements OnDestroy {
  readonly inbox = inject(OperationInboxService);
  readonly page = signal(0);
  readonly unreadOnly = signal(false);
  readonly totalPages = computed(() => Math.ceil(this.inbox.historyCount() / this.inbox.pageSize));

  constructor() {
    this.inbox.watchHistory(true);
    void this.inbox.loadHistory();
  }

  ngOnDestroy(): void {
    this.inbox.watchHistory(false);
  }

  filter(unreadOnly: boolean): void {
    this.unreadOnly.set(unreadOnly);
    this.goTo(0);
  }

  goTo(page: number): void {
    this.page.set(page);
    this.reload();
  }

  reload(): void {
    void this.inbox.loadHistory(this.page(), this.unreadOnly());
  }
}
