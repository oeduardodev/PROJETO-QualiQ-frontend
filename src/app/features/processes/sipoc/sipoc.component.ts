import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { errorMessage } from '@shared/utils/error.utils';
import { COLUMNS, LABELS } from './sipoc.constants';
import { ProcessService } from '@features/processes/data-access/process.service';
import { processTag } from '@features/processes/data-access/process-code.utils';
import { IndicatorService } from '@features/indicators/data-access/indicator.service';
import { formatIndicatorValue } from '@features/indicators/data-access/indicator-unit.utils';
import { RiskService } from '@features/risks/data-access/risk.service';
import { DocumentService } from '@features/documents/data-access/document.service';
import { SlaService } from '@features/processes/data-access/sla.service';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import type {
  NodeType,
  Indicator,
  IndicatorUnitType,
  Risk,
  GEDDocument,
  SLA,
  Process,
  SipocNode,
  SipocStepAssociation,
  ValueChainCategory,
} from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { SideDrawerComponent } from '@shared/components/side-drawer/side-drawer.component';
import { EditHistoryComponent } from '@shared/components/edit-history/edit-history.component';
import { ToastService } from '@shared/services/toast.service';
import { AlertDialogService } from '@shared/services/alert-dialog.service';
import { METHODOLOGIES } from '@shared/data/methodologies';

type CustomFieldType = 'text' | 'number' | 'date' | 'link';
interface CustomFieldEntry {
  key: string;
  label: string;
  type: CustomFieldType;
  value: string;
}

@Component({
  selector: 'app-sipoc',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    IconDirective,
    MethodologyComponent,
    SideDrawerComponent,
    EditHistoryComponent,
  ],
  templateUrl: './sipoc.component.html',
  styleUrl: './sipoc.component.scss',
})
export class SipocComponent {
  private readonly processService = inject(ProcessService);
  private readonly indicatorService = inject(IndicatorService);
  private readonly riskService = inject(RiskService);
  private readonly documentService = inject(DocumentService);
  private readonly slaService = inject(SlaService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly alertDialog = inject(AlertDialogService);
  readonly columns = COLUMNS;
  readonly LABELS = LABELS;
  readonly methodology = METHODOLOGIES['sipoc'];

  formatIndicatorValue(value: number, unit: IndicatorUnitType): string {
    return formatIndicatorValue(value, unit);
  }

  processCode(process: Process | null): string {
    return processTag(process?.code ?? null) || '—';
  }

  readonly processes = signal<Process[]>([]);
  readonly categories = signal<ValueChainCategory[]>([]);
  readonly allNodes = signal<SipocNode[]>([]);
  readonly stepAssociations = signal<SipocStepAssociation[]>([]);
  readonly selectedStepId = signal<string | null>(null);
  readonly processDetailOpen = signal(false);
  readonly processDetailTab = signal<'sipoc' | 'risks' | 'indicators' | 'documents' | 'slas'>(
    'sipoc',
  );
  readonly processDetailLoading = signal(false);
  readonly processDetailError = signal<string | null>(null);
  readonly detailRisks = signal<Risk[]>([]);
  readonly detailIndicators = signal<Indicator[]>([]);
  readonly detailDocuments = signal<GEDDocument[]>([]);
  readonly detailSlas = signal<SLA[]>([]);
  readonly loading = signal(true);
  readonly nodesLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly methodologyOpen = signal(false);
  readonly nodeOpen = signal(false);
  readonly editingNode = signal<SipocNode | null>(null);
  readonly historyNode = signal<SipocNode | null>(null);
  readonly nodeType = signal<NodeType>('S');
  readonly nodeError = signal<string | null>(null);
  readonly customFields = signal<CustomFieldEntry[]>([]);
  readonly customFieldsDirty = signal(false);
  readonly newCustomFieldLabel = signal('');
  readonly newCustomFieldType = signal<CustomFieldType>('text');
  readonly saving = signal(false);
  readonly associationOpen = signal(false);
  readonly associationType = signal<NodeType>('S');
  readonly associationNodes = signal<SipocNode[]>([]);
  readonly associationIds = signal(new Set<string>());
  readonly associationLoading = signal(false);
  readonly processControl = new FormControl('', { nonNullable: true });
  readonly selectedProcessId = toSignal(this.processControl.valueChanges, { initialValue: '' });
  readonly nodeForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    description: new FormControl('', { nonNullable: true }),
    justification: new FormControl('', { nonNullable: true }),
  });
  readonly selectedStep = computed(
    () => this.allNodes().find((node) => node.id === this.selectedStepId()) ?? null,
  );
  readonly selectedProcess = computed(
    () => this.processes().find((process) => process.id === this.selectedProcessId()) ?? null,
  );
  private nodesRequestId = 0;

  constructor() {
    this.processControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      if (id) void this.loadNodes(id);
      else {
        this.nodesRequestId++;
        this.allNodes.set([]);
        this.stepAssociations.set([]);
        this.selectedStepId.set(null);
        this.nodesLoading.set(false);
      }
    });
    void this.loadProcesses();
  }

  async loadProcesses(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [processes, categories] = await Promise.all([
        this.processService.fetchProcesses(),
        this.processService.fetchCategories(),
      ]);
      this.processes.set(processes);
      this.categories.set(categories);
      if (processes.length) this.processControl.setValue(processes[0].id);
    } catch (e) {
      this.error.set(errorMessage(e, 'Erro ao carregar processos'));
    } finally {
      this.loading.set(false);
    }
  }

  async loadNodes(processId: string): Promise<void> {
    const requestId = ++this.nodesRequestId;
    this.nodesLoading.set(true);
    this.processDetailOpen.set(false);
    this.selectedStepId.set(null);
    try {
      const relevant = await this.processService.fetchRelevantNodes(processId);
      const associations = await this.processService.fetchNodeStepAssociations(relevant);
      if (requestId !== this.nodesRequestId) return;
      this.allNodes.set(relevant);
      this.stepAssociations.set(associations);
    } catch {
      if (requestId !== this.nodesRequestId) return;
      this.allNodes.set([]);
      this.stepAssociations.set([]);
    } finally {
      if (requestId === this.nodesRequestId) this.nodesLoading.set(false);
    }
  }

  nodesFor(type: NodeType): SipocNode[] {
    const nodes = this.allNodes().filter((node) => node.node_type === type);
    if (type === 'P' || !this.selectedStepId()) return nodes;
    const ids = new Set(
      this.stepAssociations()
        .filter((item) => item.step_node_id === this.selectedStepId())
        .map((item) => item.associated_node_id),
    );
    return nodes.filter((node) => ids.has(node.id));
  }

  openCreateNode(type: NodeType): void {
    this.editingNode.set(null);
    this.nodeType.set(type);
    this.nodeForm.reset({ title: '', description: '', justification: '' });
    this.nodeError.set(null);
    this.customFields.set([]);
    this.customFieldsDirty.set(false);
    this.nodeOpen.set(true);
  }

  openNode(node: SipocNode): void {
    if (node.node_type === 'P') {
      this.selectedStepId.update((id) => (id === node.id ? null : node.id));
      if (this.selectedStepId()) void this.openProcessDetail();
      return;
    }
    this.openNodeEditor(node);
  }

  openNodeEditor(node: SipocNode): void {
    this.editingNode.set(node);
    this.nodeType.set(node.node_type);
    this.nodeForm.reset({
      title: node.title,
      description: node.description ?? '',
      justification: '',
    });
    this.nodeError.set(null);
    const raw = node.custom_fields ?? {};
    this.customFields.set(
      Object.entries(raw)
        .filter(([key]) => !key.startsWith('_meta_'))
        .map(([key, value]) => {
          const meta = raw[`_meta_${key}`];
          const info =
            meta && typeof meta === 'object' ? (meta as { label?: string; type?: string }) : {};
          const type =
            info.type === 'number' || info.type === 'date' || info.type === 'link'
              ? info.type
              : 'text';
          return { key, label: info.label || key, type, value: String(value ?? '') };
        }),
    );
    this.customFieldsDirty.set(false);
    this.nodeOpen.set(true);
  }

  addCustomField(): void {
    const label = this.newCustomFieldLabel().trim();
    const key = label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s_]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    if (!key || this.customFields().some((entry) => entry.key === key)) return;
    this.customFields.update((items) => [
      ...items,
      { key, label, type: this.newCustomFieldType(), value: '' },
    ]);
    this.customFieldsDirty.set(true);
    this.newCustomFieldLabel.set('');
    this.newCustomFieldType.set('text');
  }

  updateCustomField(key: string, value: string): void {
    this.customFields.update((items) =>
      items.map((item) => (item.key === key ? { ...item, value } : item)),
    );
    this.customFieldsDirty.set(true);
  }

  setCustomFieldType(type: string): void {
    if (type === 'text' || type === 'number' || type === 'date' || type === 'link')
      this.newCustomFieldType.set(type);
  }

  removeCustomField(key: string): void {
    this.customFields.update((items) => items.filter((item) => item.key !== key));
    this.customFieldsDirty.set(true);
  }

  private serializeCustomFields(): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    for (const entry of this.customFields()) {
      fields[entry.key] = entry.type === 'number' ? Number(entry.value) || 0 : entry.value;
      fields[`_meta_${entry.key}`] = { label: entry.label, type: entry.type };
    }
    return fields;
  }

  async openProcessDetail(): Promise<void> {
    const process = this.selectedProcess();
    if (!process) return;
    this.processDetailOpen.set(true);
    this.processDetailTab.set('sipoc');
    this.processDetailError.set(null);
    this.processDetailLoading.set(true);
    try {
      const [risks, indicators, documents, slas] = await Promise.all([
        this.riskService.fetchRisksByProcess(process.id),
        this.indicatorService.fetchIndicatorsByProcess(process.id),
        this.documentService.fetchDocumentsByProcess(process.id),
        this.slaService.fetchSlasByProcess(process.id),
      ]);
      if (!this.processDetailOpen() || this.selectedProcess()?.id !== process.id) return;
      this.detailRisks.set(risks);
      this.detailIndicators.set(indicators);
      this.detailDocuments.set(documents);
      this.detailSlas.set(slas);
    } catch (error) {
      this.processDetailError.set(errorMessage(error, 'Erro ao carregar dados do processo'));
    } finally {
      this.processDetailLoading.set(false);
    }
  }

  detailNodes(type: NodeType): SipocNode[] {
    const ids = new Set(this.stepAssociations().map((item) => item.associated_node_id));
    return this.allNodes().filter((node) => node.node_type === type && ids.has(node.id));
  }

  setProcessDetailTab(tab: string | undefined): void {
    if (
      tab === 'sipoc' ||
      tab === 'risks' ||
      tab === 'indicators' ||
      tab === 'documents' ||
      tab === 'slas'
    )
      this.processDetailTab.set(tab);
  }

  editSelectedStep(): void {
    const step = this.selectedStep();
    if (!step) return;
    this.processDetailOpen.set(false);
    this.openNodeEditor(step);
  }

  async saveNode(): Promise<void> {
    if (this.nodeForm.invalid || !this.processControl.value) {
      this.nodeError.set('Título é obrigatório.');
      return;
    }
    if (this.editingNode() && !this.nodeForm.controls.justification.value.trim()) {
      this.nodeError.set('Informe a justificativa da alteração.');
      return;
    }
    this.saving.set(true);
    try {
      const value = this.nodeForm.getRawValue();
      const current = this.editingNode();
      const steps = !current && this.nodeType() !== 'P' ? this.nodesFor('P') : [];
      const saved = current
        ? await this.processService.updateSipocNode(
            current.id,
            {
              title: value.title.trim(),
              description: value.description.trim() || null,
              ...(this.customFieldsDirty() ? { custom_fields: this.serializeCustomFields() } : {}),
            },
            value.justification.trim(),
          )
        : this.nodeType() === 'P'
          ? await this.processService.saveNode(
              value,
              null,
              this.nodeType(),
              this.processControl.value,
            )
          : await this.processService.createNodeWithSteps(
              value,
              this.nodeType(),
              this.processControl.value,
              steps,
            );
      if (steps.length) {
        this.stepAssociations.update((items) => [
          ...items,
          ...steps.map((step) => ({
            id: `local-${step.id}-${saved.id}`,
            step_node_id: step.id,
            associated_node_id: saved.id,
            created_at: new Date().toISOString(),
          })),
        ]);
      }
      this.allNodes.update((items) =>
        current ? items.map((item) => (item.id === saved.id ? saved : item)) : [...items, saved],
      );
      this.toast.success(current ? 'Item atualizado' : `${LABELS[this.nodeType()]} criado`);
      this.nodeOpen.set(false);
    } catch (e) {
      this.nodeError.set(errorMessage(e, 'Erro ao salvar item'));
    } finally {
      this.saving.set(false);
    }
  }

  async removeNode(): Promise<void> {
    const current = this.editingNode();
    if (!current || !(await this.alertDialog.confirm('Excluir este item?'))) return;
    try {
      await this.processService.deleteSipocNode(current.id);
      this.allNodes.update((items) => items.filter((item) => item.id !== current.id));
      this.toast.success('Item excluído');
      this.nodeOpen.set(false);
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao excluir'));
    }
  }

  async openAssociations(type: NodeType): Promise<void> {
    if (!this.selectedStepId()) {
      this.toast.error('Selecione uma etapa primeiro');
      return;
    }
    this.associationType.set(type);
    this.associationOpen.set(true);
    this.associationLoading.set(true);
    try {
      this.associationNodes.set(await this.processService.fetchAllSipocNodesByType(type));
      this.associationIds.set(
        new Set(
          this.stepAssociations()
            .filter((item) => item.step_node_id === this.selectedStepId())
            .map((item) => item.associated_node_id),
        ),
      );
    } finally {
      this.associationLoading.set(false);
    }
  }

  async toggleAssociation(nodeId: string, checked: boolean): Promise<void> {
    const stepId = this.selectedStepId();
    if (!stepId) return;
    try {
      if (checked) {
        await this.processService.createStepAssociation(stepId, nodeId);
        this.stepAssociations.update((items) => [
          ...items,
          {
            id: `local-${stepId}-${nodeId}`,
            step_node_id: stepId,
            associated_node_id: nodeId,
            created_at: new Date().toISOString(),
          },
        ]);
        const node = this.associationNodes().find((item) => item.id === nodeId);
        if (node && !this.allNodes().some((item) => item.id === node.id))
          this.allNodes.update((items) => [...items, node]);
      } else {
        await this.processService.deleteStepAssociation(stepId, nodeId);
        this.stepAssociations.update((items) =>
          items.filter(
            (item) => item.step_node_id !== stepId || item.associated_node_id !== nodeId,
          ),
        );
      }
      this.associationIds.update((ids) => {
        const next = new Set(ids);
        if (checked) next.add(nodeId);
        else next.delete(nodeId);
        return next;
      });
      this.toast.success(checked ? 'Associado à etapa' : 'Desassociado da etapa');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao alterar associação'));
    }
  }
}
