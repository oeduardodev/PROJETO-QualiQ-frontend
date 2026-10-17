import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import type {
  ActionPlan,
  Indicator,
  IndicatorHistoryEntry,
  IndicatorResultAnalysis,
  Process,
  SipocNode,
  Ticket,
} from '@core/models/database';
import { IndicatorService } from './data-access/indicator.service';
import { IndicatorResultAnalysisRepository } from './data-access/indicator-result-analysis.repository';
import { ActionPlanService } from '@features/actions/data-access/action-plan.service';
import { ProcessService } from '@features/processes/data-access/process.service';
import { IncidentTicketService } from '@features/incidents/data-access/incident-ticket.service';
import { ToastService } from '@shared/services/toast.service';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { METHODOLOGIES } from '@shared/data/methodologies';
import { errorMessage } from '@shared/utils/error.utils';
import { formatIndicatorValue } from './data-access/indicator-unit.utils';
import {
  achievement,
  displayPeriod,
  isOnTarget,
  periodDate,
  sortedHistory,
} from './indicator-panel.utils';

interface PanelRow {
  indicator: Indicator;
  entry: IndicatorHistoryEntry | null;
  value: number;
  goal: number;
  period: string;
  date: string | null;
  onTarget: boolean;
}

interface ChartPoint {
  x: number;
  y: number;
  title: string;
}

@Component({
  selector: 'app-indicator-panel',
  standalone: true,
  imports: [MethodologyComponent],
  templateUrl: './indicator-panel.component.html',
  styleUrl: './indicator-panel.component.scss',
  host: { class: 'ui-standard-fields' },
})
export class IndicatorPanelComponent {
  private readonly indicatorService = inject(IndicatorService);
  private readonly analysesRepository = inject(IndicatorResultAnalysisRepository);
  private readonly actionPlanService = inject(ActionPlanService);
  private readonly processService = inject(ProcessService);
  private readonly ticketService = inject(IncidentTicketService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly methodology = METHODOLOGIES['indicadores'];
  readonly methodologyOpen = signal(false);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly indicators = signal<Indicator[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly nodes = signal<SipocNode[]>([]);
  readonly tickets = signal<Ticket[]>([]);
  readonly histories = signal<Record<string, IndicatorHistoryEntry[]>>({});
  readonly analyses = signal<IndicatorResultAnalysis[]>([]);
  readonly plans = signal<ActionPlan[]>([]);
  readonly nameFilter = signal('');
  readonly processFilter = signal('');
  readonly ownerFilter = signal('');
  readonly stepFilter = signal('');
  readonly typeFilter = signal('');
  readonly yearFilter = signal('');
  readonly monthFilter = signal('');
  readonly goalFilter = signal('');
  readonly selected = signal<PanelRow | null>(null);
  readonly comparisonIds = signal<string[]>([]);
  readonly selectedAnalysisId = signal<string | null>(null);
  readonly selectedTicketId = signal('');
  readonly analyzing = signal(false);
  readonly creatingPlans = signal(false);

  readonly owners = computed(() =>
    [
      ...new Set(
        this.processes()
          .map((item) => item.owner?.trim())
          .filter((value): value is string => !!value),
      ),
    ].sort(),
  );
  readonly types = computed(() =>
    [...new Set(this.indicators().map((item) => item.indicator_type))].sort(),
  );
  readonly years = computed(() =>
    [
      ...new Set(
        Object.values(this.histories())
          .flat()
          .map((entry) => periodDate(entry)?.slice(0, 4))
          .filter((value): value is string => !!value),
      ),
    ]
      .sort()
      .reverse(),
  );
  readonly undatedCount = computed(
    () =>
      Object.values(this.histories())
        .flat()
        .filter((entry) => !periodDate(entry)).length,
  );
  readonly rows = computed<PanelRow[]>(() =>
    this.indicators()
      .flatMap<PanelRow>((indicator) => {
        const entries = sortedHistory(this.histories()[indicator.id] ?? []);
        const current: PanelRow = {
          indicator,
          entry: null,
          value: indicator.current_value,
          goal: indicator.goal_value,
          period: 'Atual · sem lançamento correspondente',
          date: null,
          onTarget: isOnTarget(
            indicator.current_value,
            indicator.goal_value,
            indicator.goal_direction,
            indicator.acceptable_variation,
          ),
        };
        const historical: PanelRow[] = entries.map((entry) => ({
          indicator,
          entry,
          value: entry.value,
          goal: entry.goal,
          period: entry.period,
          date: periodDate(entry),
          onTarget: isOnTarget(
            entry.value,
            entry.goal,
            indicator.goal_direction,
            indicator.acceptable_variation,
          ),
        }));
        const latest = entries.at(-1);
        return !latest ||
          latest.value !== indicator.current_value ||
          latest.goal !== indicator.goal_value
          ? [current, ...historical]
          : historical;
      })
      .filter((row) => {
        const process = this.processes().find((item) => item.id === row.indicator.process_id);
        return (
          row.indicator.title
            .toLocaleLowerCase('pt-BR')
            .includes(this.nameFilter().trim().toLocaleLowerCase('pt-BR')) &&
          (!this.processFilter() || row.indicator.process_id === this.processFilter()) &&
          (!this.ownerFilter() || process?.owner?.trim() === this.ownerFilter()) &&
          (!this.stepFilter() || row.indicator.step_id === this.stepFilter()) &&
          (!this.typeFilter() || row.indicator.indicator_type === this.typeFilter()) &&
          (!this.yearFilter() || row.date?.slice(0, 4) === this.yearFilter()) &&
          (!this.monthFilter() || row.date?.slice(5, 7) === this.monthFilter()) &&
          (!this.goalFilter() || (row.onTarget ? 'on' : 'off') === this.goalFilter())
        );
      })
      .sort(
        (a, b) =>
          (b.date ?? '').localeCompare(a.date ?? '') ||
          a.indicator.title.localeCompare(b.indicator.title),
      ),
  );
  readonly visibleIndicators = computed(
    () => new Set(this.rows().map((row) => row.indicator.id)).size,
  );
  readonly offTarget = computed(() => this.rows().filter((row) => !row.onTarget).length);
  readonly relatedSteps = computed(() =>
    this.nodes().filter(
      (node) =>
        node.node_type === 'P' &&
        (!this.processFilter() || node.process_id === this.processFilter()),
    ),
  );
  readonly relatedTickets = computed(() =>
    this.tickets().filter((ticket) => ticket.process_id === this.selected()?.indicator.process_id),
  );
  readonly resultAnalyses = computed(() =>
    this.analyses().filter(
      (analysis) =>
        analysis.indicator_id === this.selected()?.indicator.id &&
        analysis.history_id === (this.selected()?.entry?.id ?? null) &&
        (analysis.history_id !== null ||
          (analysis.observed_value === this.selected()?.value &&
            analysis.observed_goal === this.selected()?.goal)),
    ),
  );
  readonly activeAnalysis = computed(
    () =>
      this.resultAnalyses().find((item) => item.id === this.selectedAnalysisId()) ??
      this.resultAnalyses()[0] ??
      null,
  );
  readonly linkedPlans = computed(() =>
    this.plans().filter((plan) => this.activeAnalysis()?.action_plan_ids.includes(plan.id)),
  );
  readonly comparisonCandidates = computed(() =>
    this.indicators().filter(
      (item) =>
        item.id !== this.selected()?.indicator.id &&
        (this.histories()[item.id] ?? []).some((entry) => !!periodDate(entry)),
    ),
  );
  readonly chartMonths = computed(() => {
    const selected = this.selected();
    if (!selected) return [];
    const ids = [selected.indicator.id, ...this.comparisonIds()];
    return [
      ...new Set(
        ids.flatMap((id) =>
          (this.histories()[id] ?? [])
            .map((entry) => periodDate(entry)?.slice(0, 7))
            .filter((value): value is string => !!value),
        ),
      ),
    ]
      .sort()
      .slice(-12);
  });
  readonly chartMaximum = computed(() => {
    const ids = [this.selected()?.indicator.id, ...this.comparisonIds()].filter(
      (id): id is string => !!id,
    );
    const values = ids.flatMap((id) => {
      const indicator = this.indicators().find((item) => item.id === id);
      return indicator
        ? (this.histories()[id] ?? [])
            .filter((entry) => this.chartMonths().includes(periodDate(entry)?.slice(0, 7) ?? ''))
            .map((entry) => achievement(entry.value, entry.goal, indicator.goal_direction))
        : [];
    });
    return Math.max(120, Math.ceil(Math.max(...values, 0) / 25) * 25);
  });
  readonly goalLineY = computed(() => 200 - (160 * 100) / this.chartMaximum());
  readonly chartSeries = computed(() => {
    const ids = [this.selected()?.indicator.id, ...this.comparisonIds()].filter(
      (id): id is string => !!id,
    );
    const colors = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2'];
    return ids.map((id, index) => {
      const indicator = this.indicators().find((item) => item.id === id)!;
      const byMonth = new Map<string, IndicatorHistoryEntry>();
      for (const entry of sortedHistory(this.histories()[id] ?? [])) {
        const month = periodDate(entry)?.slice(0, 7);
        if (month) byMonth.set(month, entry);
      }
      const segments: ChartPoint[][] = [];
      let current: ChartPoint[] = [];
      this.chartMonths().forEach((month, monthIndex) => {
        const entry = byMonth.get(month);
        if (!entry) {
          if (current.length) segments.push(current);
          current = [];
          return;
        }
        const rate = achievement(entry.value, entry.goal, indicator.goal_direction);
        current.push({
          x: 40 + (monthIndex * 740) / Math.max(1, this.chartMonths().length - 1),
          y: 200 - (Math.min(rate, this.chartMaximum()) * 160) / this.chartMaximum(),
          title: `${indicator.title} · ${displayPeriod(entry.period)} · ${formatIndicatorValue(entry.value, indicator.unit, indicator.decimal_places)} / meta ${formatIndicatorValue(entry.goal, indicator.unit, indicator.decimal_places)} · ${rate.toFixed(0)}% da meta`,
        });
      });
      if (current.length) segments.push(current);
      return { indicator, color: colors[index % colors.length], segments };
    });
  });

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [indicators, processes, nodes, tickets, analyses, plans] = await Promise.all([
        this.indicatorService.fetchIndicators(),
        this.processService.fetchProcesses(),
        this.processService.fetchSipocNodes(),
        this.ticketService.fetchTickets(),
        this.analysesRepository.fetchAll(),
        this.actionPlanService.fetchActionPlans(),
      ]);
      const histories = await this.indicatorService.fetchHistories(indicators);
      this.indicators.set(indicators);
      this.processes.set(processes);
      this.nodes.set(nodes);
      this.tickets.set(tickets);
      this.analyses.set(analyses);
      this.plans.set(plans);
      this.histories.set(histories);
    } catch (e) {
      this.error.set(errorMessage(e, 'Erro ao carregar painel de indicadores'));
    } finally {
      this.loading.set(false);
    }
  }

  open(row: PanelRow): void {
    this.selected.set(row);
    this.selectedAnalysisId.set(null);
    this.comparisonIds.set([]);
    const tickets = this.tickets().filter(
      (ticket) => ticket.process_id === row.indicator.process_id,
    );
    this.selectedTicketId.set(tickets.length === 1 ? tickets[0].id : '');
  }

  toggleComparison(id: string): void {
    this.comparisonIds.update((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  }

  processName(id: string): string {
    return this.processes().find((item) => item.id === id)?.title ?? '—';
  }

  processOwner(id: string): string {
    return this.processes().find((item) => item.id === id)?.owner ?? '—';
  }

  canAnalyze(indicator: Indicator): boolean {
    if (!this.auth.can('create', 'indicators')) return false;
    if (this.auth.isAdmin()) return true;
    const process = this.processes().find((item) => item.id === indicator.process_id);
    return !!process && process.category_id === this.auth.profile()?.category_id;
  }

  stepName(id: string | null): string {
    return this.nodes().find((item) => item.id === id)?.title ?? '—';
  }

  format(value: number, indicator: Indicator): string {
    return formatIndicatorValue(value, indicator.unit, indicator.decimal_places);
  }

  displayPeriod(value: string): string {
    return displayPeriod(value);
  }

  points(points: ChartPoint[]): string {
    return points.map((point) => `${point.x},${point.y}`).join(' ');
  }

  monthResult(indicator: Indicator, month: string): string {
    const entry = sortedHistory(this.histories()[indicator.id] ?? [])
      .filter((item) => periodDate(item)?.slice(0, 7) === month)
      .at(-1);
    return entry
      ? `${this.format(entry.value, indicator)} / ${this.format(entry.goal, indicator)}`
      : '—';
  }

  plansFor(analysis: IndicatorResultAnalysis): ActionPlan[] {
    return this.plans().filter((plan) => analysis.action_plan_ids.includes(plan.id));
  }

  clearFilters(): void {
    this.nameFilter.set('');
    this.processFilter.set('');
    this.ownerFilter.set('');
    this.stepFilter.set('');
    this.typeFilter.set('');
    this.yearFilter.set('');
    this.monthFilter.set('');
    this.goalFilter.set('');
  }

  async generateAnalysis(): Promise<void> {
    const row = this.selected();
    if (!row || this.analyzing()) return;
    this.analyzing.set(true);
    try {
      const indicator = row.indicator;
      const history = sortedHistory(this.histories()[indicator.id] ?? [])
        .filter((entry) => !row.date || (periodDate(entry) ?? '') <= row.date)
        .slice(-12)
        .map((entry) => ({ period: entry.period, value: entry.value, goal: entry.goal }));
      const result = await this.indicatorService.generateAnalysis(
        { ...indicator, current_value: row.value, goal_value: row.goal },
        { period: row.period, on_target: row.onTarget, history },
      );
      if (!result) throw new Error('A análise não retornou um resultado.');
      const saved = await this.analysesRepository.create({
        indicator_id: indicator.id,
        history_id: row.entry?.id ?? null,
        observed_value: row.value,
        observed_goal: row.goal,
        observed_period: row.period,
        diagnostic: result.diagnostic,
        suggestions: result.suggestions,
      });
      this.analyses.update((items) => [saved, ...items]);
      this.selectedAnalysisId.set(saved.id);
      this.toast.success('Análise crítica registrada para este resultado');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao gerar análise crítica'));
    } finally {
      this.analyzing.set(false);
    }
  }

  async createPlans(): Promise<void> {
    const analysis = this.activeAnalysis();
    const ticketId = this.selectedTicketId();
    if (
      !analysis ||
      analysis.action_plan_ids.length ||
      !this.relatedTickets().some((ticket) => ticket.id === ticketId) ||
      this.creatingPlans()
    )
      return;
    this.creatingPlans.set(true);
    try {
      const plans = await this.analysesRepository.createPlans(analysis.id, ticketId);
      this.plans.update((items) => [...plans, ...items]);
      this.analyses.update((items) =>
        items.map((item) =>
          item.id === analysis.id
            ? { ...item, action_plan_ids: plans.map((plan) => plan.id) }
            : item,
        ),
      );
      this.toast.success(`${plans.length} plano(s) vinculado(s) à análise`);
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao criar planos de ação'));
    } finally {
      this.creatingPlans.set(false);
    }
  }
}
