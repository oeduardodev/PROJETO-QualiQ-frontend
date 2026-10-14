import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActionPlanService } from '@features/actions/data-access/action-plan.service';
import { DocumentService } from '@features/documents/data-access/document.service';
import { IndicatorService } from '@features/indicators/data-access/indicator.service';
import { formatIndicatorValue } from '@features/indicators/data-access/indicator-unit.utils';
import { ProcessService } from '@features/processes/data-access/process.service';
import { SlaService } from '@features/processes/data-access/sla.service';
import { RiskService } from '@features/risks/data-access/risk.service';
import { DimensionService } from '@features/strategy/data-access/dimension.service';
import { AuthService } from '@core/services/auth.service';
import type {
  ActionPlan,
  Dimension,
  DimensionLink,
  GEDDocument,
  Indicator,
  IndicatorUnitType,
  Process,
  Risk,
  SipocNode,
  SLA,
  ValueChainCategory,
} from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { QuickPaletteComponent } from '@shared/components/quick-palette/quick-palette.component';
import { METHODOLOGIES } from '@shared/data/methodologies';
import { ToastService } from '@shared/services/toast.service';
import { errorMessage } from '@shared/utils/error.utils';

interface CategoryLane extends ValueChainCategory {
  processes: Process[];
}

interface ProcessSummary {
  nodes: SipocNode[];
  indicators: Indicator[];
  documents: GEDDocument[];
  slas: SLA[];
  risks: Risk[];
  plans: ActionPlan[];
}

const MATRIX_COLORS: Record<string, string> = {
  blue: '#3b82f6',
  green: '#10b981',
  orange: '#f97316',
  amber: '#f59e0b',
  rose: '#f43f5e',
  violet: '#8b5cf6',
};

@Component({
  selector: 'app-value-matrix',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IconDirective,
    MethodologyComponent,
    ModalComponent,
    QuickPaletteComponent,
  ],
  templateUrl: './value-matrix.component.html',
  styleUrl: './value-matrix.component.scss',
})
export class ValueMatrixComponent {
  private readonly processService = inject(ProcessService);
  private readonly dimensionService = inject(DimensionService);
  private readonly indicatorService = inject(IndicatorService);
  private readonly documentService = inject(DocumentService);
  private readonly slaService = inject(SlaService);
  private readonly riskService = inject(RiskService);
  private readonly actionPlanService = inject(ActionPlanService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly methodology = METHODOLOGIES['valor'];
  readonly paletteColors = Object.values(MATRIX_COLORS);

  formatIndicatorValue(value: number, unit: IndicatorUnitType): string {
    return formatIndicatorValue(value, unit);
  }

  readonly methodologyOpen = signal(false);
  readonly manageMode = signal(false);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly categories = signal<CategoryLane[]>([]);
  readonly dimensions = signal<Dimension[]>([]);
  readonly dimensionLinks = signal<DimensionLink[]>([]);
  readonly selectedProcess = signal<Process | null>(null);
  readonly summary = signal<ProcessSummary | null>(null);
  readonly summaryLoading = signal(false);
  readonly summaryError = signal<string | null>(null);
  readonly categoryEditorOpen = signal(false);
  readonly editingCategory = signal<ValueChainCategory | null>(null);
  readonly categorySaving = signal(false);
  readonly categoryError = signal<string | null>(null);
  readonly reordering = signal(false);
  readonly draggedProcessId = signal<string | null>(null);
  readonly categoryForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    description: new FormControl('', { nonNullable: true }),
    color_key: new FormControl(MATRIX_COLORS['blue'], {
      nonNullable: true,
      validators: Validators.required,
    }),
  });
  readonly total = computed(() =>
    this.categories().reduce((sum, item) => sum + item.processes.length, 0),
  );
  readonly strategicProcessIds = computed(
    () =>
      new Set(
        this.dimensionLinks()
          .filter((link) => link.item_type === 'indicator' || link.item_type === 'action_plan')
          .map((link) => link.process_id),
      ),
  );
  private summaryRequestId = 0;

  constructor() {
    void this.loadValueMatrix();
  }

  async loadValueMatrix(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [categories, processes, currentDimensions] = await Promise.all([
        this.processService.fetchCategories(),
        this.processService.fetchProcesses(),
        this.dimensionService.fetchCurrentData(),
      ]);
      this.categories.set(
        categories.map((category) => ({
          ...category,
          processes: processes
            .filter((process) => process.category_id === category.id && !process.obsolete)
            .sort((a, b) =>
              a.order_index === b.order_index
                ? a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
                : a.order_index - b.order_index,
            ),
        })),
      );
      this.dimensions.set(currentDimensions.dimensions);
      this.dimensionLinks.set(currentDimensions.links);
    } catch (error) {
      this.error.set(errorMessage(error, 'Erro ao carregar dados'));
    } finally {
      this.loading.set(false);
    }
  }

  colorHex(key: string): string {
    return /^#[0-9a-fA-F]{6}$/.test(key) ? key : (MATRIX_COLORS[key] ?? MATRIX_COLORS['blue']);
  }

  categoryName(categoryId: string): string {
    return this.categories().find((lane) => lane.id === categoryId)?.name ?? 'Sem classificação';
  }

  strategicDimensions(processId: string): string[] {
    const dimensionIds = new Set(
      this.dimensionLinks()
        .filter(
          (link) =>
            link.process_id === processId &&
            (link.item_type === 'indicator' || link.item_type === 'action_plan'),
        )
        .map((link) => link.dimension_id),
    );
    return this.dimensions()
      .filter((dimension) => dimensionIds.has(dimension.id))
      .map((dimension) => dimension.name);
  }

  async openSummary(process: Process): Promise<void> {
    const requestId = ++this.summaryRequestId;
    this.selectedProcess.set(process);
    this.summary.set(null);
    this.summaryError.set(null);
    this.summaryLoading.set(true);
    try {
      const [nodes, indicators, documents, slas, risks, plans] = await Promise.all([
        this.processService.fetchRelevantNodes(process.id),
        this.indicatorService.fetchIndicatorsByProcess(process.id),
        this.documentService.fetchDocumentsByProcess(process.id),
        this.slaService.fetchSlasByProcess(process.id),
        this.riskService.fetchRisksByProcess(process.id),
        this.actionPlanService.fetchActionPlansByProcess(process.id),
      ]);
      if (requestId === this.summaryRequestId) {
        this.summary.set({ nodes, indicators, documents, slas, risks, plans });
      }
    } catch (error) {
      if (requestId === this.summaryRequestId) {
        this.summaryError.set(errorMessage(error, 'Erro ao carregar o resumo do processo'));
      }
    } finally {
      if (requestId === this.summaryRequestId) this.summaryLoading.set(false);
    }
  }

  closeSummary(): void {
    this.summaryRequestId++;
    this.selectedProcess.set(null);
    this.summary.set(null);
    this.summaryLoading.set(false);
  }

  mappedSteps(nodes: SipocNode[]): SipocNode[] {
    return nodes.filter((node) => node.node_type === 'P');
  }

  nodeCount(nodes: SipocNode[], type: SipocNode['node_type']): number {
    return nodes.filter((node) => node.node_type === type).length;
  }

  slaRelation(sla: SLA, processId: string): string {
    if (sla.client_process_id === processId && sla.supplier_process_id === processId) {
      return 'Cliente e fornecedor';
    }
    return sla.client_process_id === processId ? 'Cliente' : 'Fornecedor';
  }

  toggleManageMode(): void {
    if (!this.auth.isAdmin() || this.reordering()) return;
    this.manageMode.update((active) => !active);
    this.draggedProcessId.set(null);
  }

  openCreateCategory(): void {
    if (!this.auth.isAdmin() || !this.manageMode()) return;
    this.editingCategory.set(null);
    this.categoryError.set(null);
    this.categoryForm.reset({ name: '', description: '', color_key: MATRIX_COLORS['blue'] });
    this.categoryEditorOpen.set(true);
  }

  openEditCategory(category: ValueChainCategory): void {
    if (!this.auth.isAdmin() || !this.manageMode()) return;
    this.editingCategory.set(category);
    this.categoryError.set(null);
    this.categoryForm.reset({
      name: category.name,
      description: category.description ?? '',
      color_key: this.colorHex(category.color_key),
    });
    this.categoryEditorOpen.set(true);
  }

  async saveCategory(): Promise<void> {
    if (
      !this.auth.isAdmin() ||
      !this.manageMode() ||
      this.categoryForm.invalid ||
      this.categorySaving()
    )
      return;
    const value = this.categoryForm.getRawValue();
    const name = value.name.trim();
    if (!name) {
      this.categoryError.set('Informe o nome da classificação.');
      return;
    }
    this.categorySaving.set(true);
    this.categoryError.set(null);
    try {
      const current = this.editingCategory();
      const payload = {
        name,
        description: value.description.trim() || null,
        color_key: value.color_key,
      };
      if (current) {
        const saved = await this.processService.updateCategory(current.id, payload);
        this.categories.update((lanes) =>
          lanes.map((lane) =>
            lane.id === saved.id ? { ...saved, processes: lane.processes } : lane,
          ),
        );
      } else {
        const saved = await this.processService.createCategory({
          ...payload,
          order_index: Math.max(-1, ...this.categories().map((lane) => lane.order_index)) + 1,
        });
        this.categories.update((lanes) => [...lanes, { ...saved, processes: [] }]);
      }
      this.categoryEditorOpen.set(false);
      this.toast.success('Classificação salva');
    } catch (error) {
      this.categoryError.set(errorMessage(error, 'Erro ao salvar classificação'));
    } finally {
      this.categorySaving.set(false);
    }
  }

  async moveCategory(categoryId: string, direction: -1 | 1): Promise<void> {
    if (!this.auth.isAdmin() || !this.manageMode() || this.reordering()) return;
    const lanes = [...this.categories()];
    const index = lanes.findIndex((lane) => lane.id === categoryId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= lanes.length) return;
    [lanes[index], lanes[next]] = [lanes[next], lanes[index]];
    this.reordering.set(true);
    try {
      const first = Math.min(index, next);
      await Promise.all(
        lanes
          .slice(first, first + 2)
          .map((lane, offset) =>
            this.processService.updateCategory(lane.id, { order_index: first + offset }),
          ),
      );
      this.categories.set(lanes.map((lane, order_index) => ({ ...lane, order_index })));
    } catch (error) {
      this.toast.error(errorMessage(error, 'Erro ao ordenar classificações'));
      await this.loadValueMatrix();
    } finally {
      this.reordering.set(false);
    }
  }

  onDragStart(event: DragEvent, process: Process): void {
    if (!this.auth.isAdmin() || !this.manageMode() || this.reordering()) return;
    this.draggedProcessId.set(process.id);
    event.dataTransfer?.setData('text/plain', process.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragOver(event: DragEvent): void {
    if (this.auth.isAdmin() && this.manageMode() && !this.reordering() && this.draggedProcessId()) {
      event.preventDefault();
    }
  }

  onDrop(event: DragEvent, categoryId: string, targetId: string): void {
    event.preventDefault();
    const sourceId = this.draggedProcessId();
    this.draggedProcessId.set(null);
    if (!this.auth.isAdmin() || !this.manageMode() || !sourceId || sourceId === targetId) return;
    const lane = this.categories().find((item) => item.id === categoryId);
    if (!lane) return;
    const from = lane.processes.findIndex((item) => item.id === sourceId);
    const to = lane.processes.findIndex((item) => item.id === targetId);
    if (from >= 0 && to >= 0) void this.reorderProcesses(categoryId, from, to);
  }

  moveProcess(categoryId: string, processId: string, direction: -1 | 1): void {
    const lane = this.categories().find((item) => item.id === categoryId);
    if (!lane) return;
    const from = lane.processes.findIndex((item) => item.id === processId);
    const to = from + direction;
    if (from >= 0 && to >= 0 && to < lane.processes.length) {
      void this.reorderProcesses(categoryId, from, to);
    }
  }

  private async reorderProcesses(categoryId: string, from: number, to: number): Promise<void> {
    if (!this.auth.isAdmin() || !this.manageMode() || this.reordering()) return;
    const lane = this.categories().find((item) => item.id === categoryId);
    if (!lane) return;
    const positions = lane.processes.map((process) => process.order_index);
    const processes = [...lane.processes];
    const [moved] = processes.splice(from, 1);
    processes.splice(to, 0, moved);
    this.reordering.set(true);
    try {
      const first = Math.min(from, to);
      const last = Math.max(from, to);
      for (let index = first; index <= last; index++) {
        await this.processService.updateProcess(processes[index].id, {
          order_index: positions[index],
        });
      }
      this.categories.update((lanes) =>
        lanes.map((item) =>
          item.id === categoryId
            ? {
                ...item,
                processes: processes.map((process, index) => ({
                  ...process,
                  order_index: positions[index],
                })),
              }
            : item,
        ),
      );
    } catch (error) {
      this.toast.error(errorMessage(error, 'Erro ao ordenar processos'));
      await this.loadValueMatrix();
    } finally {
      this.reordering.set(false);
    }
  }
}
