import { IndicatorService } from '@features/indicators/data-access/indicator.service';
import { errorMessage } from '@shared/utils/error.utils';
import { ProcessService } from '@features/processes/data-access/process.service';
import { TicketService } from '@features/notifications/data-access/ticket.service';
import { Component, computed, inject, signal } from '@angular/core';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { METHODOLOGIES } from '@shared/data/methodologies';
import type { Process, Ticket } from '@core/models/database';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IconDirective, MethodologyComponent, ModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly indicatorService = inject(IndicatorService);
  private readonly processService = inject(ProcessService);
  private readonly ticketService = inject(TicketService);
  readonly methodology = METHODOLOGIES['dashboard'];
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly methodologyOpen = signal(false);
  readonly fullscreen = signal(false);
  readonly processes = signal<Process[]>([]);
  readonly recentTickets = signal<Ticket[]>([]);
  readonly totals = signal({ processes: 0, open: 0, critical: 0, target: 0 });
  readonly stats = computed(() => [
    {
      label: 'Processos mapeados',
      short: 'Processos ativos',
      value: this.totals().processes,
      icon: 'GitBranch',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'NCs em aberto',
      short: 'NCs em aberto',
      value: this.totals().open,
      icon: 'TriangleAlert',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'KPIs no alvo',
      short: 'KPIs no alvo',
      value: this.totals().target,
      icon: 'Target',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'KPIs críticos',
      short: 'KPIs críticos',
      value: this.totals().critical,
      icon: 'TrendingUp',
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
  ]);

  constructor() {
    void this.load();
  }

  processCode(id: string): string {
    return this.processes().find((item) => item.id === id)?.code ?? '—';
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [processes, tickets, indicators] = await Promise.all([
        this.processService.fetchProcesses(),
        this.ticketService.fetchTickets(),
        this.indicatorService.fetchIndicators(),
      ]);
      this.processes.set(processes);
      this.recentTickets.set(tickets.slice(0, 5));
      this.totals.set({
        processes: processes.length,
        open: tickets.filter((t) => t.status !== 'concluido').length,
        critical: indicators.filter((i) => i.status === 'critico').length,
        target: indicators.filter((i) => i.status === 'no_alvo').length,
      });
    } catch (error) {
      this.error.set(errorMessage(error, 'Erro ao carregar o painel'));
    } finally {
      this.loading.set(false);
    }
  }
}
