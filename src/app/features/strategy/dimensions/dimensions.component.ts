import { errorMessage } from '@shared/utils/error.utils';
import { DimensionService } from '@features/strategy/data-access/dimension.service';
import { ActionPlanService } from '@features/actions/data-access/action-plan.service';
import { IndicatorService } from '@features/indicators/data-access/indicator.service';
import { formatIndicatorValue } from '@features/indicators/data-access/indicator-unit.utils';
import { ProcessService } from '@features/processes/data-access/process.service';
import { IncidentTicketService } from '@features/incidents/data-access/incident-ticket.service';
import { AuthService } from '@core/services/auth.service';
import { ProfileRepository } from '@core/data-access/profile.repository';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
  ActionPlan,
  ActionPlanStatus,
  ActionPlanStatusOption,
  Dimension,
  DimensionClassification,
  DimensionClassificationOption,
  DimensionColor,
  DimensionColorOption,
  DimensionLink,
  DimensionVersion,
  Indicator,
  IndicatorUnitType,
  IndicatorHistoryEntry,
  Process,
  Ticket,
} from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { SideDrawerComponent } from '@shared/components/side-drawer/side-drawer.component';
import { EditHistoryComponent } from '@shared/components/edit-history/edit-history.component';
import { QuickPaletteComponent } from '@shared/components/quick-palette/quick-palette.component';
import { ToastService } from '@shared/services/toast.service';
import { AlertDialogService } from '@shared/services/alert-dialog.service';
import { METHODOLOGIES } from '@shared/data/methodologies';

@Component({
  selector: 'app-dimensions',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IconDirective,
    ModalComponent,
    SideDrawerComponent,
    EditHistoryComponent,
    MethodologyComponent,
    QuickPaletteComponent,
  ],
  templateUrl: './dimensions.component.html',
  styleUrl: './dimensions.component.scss',
})
export class DimensionsComponent {
  private readonly dimensionService = inject(DimensionService);
  private readonly actionPlanService = inject(ActionPlanService);
  private readonly indicatorService = inject(IndicatorService);
  private readonly processService = inject(ProcessService);
  private readonly ticketService = inject(IncidentTicketService);
  private readonly profileRepository = inject(ProfileRepository);
  private readonly toast = inject(ToastService);
  private readonly alertDialog = inject(AlertDialogService);
  readonly auth = inject(AuthService);
  readonly methodology = METHODOLOGIES['dimensoes'];
  readonly classifications = signal<DimensionClassificationOption[]>([]);
  readonly colors = signal<DimensionColorOption[]>([]);
  readonly activeColors = computed(() => this.colors().filter((option) => option.is_active));
  readonly paletteColors = computed(() => this.activeColors().map((option) => option.line_color));
  readonly formClassifications = computed(() => {
    const editingKey = this.editing()?.classification_key;
    return this.classifications().filter(
      (classification) =>
        classification.is_active || classification.classification_key === editingKey,
    );
  });
  readonly versions = signal<DimensionVersion[]>([]);
  readonly profileNames = signal<Record<string, string>>({});
  readonly selectedVersionId = signal<string | null>(null);
  readonly versionSelection = new FormControl('', { nonNullable: true });
  readonly dimensions = signal<Dimension[]>([]);
  readonly links = signal<DimensionLink[]>([]);
  readonly indicators = signal<Indicator[]>([]);
  readonly plans = signal<ActionPlan[]>([]);
  readonly planStatuses = signal<ActionPlanStatusOption[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly tickets = signal<Ticket[]>([]);
  readonly histories = signal<Record<string, IndicatorHistoryEntry[]>>({});
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<Dimension | null>(null);
  readonly historyDimension = signal<Dimension | null>(null);
  readonly saving = signal(false);
  readonly selectedIndicatorIds = signal<Set<string>>(new Set());
  readonly selectedPlanIds = signal<Set<string>>(new Set());
  readonly indicatorSearch = signal('');
  readonly planSearch = signal('');
  readonly selectedDimension = signal<Dimension | null>(null);
  readonly historyLoading = signal(false);
  readonly versionOpen = signal(false);
  readonly versionSaving = signal(false);
  readonly versionError = signal<string | null>(null);
  readonly versionLabel = new FormControl('', {
    nonNullable: true,
    validators: Validators.required,
  });
  readonly methodologyOpen = signal(false);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    description: new FormControl('', { nonNullable: true }),
    objective: new FormControl('', { nonNullable: true }),
    classification_key: new FormControl<DimensionClassification>('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    color_key: new FormControl<DimensionColor>('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    justification: new FormControl('', { nonNullable: true }),
  });
  readonly filteredIndicators = computed(() => {
    const term = this.normalizeSearch(this.indicatorSearch());
    return this.indicators().filter((item) =>
      this.normalizeSearch(`${item.title} ${this.processName(item.process_id)}`).includes(term),
    );
  });
  readonly filteredPlans = computed(() => {
    const term = this.normalizeSearch(this.planSearch());
    return this.plans().filter((item) =>
      this.normalizeSearch(`${item.title} ${this.processName(this.itemProcessId(item))}`).includes(
        term,
      ),
    );
  });
  readonly orderedVersions = computed(() =>
    [...this.versions()].sort((a, b) => b.version_number - a.version_number),
  );
  readonly currentVersion = computed(() => this.orderedVersions()[0] ?? null);
  readonly selectedVersion = computed(
    () => this.versions().find((item) => item.id === this.selectedVersionId()) ?? null,
  );
  readonly canManage = computed(
    () =>
      this.auth.canEditPage('dimensoes') &&
      !this.loading() &&
      !this.error() &&
      this.selectedVersionId() === this.currentVersion()?.id,
  );
  readonly ordered = computed(() =>
    [...this.dimensions()].sort(
      (a, b) => a.order_index - b.order_index || a.code.localeCompare(b.code),
    ),
  );
  private versionRequestId = 0;
  private historyRequestId = 0;

  constructor() {
    this.versionSelection.valueChanges.pipe(takeUntilDestroyed()).subscribe((versionId) => {
      void this.selectVersion(versionId);
    });
    void this.loadDimensions();
  }

  async loadDimensions(): Promise<void> {
    const requestId = ++this.versionRequestId;
    this.loading.set(true);
    this.error.set(null);
    try {
      const [
        versions,
        indicators,
        plans,
        processes,
        tickets,
        classifications,
        planStatuses,
        colors,
      ] = await Promise.all([
        this.dimensionService.fetchVersions(),
        this.indicatorService.fetchIndicators(),
        this.actionPlanService.fetchActionPlans(),
        this.processService.fetchProcesses(),
        this.ticketService.fetchTickets(),
        this.dimensionService.fetchClassifications(),
        this.actionPlanService.fetchStatuses(),
        this.dimensionService.fetchColors(),
      ]);
      if (requestId !== this.versionRequestId) return;
      this.versions.set(versions);
      const profiles = await this.profileRepository.findAll();
      this.profileNames.set(
        Object.fromEntries(profiles.map((profile) => [profile.id, profile.name])),
      );
      this.indicators.set(indicators);
      this.plans.set(plans);
      this.planStatuses.set(planStatuses);
      this.processes.set(processes);
      this.tickets.set(tickets);
      this.classifications.set(classifications);
      this.colors.set(colors);
      const selectedId = versions.some((item) => item.id === this.selectedVersionId())
        ? this.selectedVersionId()
        : this.currentVersion()?.id;
      if (selectedId) await this.selectVersion(selectedId);
    } catch (error) {
      if (requestId === this.versionRequestId)
        this.error.set(errorMessage(error, 'Erro ao carregar dimensões'));
    } finally {
      if (requestId === this.versionRequestId) this.loading.set(false);
    }
  }

  async selectVersion(versionId: string): Promise<void> {
    if (!this.versions().some((item) => item.id === versionId)) return;
    const requestId = ++this.versionRequestId;
    this.selectedVersionId.set(versionId);
    this.versionSelection.setValue(versionId, { emitEvent: false });
    this.closeDetail();
    this.formOpen.set(false);
    this.loading.set(true);
    this.error.set(null);
    try {
      const [dimensions, links] = await Promise.all([
        this.dimensionService.fetchDimensions(versionId),
        this.dimensionService.fetchAllDimensionLinks(versionId),
      ]);
      if (requestId !== this.versionRequestId) return;
      this.dimensions.set(dimensions);
      this.links.set(links);
    } catch (error) {
      if (requestId === this.versionRequestId)
        this.error.set(errorMessage(error, 'Erro ao carregar a versão'));
    } finally {
      if (requestId === this.versionRequestId) this.loading.set(false);
    }
  }

  linkedIndicators(id: string): Indicator[] {
    const linked = new Set(
      this.links()
        .filter((item) => item.dimension_id === id && item.item_type === 'indicator')
        .map((item) => item.item_id),
    );
    return this.indicators().filter((item) => linked.has(item.id));
  }

  linkedPlans(id: string): ActionPlan[] {
    const linked = new Set(
      this.links()
        .filter((item) => item.dimension_id === id && item.item_type === 'action_plan')
        .map((item) => item.item_id),
    );
    return this.plans().filter((item) => linked.has(item.id));
  }

  async openDetail(item: Dimension): Promise<void> {
    const requestId = ++this.historyRequestId;
    this.selectedDimension.set(item);
    this.histories.set({});
    const indicators = this.linkedIndicators(item.id);
    if (!indicators.length) return;
    this.historyLoading.set(true);
    try {
      const histories = await this.indicatorService.fetchHistories(indicators);
      if (requestId === this.historyRequestId) this.histories.set(histories);
    } catch (error) {
      if (requestId === this.historyRequestId)
        this.toast.error(errorMessage(error, 'Erro ao carregar histórico dos indicadores'));
    } finally {
      if (requestId === this.historyRequestId) this.historyLoading.set(false);
    }
  }

  closeDetail(): void {
    ++this.historyRequestId;
    this.selectedDimension.set(null);
    this.historyLoading.set(false);
  }

  openCreate(): void {
    if (!this.canManage() || !this.activeColors().length) return;
    this.editing.set(null);
    this.selectedIndicatorIds.set(new Set());
    this.selectedPlanIds.set(new Set());
    this.indicatorSearch.set('');
    this.planSearch.set('');
    this.form.reset({
      name: '',
      description: '',
      objective: '',
      classification_key: this.defaultClassificationKey(),
      color_key: this.defaultColor(),
      justification: '',
    });
    this.formOpen.set(true);
  }

  openEdit(item: Dimension): void {
    if (!this.canManage() || item.version_id !== this.selectedVersionId()) return;
    this.editing.set(item);
    this.selectedIndicatorIds.set(new Set(this.linkedIndicators(item.id).map((entry) => entry.id)));
    this.selectedPlanIds.set(new Set(this.linkedPlans(item.id).map((entry) => entry.id)));
    this.indicatorSearch.set('');
    this.planSearch.set('');
    this.form.reset({
      name: item.name,
      description: item.description ?? '',
      objective: item.objective ?? '',
      classification_key: item.classification_key,
      color_key: this.colorLine(item.color_key),
      justification: '',
    });
    this.formOpen.set(true);
  }

  toggleIndicator(id: string, checked: boolean): void {
    this.selectedIndicatorIds.update((items) => {
      const next = new Set(items);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  togglePlan(id: string, checked: boolean): void {
    this.selectedPlanIds.update((items) => {
      const next = new Set(items);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async saveDimension(): Promise<void> {
    const versionId = this.selectedVersionId();
    if (!this.canManage() || !versionId || this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    if (!value.name.trim()) {
      this.form.controls.name.setErrors({ required: true });
      return;
    }
    if (this.editing() && !value.justification.trim()) {
      this.toast.error('Informe a justificativa da alteração.');
      return;
    }
    this.saving.set(true);
    try {
      await this.dimensionService.saveWithLinks({
        id: this.editing()?.id ?? null,
        versionId,
        name: value.name.trim(),
        description: value.description,
        objective: value.objective,
        classificationKey: value.classification_key,
        colorKey: value.color_key,
        orderIndex:
          this.editing()?.order_index ??
          Math.max(-1, ...this.dimensions().map((item) => item.order_index)) + 1,
        indicatorIds: [...this.selectedIndicatorIds()],
        planIds: [...this.selectedPlanIds()],
        justification: this.editing() ? value.justification.trim() : null,
      });
      this.formOpen.set(false);
      await this.selectVersion(versionId);
      this.toast.success('Dimensão salva');
    } catch (error) {
      this.toast.error(errorMessage(error, 'Erro ao salvar dimensão'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteDimension(item: Dimension): Promise<void> {
    if (!this.canManage() || item.version_id !== this.selectedVersionId()) return;
    if (!(await this.alertDialog.confirm(`Excluir a dimensão ${item.code} desta versão?`))) return;
    try {
      await this.dimensionService.deleteDimension(item.id);
      this.dimensions.update((items) => items.filter((entry) => entry.id !== item.id));
      this.links.update((items) => items.filter((link) => link.dimension_id !== item.id));
      this.toast.success('Dimensão excluída');
    } catch (error) {
      this.toast.error(errorMessage(error, 'Erro ao excluir dimensão'));
    }
  }

  openNewVersion(): void {
    if (!this.auth.canEditPage('dimensoes')) return;
    this.versionLabel.setValue(`Planejamento ${new Date().getFullYear()}`);
    this.versionError.set(null);
    this.versionOpen.set(true);
  }

  async createVersion(): Promise<void> {
    if (
      !this.auth.canEditPage('dimensoes') ||
      this.versionSaving() ||
      !this.versionLabel.value.trim()
    )
      return;
    this.versionSaving.set(true);
    this.versionError.set(null);
    try {
      const version = await this.dimensionService.createVersion(this.versionLabel.value.trim());
      const versions = await this.dimensionService.fetchVersions();
      if (!versions.some((item) => item.id === version.id)) {
        throw new Error(
          'A versão foi criada, mas não apareceu na consulta. Atualize a tela e tente novamente.',
        );
      }
      this.versions.set(versions);
      this.versionOpen.set(false);
      await this.selectVersion(version.id);
      this.toast.success(`Versão ${version.version_number} criada`);
    } catch (error) {
      const message = errorMessage(error, 'Erro ao criar versão');
      this.versionError.set(message);
      this.toast.error(message);
    } finally {
      this.versionSaving.set(false);
    }
  }

  classificationLabel(key: DimensionClassification): string {
    return this.classifications().find((item) => item.classification_key === key)?.label ?? key;
  }

  classificationIcon(key: DimensionClassification): string {
    return (
      this.classifications().find((item) => item.classification_key === key)?.icon ?? 'Workflow'
    );
  }

  private defaultClassificationKey(): DimensionClassification {
    return (
      this.classifications().find((item) => item.is_active && item.is_default)
        ?.classification_key ??
      this.classifications().find((item) => item.is_active)?.classification_key ??
      ''
    );
  }

  private defaultColor(): DimensionColor {
    return (
      this.activeColors().find((option) => option.is_default)?.line_color ??
      this.activeColors()[0]?.line_color ??
      '#006acc'
    );
  }

  colorBackground(key: DimensionColor): string {
    if (/^#[0-9a-fA-F]{6}$/.test(key)) return `${key}1a`;
    return this.colors().find((option) => option.key === key)?.background_color ?? '#f1f5f9';
  }

  colorForeground(key: DimensionColor): string {
    if (/^#[0-9a-fA-F]{6}$/.test(key)) return key;
    return this.colors().find((option) => option.key === key)?.foreground_color ?? '#475569';
  }

  colorLine(key: DimensionColor): string {
    if (/^#[0-9a-fA-F]{6}$/.test(key)) return key;
    return this.colors().find((option) => option.key === key)?.line_color ?? '#64748b';
  }

  processName(id: string | null): string {
    return this.processes().find((item) => item.id === id)?.title ?? 'Processo indisponível';
  }

  versionAuthor(version: DimensionVersion): string {
    return (
      (version.created_by && this.profileNames()[version.created_by]) || 'Usuário indisponível'
    );
  }

  versionCreatedAt(version: DimensionVersion): string {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(version.created_at));
  }

  private normalizeSearch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .trim();
  }

  itemProcessId(item: Indicator | ActionPlan): string | null {
    return (
      item.process_id ??
      ('ticket_id' in item
        ? (this.tickets().find((ticket) => ticket.id === item.ticket_id)?.process_id ?? null)
        : null)
    );
  }

  history(id: string): IndicatorHistoryEntry[] {
    return [...(this.histories()[id] ?? [])].sort(
      (a, b) => a.period.localeCompare(b.period) || a.created_at.localeCompare(b.created_at),
    );
  }

  chartPoints(id: string, field: 'value' | 'goal'): string {
    const entries = this.history(id).slice(-12);
    if (!entries.length) return '';
    const values = entries.flatMap((item) => [item.value, item.goal]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return entries
      .map((item, index) => {
        const x = entries.length === 1 ? 160 : 16 + (index * 288) / (entries.length - 1);
        const y = 94 - ((item[field] - min) / range) * 78;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  formatValue(value: number, unit: IndicatorUnitType): string {
    return formatIndicatorValue(value, unit);
  }

  planStatusLabel(status: ActionPlanStatus): string {
    return this.planStatuses().find((option) => option.key === status)?.label ?? status;
  }

  planStatusColor(status: ActionPlanStatus): string {
    return (
      this.planStatuses().find((option) => option.key === status)?.header_foreground ?? '#475569'
    );
  }

  completedPlans(id: string): number {
    return this.linkedPlans(id).filter(
      (item) => this.planStatuses().find((option) => option.key === item.status)?.is_terminal,
    ).length;
  }

  planCompletionPercent(id: string): number {
    const total = this.linkedPlans(id).length;
    return total ? (this.completedPlans(id) / total) * 100 : 0;
  }
}
