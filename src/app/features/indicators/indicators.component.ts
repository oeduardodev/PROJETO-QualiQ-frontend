import { toSignal } from '@angular/core/rxjs-interop';
import { errorMessage } from '@shared/utils/error.utils';
import { compileIndicatorFormula, displayIndicatorFormula } from './indicator-formula.utils';
import { formatIndicatorValue, indicatorUnitSymbol } from './data-access/indicator-unit.utils';
import { IndicatorService } from '@features/indicators/data-access/indicator.service';
import { IndicatorResultAnalysisRepository } from './data-access/indicator-result-analysis.repository';
import { displayPeriod, isOnTarget, periodDate, sortedHistory } from './indicator-panel.utils';
import { submissionDueDate, todayInSaoPaulo } from './indicator-deadline.utils';
import { ProcessService } from '@features/processes/data-access/process.service';
import { DimensionService } from '@features/strategy/data-access/dimension.service';
import { TicketService } from '@features/notifications/data-access/ticket.service';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import type {
  Indicator,
  IndicatorCalculationType,
  IndicatorClassification,
  IndicatorDefinitionHistory,
  IndicatorFrequency,
  IndicatorFrequencyOption,
  IndicatorHistoryEntry,
  IndicatorResultAnalysis,
  IndicatorStatus,
  IndicatorStatusOption,
  IndicatorUnitOption,
  IndicatorUnitType,
  Dimension,
  DimensionLink,
  Process,
  SipocNode,
  Ticket,
} from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { SideDrawerComponent } from '@shared/components/side-drawer/side-drawer.component';
import { ToastService } from '@shared/services/toast.service';
import { METHODOLOGIES } from '@shared/data/methodologies';

@Component({
  selector: 'app-indicators',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IconDirective,
    SideDrawerComponent,
    MethodologyComponent,
  ],
  templateUrl: './indicators.component.html',
  styleUrl: './indicators.component.scss',
  host: { class: 'ui-standard-fields' },
})
export class IndicatorsComponent {
  private readonly indicatorService = inject(IndicatorService);
  private readonly resultAnalysisRepository = inject(IndicatorResultAnalysisRepository);
  private readonly processService = inject(ProcessService);
  private readonly dimensionService = inject(DimensionService);
  private readonly ticketService = inject(TicketService);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  readonly mode = this.route.snapshot.data['mode'] as 'panel' | 'feed' | 'registration';
  readonly methodology = METHODOLOGIES['indicadores'];
  readonly today = todayInSaoPaulo();
  readonly unitOptions = signal<IndicatorUnitOption[]>([]);
  readonly frequencyOptions = signal<IndicatorFrequencyOption[]>([]);
  readonly statusOptions = signal<IndicatorStatusOption[]>([]);
  readonly activeStatusOptions = computed(() =>
    this.statusOptions().filter((option) => option.is_active),
  );
  readonly formStatusOptions = computed(() =>
    this.statusOptions().filter(
      (option) => option.is_active || option.key === this.editing()?.status,
    ),
  );
  readonly indicators = signal<Indicator[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly nodes = signal<SipocNode[]>([]);
  readonly dimensions = signal<Dimension[]>([]);
  readonly dimensionLinks = signal<DimensionLink[]>([]);
  readonly definitionHistory = signal<IndicatorDefinitionHistory[]>([]);
  readonly historyIndicatorId = signal<string | null>(null);
  readonly historyLoading = signal(false);
  readonly formSaving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly tickets = signal<Ticket[]>([]);
  readonly histories = signal<Record<string, IndicatorHistoryEntry[]>>({});
  readonly resultActors = signal<Record<string, string>>({});
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly methodologyOpen = signal(false);
  readonly formOpen = signal(false);
  readonly editing = signal<Indicator | null>(null);
  readonly savingId = signal<string | null>(null);
  readonly savedAnalyses = signal<IndicatorResultAnalysis[]>([]);
  readonly selectedFeedEntry = signal<string | null>(null);
  readonly feedAnalysisText = new FormControl('', { nonNullable: true });
  readonly feedAnalysisSaving = signal(false);
  readonly feedAiLoading = signal(false);
  readonly feedPlansSavingId = signal<string | null>(null);
  private readonly justificationControls = new Map<string, FormControl<string>>();
  private readonly analysisControls = new Map<string, FormControl<string>>();
  private readonly feedTicketControls = new Map<string, FormControl<string>>();
  private readonly periodControls = new Map<string, FormControl<string>>();
  private readonly valueControls = new Map<string, FormControl<number | null>>();
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    objective: new FormControl('', { nonNullable: true, validators: Validators.required }),
    process_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    step_id: new FormControl('', { nonNullable: true }),
    goal_value: new FormControl(0, { nonNullable: true, validators: Validators.required }),
    acceptable_variation: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    unit: new FormControl<IndicatorUnitType>('numero_absoluto', { nonNullable: true }),
    frequency: new FormControl<IndicatorFrequency>('mensal', { nonNullable: true }),
    requires_critical_analysis: new FormControl(false, { nonNullable: true }),
    indicator_type: new FormControl<IndicatorClassification>('processo', { nonNullable: true }),
    goal_direction: new FormControl<'higher' | 'lower'>('higher', { nonNullable: true }),
    strategic: new FormControl(false, { nonNullable: true }),
    dimension_id: new FormControl('', { nonNullable: true }),
    calculation_type: new FormControl<IndicatorCalculationType>('simple', { nonNullable: true }),
    simple_formula: new FormControl('', { nonNullable: true }),
    result_source: new FormControl('', { nonNullable: true }),
    formula_expression: new FormControl('', { nonNullable: true }),
    decimal_places: new FormControl(2, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(6)],
    }),
    obsolete: new FormControl(false, { nonNullable: true }),
    justification: new FormControl('', { nonNullable: true }),
  });
  readonly summary = computed(() => [
    { label: 'Total', value: this.indicators().length },
    ...this.statusOptions().map((status) => ({
      label: status.label,
      value: this.indicators().filter((indicator) => indicator.status === status.key).length,
    })),
  ]);
  readonly selectedProcessId = toSignal(this.form.controls.process_id.valueChanges, {
    initialValue: this.form.controls.process_id.value,
  });
  readonly stepsForForm = computed(() =>
    this.nodes().filter(
      (node) => node.node_type === 'P' && node.process_id === this.selectedProcessId(),
    ),
  );
  readonly calculationType = toSignal(this.form.controls.calculation_type.valueChanges, {
    initialValue: this.form.controls.calculation_type.value,
  });
  readonly strategic = toSignal(this.form.controls.strategic.valueChanges, {
    initialValue: this.form.controls.strategic.value,
  });
  readonly availableFormulaIndicators = computed(() =>
    this.indicators().filter((item) => !item.obsolete && item.id !== this.editing()?.id),
  );

  get title(): string {
    return {
      panel: 'Painel de Indicadores',
      feed: 'Alimentação de Dados e Análise Crítica',
      registration: 'Ficha do Indicador',
    }[this.mode];
  }

  get subtitle(): string {
    return `${this.indicators().length} indicadores cadastrados`;
  }

  constructor() {
    void this.loadIndicators();
  }

  async loadIndicators(): Promise<void> {
    this.loading.set(true);
    try {
      const [indicators, processes, nodes, tickets, unitOptions, frequencyOptions, statusOptions] =
        await Promise.all([
          this.indicatorService.fetchIndicators(),
          this.processService.fetchProcesses(),
          this.processService.fetchSipocNodes(),
          this.ticketService.fetchTickets(),
          this.indicatorService.fetchUnitOptions(),
          this.indicatorService.fetchFrequencyOptions(),
          this.indicatorService.fetchStatusOptions(),
        ]);
      this.indicators.set(indicators);
      this.processes.set(processes);
      this.nodes.set(nodes);
      this.tickets.set(tickets);
      this.unitOptions.set(unitOptions);
      this.frequencyOptions.set(frequencyOptions);
      this.statusOptions.set(statusOptions);
      if (this.mode === 'registration') {
        const dimensionData = await this.dimensionService.fetchCurrentData();
        this.dimensions.set(dimensionData.dimensions);
        this.dimensionLinks.set(dimensionData.links);
      }
      this.histories.set(await this.indicatorService.fetchHistories(indicators));
      if (this.mode === 'feed' || this.mode === 'registration')
        this.resultActors.set(await this.indicatorService.fetchResultActors());
      if (this.mode === 'feed')
        this.savedAnalyses.set(await this.resultAnalysisRepository.fetchAll());
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
      this.periodControls.set(id, new FormControl(todayInSaoPaulo(), { nonNullable: true }));
    return this.periodControls.get(id)!;
  }

  valueControl(id: string): FormControl<number | null> {
    if (!this.valueControls.has(id))
      this.valueControls.set(id, new FormControl<number | null>(null));
    return this.valueControls.get(id)!;
  }

  justificationControl(id: string): FormControl<string> {
    if (!this.justificationControls.has(id))
      this.justificationControls.set(id, new FormControl('', { nonNullable: true }));
    return this.justificationControls.get(id)!;
  }

  analysisControl(id: string): FormControl<string> {
    if (!this.analysisControls.has(id))
      this.analysisControls.set(id, new FormControl('', { nonNullable: true }));
    return this.analysisControls.get(id)!;
  }

  isLate(indicator: Indicator): boolean {
    const due = this.dueDate(indicator);
    return due !== null && this.today > due;
  }

  dueDate(indicator: Indicator): string | null {
    const latest = sortedHistory(this.history(indicator.id)).at(-1);
    const baseline = latest ? periodDate(latest) : this.localDate(indicator.created_at);
    return submissionDueDate(
      this.periodControl(indicator.id).value,
      indicator.frequency,
      baseline ?? this.today,
    );
  }

  private localDate(timestamp: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(timestamp));
  }

  async saveValue(indicator: Indicator): Promise<void> {
    if (indicator.calculation_type === 'composite' || indicator.obsolete) return;
    const value = this.valueControl(indicator.id).value;
    const period = this.periodControl(indicator.id).value;
    const justification = this.justificationControl(indicator.id).value.trim();
    const analysis = this.analysisControl(indicator.id).value.trim();
    if (value === null || !Number.isFinite(value) || !period || period > todayInSaoPaulo()) return;
    if (this.isLate(indicator) && !justification) {
      this.toast.error('Informe a justificativa do lançamento fora do prazo');
      return;
    }
    if (indicator.requires_critical_analysis && !analysis) {
      this.toast.error('Informe a análise crítica exigida para este indicador');
      return;
    }
    this.savingId.set(indicator.id);
    try {
      const saved = await this.indicatorService.recordValue(
        indicator,
        period,
        value,
        justification,
        analysis,
      );
      this.indicators.update((items) =>
        items.map((item) => (item.id === saved.indicator.id ? saved.indicator : item)),
      );
      this.histories.update((items) => ({
        ...items,
        [indicator.id]: [...(items[indicator.id] ?? []), saved.history],
      }));
      if (analysis) {
        try {
          this.savedAnalyses.set(await this.resultAnalysisRepository.fetchAll());
        } catch {
          // The result was committed; analyses can be reloaded with the page.
        }
      }
      this.valueControl(indicator.id).setValue(null);
      this.justificationControl(indicator.id).setValue('');
      this.analysisControl(indicator.id).setValue('');
      this.selectedFeedEntry.set(saved.history.id);
      this.toast.success('Resultado registrado');
      void this.loadIndicators();
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao registrar valor'));
    } finally {
      this.savingId.set(null);
    }
  }

  openFeedAnalysis(entry: IndicatorHistoryEntry): void {
    this.selectedFeedEntry.set(this.selectedFeedEntry() === entry.id ? null : entry.id);
    this.feedAnalysisText.setValue('');
  }

  analysesFor(entryId: string): IndicatorResultAnalysis[] {
    return this.savedAnalyses().filter((item) => item.history_id === entryId);
  }

  ticketsFor(indicator: Indicator): Ticket[] {
    return this.tickets().filter((ticket) => ticket.process_id === indicator.process_id);
  }

  feedTicketControl(analysisId: string, indicator: Indicator): FormControl<string> {
    if (!this.feedTicketControls.has(analysisId)) {
      const tickets = this.ticketsFor(indicator);
      this.feedTicketControls.set(
        analysisId,
        new FormControl(tickets.length === 1 ? tickets[0].id : '', { nonNullable: true }),
      );
    }
    return this.feedTicketControls.get(analysisId)!;
  }

  async createFeedPlans(indicator: Indicator, analysis: IndicatorResultAnalysis): Promise<void> {
    const ticketId = this.feedTicketControl(analysis.id, indicator).value;
    if (
      !this.canAnalyze(indicator) ||
      !this.auth.can('create', 'action_plans') ||
      !analysis.suggestions.length ||
      analysis.action_plan_ids.length ||
      !this.ticketsFor(indicator).some((ticket) => ticket.id === ticketId) ||
      this.feedPlansSavingId()
    )
      return;
    this.feedPlansSavingId.set(analysis.id);
    try {
      const plans = await this.resultAnalysisRepository.createPlans(analysis.id, ticketId);
      this.savedAnalyses.update((items) =>
        items.map((item) =>
          item.id === analysis.id
            ? { ...item, action_plan_ids: plans.map((plan) => plan.id) }
            : item,
        ),
      );
      this.toast.success(`${plans.length} plano(s) de ação criado(s)`);
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao criar planos de ação'));
    } finally {
      this.feedPlansSavingId.set(null);
    }
  }

  authorName(id: string | null): string {
    if (!id) return 'Registro anterior à auditoria';
    return (
      this.resultActors()[id] ??
      (id === this.auth.user()?.id ? (this.auth.profile()?.name ?? id) : id)
    );
  }

  formatTimestamp(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  formatPeriod(value: string): string {
    return displayPeriod(value);
  }

  async saveFeedAnalysis(indicator: Indicator, entry: IndicatorHistoryEntry): Promise<void> {
    const diagnostic = this.feedAnalysisText.value.trim();
    if (!diagnostic || !this.canAnalyze(indicator) || this.feedAnalysisSaving()) return;
    this.feedAnalysisSaving.set(true);
    try {
      const saved = await this.resultAnalysisRepository.create({
        indicator_id: indicator.id,
        history_id: entry.id,
        observed_value: entry.value,
        observed_goal: entry.goal,
        observed_period: entry.period,
        diagnostic,
        suggestions: [],
      });
      this.savedAnalyses.update((items) => [saved, ...items]);
      this.feedAnalysisText.setValue('');
      this.toast.success('Análise crítica registrada');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao registrar análise crítica'));
    } finally {
      this.feedAnalysisSaving.set(false);
    }
  }

  async generateFeedAnalysis(indicator: Indicator, entry: IndicatorHistoryEntry): Promise<void> {
    if (!this.canAnalyze(indicator) || this.feedAiLoading()) return;
    this.feedAiLoading.set(true);
    try {
      const history = sortedHistory(this.history(indicator.id))
        .filter((item) => (periodDate(item) ?? '') <= (periodDate(entry) ?? ''))
        .slice(-12)
        .map((item) => ({ period: item.period, value: item.value, goal: item.goal }));
      const result = await this.indicatorService.generateAnalysis(
        { ...indicator, current_value: entry.value, goal_value: entry.goal },
        {
          period: entry.period,
          on_target: isOnTarget(
            entry.value,
            entry.goal,
            indicator.goal_direction,
            indicator.acceptable_variation,
          ),
          history,
        },
      );
      if (!result) throw new Error('A IA não retornou uma análise.');
      const saved = await this.resultAnalysisRepository.create({
        indicator_id: indicator.id,
        history_id: entry.id,
        observed_value: entry.value,
        observed_goal: entry.goal,
        observed_period: entry.period,
        diagnostic: result.diagnostic,
        suggestions: result.suggestions,
      });
      this.savedAnalyses.update((items) => [saved, ...items]);
      this.toast.success('Sugestões da IA registradas');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao gerar sugestões da IA'));
    } finally {
      this.feedAiLoading.set(false);
    }
  }

  openCreateIndicator(): void {
    if (!this.auth.isAdmin() || !this.activeStatusOptions().length) return;
    this.editing.set(null);
    this.formError.set(null);
    this.form.reset({
      title: '',
      objective: '',
      process_id: '',
      step_id: '',
      goal_value: 0,
      acceptable_variation: 0,
      unit: 'numero_absoluto',
      frequency: 'mensal',
      requires_critical_analysis: false,
      indicator_type: 'processo',
      goal_direction: 'higher',
      strategic: false,
      dimension_id: '',
      calculation_type: 'simple',
      simple_formula: '',
      result_source: '',
      formula_expression: '',
      decimal_places: 2,
      obsolete: false,
      justification: '',
    });
    this.formOpen.set(true);
  }

  openEditIndicator(indicator: Indicator): void {
    if (!this.auth.isAdmin()) return;
    this.editing.set(indicator);
    this.formError.set(null);
    this.form.reset({
      title: indicator.title,
      objective: indicator.objective,
      process_id: indicator.process_id,
      step_id: indicator.step_id ?? '',
      goal_value: indicator.goal_value,
      acceptable_variation: indicator.acceptable_variation,
      unit: indicator.unit,
      frequency: indicator.frequency,
      requires_critical_analysis: indicator.requires_critical_analysis,
      indicator_type: ['estrutura', 'processo', 'resultado'].includes(indicator.indicator_type)
        ? (indicator.indicator_type as IndicatorClassification)
        : 'processo',
      goal_direction: indicator.goal_direction,
      strategic: indicator.strategic,
      dimension_id:
        this.dimensionLinks().find(
          (link) => link.item_type === 'indicator' && link.item_id === indicator.id,
        )?.dimension_id ?? '',
      calculation_type: indicator.calculation_type,
      simple_formula: indicator.simple_formula,
      result_source: indicator.result_source,
      formula_expression:
        indicator.calculation_type === 'composite'
          ? displayIndicatorFormula(indicator.formula_tokens, this.indicators()) ||
            indicator.formula_expression
          : '',
      decimal_places: indicator.decimal_places,
      obsolete: indicator.obsolete,
      justification: '',
    });
    this.formOpen.set(true);
  }

  async saveIndicator(): Promise<void> {
    if (this.formSaving() || !this.auth.isAdmin()) return;
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Preencha os campos obrigatórios e confira os números.');
      return;
    }
    const value = this.form.getRawValue();
    const current = this.editing();
    if (current && !value.justification.trim()) {
      this.formError.set('Informe a justificativa da alteração.');
      return;
    }
    if (value.strategic && !value.dimension_id) {
      this.formError.set('Selecione uma dimensão para o indicador estratégico.');
      return;
    }
    if (
      value.calculation_type === 'simple' &&
      (!value.simple_formula.trim() || !value.result_source.trim())
    ) {
      this.formError.set('Informe a fórmula e a fonte dos resultados.');
      return;
    }
    try {
      const formulaTokens =
        value.calculation_type === 'composite'
          ? compileIndicatorFormula(value.formula_expression, this.indicators(), current?.id)
          : [];
      this.formSaving.set(true);
      const saved = await this.indicatorService.saveDefinition({
        p_id: current?.id ?? null,
        p_title: value.title.trim(),
        p_objective: value.objective.trim(),
        p_process_id: value.process_id,
        p_step_id: value.step_id || null,
        p_frequency: value.frequency,
        p_indicator_type: value.indicator_type,
        p_requires_critical_analysis: value.requires_critical_analysis,
        p_goal_value: value.goal_value,
        p_acceptable_variation: value.acceptable_variation,
        p_unit: value.unit,
        p_goal_direction: value.goal_direction,
        p_strategic: value.strategic,
        p_dimension_id: value.strategic ? value.dimension_id : null,
        p_calculation_type: value.calculation_type,
        p_simple_formula: value.calculation_type === 'simple' ? value.simple_formula.trim() : '',
        p_result_source: value.calculation_type === 'simple' ? value.result_source.trim() : '',
        p_formula_expression:
          value.calculation_type === 'composite' ? value.formula_expression.trim() : '',
        p_formula_tokens: formulaTokens,
        p_decimal_places: value.decimal_places,
        p_obsolete: value.obsolete,
        p_justification: current ? value.justification.trim() : null,
      });
      this.indicators.update((items) =>
        current ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
      );
      this.toast.success(current ? 'Indicador atualizado' : 'Indicador criado');
      this.formOpen.set(false);
      void this.loadIndicators();
    } catch (error) {
      this.formError.set(errorMessage(error, 'Erro ao salvar o indicador'));
    } finally {
      this.formSaving.set(false);
    }
  }

  appendFormulaIndicator(id: string): void {
    const indicator = this.availableFormulaIndicators().find((item) => item.id === id);
    if (!indicator) return;
    const control = this.form.controls.formula_expression;
    control.setValue(
      `${control.value}${control.value && !control.value.endsWith(' ') ? ' ' : ''}{${indicator.code}}`,
    );
  }

  async toggleDefinitionHistory(indicator: Indicator): Promise<void> {
    if (this.historyIndicatorId() === indicator.id) {
      this.historyIndicatorId.set(null);
      return;
    }
    this.historyIndicatorId.set(indicator.id);
    this.historyLoading.set(true);
    try {
      this.definitionHistory.set(await this.indicatorService.fetchDefinitionHistory(indicator.id));
    } catch (error) {
      this.toast.error(errorMessage(error, 'Erro ao carregar histórico da ficha'));
    } finally {
      this.historyLoading.set(false);
    }
  }

  definitionChanges(
    entry: IndicatorDefinitionHistory,
  ): { label: string; before: string; after: string }[] {
    if (!entry.before_data) return [];
    const labels: Record<string, string> = {
      code: 'Código',
      title: 'Nome',
      objective: 'Objetivo',
      process_id: 'Processo',
      step_id: 'Etapa',
      frequency: 'Periodicidade',
      indicator_type: 'Classificação',
      requires_critical_analysis: 'Análise crítica',
      goal_value: 'Meta',
      acceptable_variation: 'Variação aceitável',
      unit: 'Tipo de valor',
      goal_direction: 'Sentido da meta',
      strategic: 'Estratégico',
      dimension_id: 'Dimensão',
      calculation_type: 'Cálculo',
      simple_formula: 'Fórmula simples',
      result_source: 'Fonte dos resultados',
      formula_expression: 'Fórmula composta',
      decimal_places: 'Casas decimais',
      obsolete: 'Obsoleto',
    };
    return Object.entries(labels)
      .filter(([key]) => entry.before_data?.[key] !== entry.after_data[key])
      .map(([key, label]) => ({
        label,
        before: this.definitionValue(key, entry.before_data?.[key]),
        after: this.definitionValue(key, entry.after_data[key]),
      }));
  }

  private definitionValue(key: string, value: unknown): string {
    if (value == null || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (key === 'process_id') return this.processName(String(value));
    if (key === 'dimension_id')
      return this.dimensions().find((item) => item.id === value)?.name ?? String(value);
    if (key === 'step_id')
      return this.nodes().find((item) => item.id === value)?.title ?? String(value);
    return String(value);
  }

  processName(id: string): string {
    return this.processes().find((item) => item.id === id)?.title ?? '—';
  }

  canAnalyze(indicator: Indicator): boolean {
    if (!this.auth.can('create', 'indicators')) return false;
    if (this.auth.isAdmin()) return true;
    const process = this.processes().find((item) => item.id === indicator.process_id);
    return !!process && process.category_id === this.auth.profile()?.category_id;
  }

  formatValue(value: number, unit: IndicatorUnitType, decimalPlaces?: number): string {
    return formatIndicatorValue(value, unit, decimalPlaces);
  }

  unitLabel(unit: IndicatorUnitType): string {
    return indicatorUnitSymbol(unit);
  }

  statusLabel(status: IndicatorStatus): string {
    return this.statusOptions().find((option) => option.key === status)?.label ?? status;
  }

  statusBackground(status: IndicatorStatus): string {
    return (
      this.statusOptions().find((option) => option.key === status)?.badge_background ?? '#f1f5f9'
    );
  }

  statusForeground(status: IndicatorStatus): string {
    return (
      this.statusOptions().find((option) => option.key === status)?.badge_foreground ?? '#475569'
    );
  }

  frequencyLabel(value: IndicatorFrequency): string {
    return this.frequencyOptions().find((option) => option.value === value)?.label ?? value;
  }
}
