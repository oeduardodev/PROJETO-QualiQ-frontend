import { todayUtc } from '@shared/utils/date.utils';
import { toSignal } from '@angular/core/rxjs-interop';
import { errorMessage } from '@shared/utils/error.utils';
import { toIndicatorPayload } from './data-access/indicator.mapper';
import { ActionPlanService } from '@features/actions/data-access/action-plan.service';
import { IndicatorService } from '@features/indicators/data-access/indicator.service';
import { ProcessService } from '@features/processes/data-access/process.service';
import { TicketService } from '@features/notifications/data-access/ticket.service';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import type { IndicatorAnalysis } from './data-access/indicator-analysis.model';
import type {
  Indicator,
  IndicatorFrequency,
  IndicatorHistoryEntry,
  IndicatorStatus,
  Process,
  SipocNode,
  Ticket,
} from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { ToastService } from '@shared/services/toast.service';
import { METHODOLOGIES } from '@shared/data/methodologies';

@Component({
  selector: 'app-indicators',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective, ModalComponent, MethodologyComponent],
  templateUrl: './indicators.component.html',
  styleUrl: './indicators.component.scss',
  host: { class: 'ui-standard-fields' },
})
export class IndicatorsComponent {
  private readonly actionPlanService = inject(ActionPlanService);
  private readonly indicatorService = inject(IndicatorService);
  private readonly processService = inject(ProcessService);
  private readonly ticketService = inject(TicketService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  readonly mode = this.route.snapshot.data['mode'] as
    'panel' | 'feed' | 'analysis' | 'registration';
  readonly methodology = METHODOLOGIES['indicadores'];
  readonly indicators = signal<Indicator[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly nodes = signal<SipocNode[]>([]);
  readonly tickets = signal<Ticket[]>([]);
  readonly histories = signal<Record<string, IndicatorHistoryEntry[]>>({});
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly methodologyOpen = signal(false);
  readonly formOpen = signal(false);
  readonly editing = signal<Indicator | null>(null);
  readonly savingId = signal<string | null>(null);
  readonly selectedIndicator = signal<Indicator | null>(null);
  readonly linkedTickets = signal<Ticket[]>([]);
  readonly aiLoading = signal(false);
  readonly aiAnalysis = signal<IndicatorAnalysis | null>(null);
  readonly approving = signal(false);
  private readonly periodControls = new Map<string, FormControl<string>>();
  private readonly valueControls = new Map<string, FormControl<number | null>>();
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    process_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    step_id: new FormControl('', { nonNullable: true }),
    goal_value: new FormControl(0, { nonNullable: true }),
    unit: new FormControl('', { nonNullable: true }),
    current_value: new FormControl(0, { nonNullable: true }),
    frequency: new FormControl<IndicatorFrequency>('mensal', { nonNullable: true }),
    status: new FormControl<IndicatorStatus>('no_alvo', { nonNullable: true }),
    requires_critical_analysis: new FormControl(false, { nonNullable: true }),
  });
  readonly problemIndicators = computed(() =>
    this.indicators().filter((indicator) => indicator.status !== 'no_alvo'),
  );
  readonly summary = computed(() => [
    { label: 'Total', value: this.indicators().length },
    { label: 'No alvo', value: this.indicators().filter((i) => i.status === 'no_alvo').length },
    { label: 'Atenção', value: this.indicators().filter((i) => i.status === 'atencao').length },
    { label: 'Críticos', value: this.indicators().filter((i) => i.status === 'critico').length },
  ]);
  readonly selectedProcessId = toSignal(this.form.controls.process_id.valueChanges, {
    initialValue: this.form.controls.process_id.value,
  });
  readonly stepsForForm = computed(() =>
    this.nodes().filter(
      (node) => node.node_type === 'P' && node.process_id === this.selectedProcessId(),
    ),
  );

  get title(): string {
    return {
      panel: 'Painel de Indicadores',
      feed: 'Alimentação de Dados',
      analysis: 'Análises Críticas (IA)',
      registration: 'Ficha do Indicador',
    }[this.mode];
  }

  get subtitle(): string {
    return this.mode === 'analysis'
      ? `${this.problemIndicators().length} indicadores em atenção · Cruza KPIs, não-conformidades e causa raiz`
      : `${this.indicators().length} indicadores cadastrados`;
  }

  constructor() {
    void this.loadIndicators();
  }

  async loadIndicators(): Promise<void> {
    this.loading.set(true);
    try {
      const [indicators, processes, nodes, tickets] = await Promise.all([
        this.indicatorService.fetchIndicators(),
        this.processService.fetchProcesses(),
        this.processService.fetchSipocNodes(),
        this.ticketService.fetchTickets(),
      ]);
      this.indicators.set(indicators);
      this.processes.set(processes);
      this.nodes.set(nodes);
      this.tickets.set(tickets);
      this.histories.set(await this.indicatorService.fetchHistories(indicators));
    } catch (e) {
      this.error.set(errorMessage(e, 'Erro ao carregar indicadores'));
    } finally {
      this.loading.set(false);
    }
  }

  history(id: string): IndicatorHistoryEntry[] {
    return this.histories()[id] ?? [];
  }

  clearSelectedStep(): void {
    this.form.controls.step_id.setValue('');
  }

  bars(id: string): number[] {
    const values = this.history(id)
      .slice(-12)
      .map((item) => item.value);
    const max = Math.max(...values, 1);
    return values.map((value) => Math.max(5, (value / max) * 100));
  }

  periodControl(id: string): FormControl<string> {
    if (!this.periodControls.has(id))
      this.periodControls.set(id, new FormControl(todayUtc(), { nonNullable: true }));
    return this.periodControls.get(id)!;
  }

  valueControl(id: string): FormControl<number | null> {
    if (!this.valueControls.has(id))
      this.valueControls.set(id, new FormControl<number | null>(null));
    return this.valueControls.get(id)!;
  }

  async saveValue(indicator: Indicator): Promise<void> {
    const value = this.valueControl(indicator.id).value;
    const period = this.periodControl(indicator.id).value;
    if (value === null || !period) return;
    this.savingId.set(indicator.id);
    try {
      const saved = await this.indicatorService.recordValue(indicator, period, value);
      this.indicators.update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      this.histories.update((items) => ({
        ...items,
        [indicator.id]: [
          ...(items[indicator.id] ?? []),
          {
            id: `local-${Date.now()}`,
            indicator_id: indicator.id,
            period,
            value,
            goal: indicator.goal_value,
            created_at: new Date().toISOString(),
          },
        ],
      }));
      this.valueControl(indicator.id).setValue(null);
      this.toast.success('Valor registrado');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao registrar valor'));
    } finally {
      this.savingId.set(null);
    }
  }

  openCreateIndicator(): void {
    this.editing.set(null);
    this.form.reset({
      title: '',
      process_id: '',
      step_id: '',
      goal_value: 0,
      unit: '',
      current_value: 0,
      frequency: 'mensal',
      status: 'no_alvo',
      requires_critical_analysis: false,
    });
    this.formOpen.set(true);
  }

  openEditIndicator(indicator: Indicator): void {
    this.editing.set(indicator);
    this.form.reset({
      title: indicator.title,
      process_id: indicator.process_id,
      step_id: indicator.step_id ?? '',
      goal_value: indicator.goal_value,
      unit: indicator.unit,
      current_value: indicator.current_value,
      frequency: indicator.frequency,
      status: indicator.status,
      requires_critical_analysis: indicator.requires_critical_analysis,
    });
    this.formOpen.set(true);
  }

  async saveIndicator(): Promise<void> {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const payload = toIndicatorPayload(value);
    const current = this.editing();
    const saved = current
      ? await this.indicatorService.updateIndicator(current.id, payload)
      : await this.indicatorService.createIndicator(payload);
    this.indicators.update((items) =>
      current ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
    );
    this.toast.success(current ? 'Indicador atualizado' : 'Indicador criado');
    this.formOpen.set(false);
  }

  async deleteIndicator(indicator: Indicator): Promise<void> {
    if (!confirm('Excluir este indicador?')) return;
    await this.indicatorService.deleteIndicator(indicator.id);
    this.indicators.update((items) => items.filter((item) => item.id !== indicator.id));
    this.toast.success('Indicador excluído');
  }

  selectIndicator(indicator: Indicator): void {
    this.selectedIndicator.set(indicator);
    this.linkedTickets.set(
      this.tickets().filter((ticket) => ticket.process_id === indicator.process_id),
    );
    this.aiAnalysis.set(null);
  }

  async generateAnalysis(): Promise<void> {
    const indicator = this.selectedIndicator();
    if (!indicator) return;
    this.aiLoading.set(true);
    try {
      const process = this.processes().find((item) => item.id === indicator.process_id) ?? null;
      this.aiAnalysis.set(
        await this.indicatorService.generateAnalysis(indicator, process, this.linkedTickets()),
      );
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao gerar análise'));
    } finally {
      this.aiLoading.set(false);
    }
  }

  async approveSuggestions(): Promise<void> {
    const analysis = this.aiAnalysis();
    const ticketId = this.linkedTickets()[0]?.id;
    if (!analysis || !ticketId) return;
    this.approving.set(true);
    try {
      await this.actionPlanService.createFromSuggestions(ticketId, analysis.suggestions);
      this.toast.success(`${analysis.suggestions.length} plano(s) de ação criado(s)`);
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao criar planos'));
    } finally {
      this.approving.set(false);
    }
  }

  processName(id: string): string {
    return this.processes().find((item) => item.id === id)?.title ?? '—';
  }

  formatValue(value: number, unit: string): string {
    const formatted = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
    return unit === '%' ? `${formatted}%` : `${formatted} ${unit}`;
  }

  statusLabel(status: IndicatorStatus): string {
    return { no_alvo: 'No Alvo', atencao: 'Atenção', critico: 'Crítico' }[status];
  }

  statusClass(status: IndicatorStatus): string {
    return status === 'no_alvo'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'atencao'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-rose-50 text-rose-700';
  }

  frequencyLabel(value: IndicatorFrequency): string {
    return { diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal' }[value];
  }
}
