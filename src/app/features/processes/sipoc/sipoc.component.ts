import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { errorMessage } from '@shared/utils/error.utils';
import { COLUMNS, LABELS } from './sipoc.constants';
import { ProcessService } from '@features/processes/data-access/process.service';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import type {
  NodeType,
  Process,
  SipocNode,
  SipocStepAssociation,
  ValueChainCategory,
} from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { ToastService } from '@shared/services/toast.service';
import { METHODOLOGIES } from '@shared/data/methodologies';

@Component({
  selector: 'app-sipoc',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective, MethodologyComponent, ModalComponent],
  templateUrl: './sipoc.component.html',
  styleUrl: './sipoc.component.scss',
})
export class SipocComponent {
  private readonly processService = inject(ProcessService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly columns = COLUMNS;
  readonly LABELS = LABELS;
  readonly methodology = METHODOLOGIES['sipoc'];
  readonly processes = signal<Process[]>([]);
  readonly categories = signal<ValueChainCategory[]>([]);
  readonly allNodes = signal<SipocNode[]>([]);
  readonly stepAssociations = signal<SipocStepAssociation[]>([]);
  readonly selectedStepId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly nodesLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly methodologyOpen = signal(false);
  readonly nodeOpen = signal(false);
  readonly editingNode = signal<SipocNode | null>(null);
  readonly nodeType = signal<NodeType>('S');
  readonly nodeError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly processOpen = signal(false);
  readonly processError = signal<string | null>(null);
  readonly associationOpen = signal(false);
  readonly associationType = signal<NodeType>('S');
  readonly associationNodes = signal<SipocNode[]>([]);
  readonly associationIds = signal(new Set<string>());
  readonly associationLoading = signal(false);
  readonly processControl = new FormControl('', { nonNullable: true });
  readonly nodeForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    description: new FormControl('', { nonNullable: true }),
  });
  readonly processForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    code: new FormControl('', { nonNullable: true }),
    category_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    owner: new FormControl('', { nonNullable: true }),
  });
  readonly selectedStep = computed(
    () => this.allNodes().find((node) => node.id === this.selectedStepId()) ?? null,
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
    this.nodeForm.reset({ title: '', description: '' });
    this.nodeError.set(null);
    this.nodeOpen.set(true);
  }

  openNode(node: SipocNode): void {
    if (node.node_type === 'P')
      this.selectedStepId.update((id) => (id === node.id ? null : node.id));
    this.editingNode.set(node);
    this.nodeType.set(node.node_type);
    this.nodeForm.reset({ title: node.title, description: node.description ?? '' });
    this.nodeError.set(null);
    this.nodeOpen.set(true);
  }

  async saveNode(): Promise<void> {
    if (this.nodeForm.invalid || !this.processControl.value) {
      this.nodeError.set('Título é obrigatório.');
      return;
    }
    this.saving.set(true);
    try {
      const value = this.nodeForm.getRawValue();
      const current = this.editingNode();
      const saved = await this.processService.saveNode(
        value,
        current,
        this.nodeType(),
        this.processControl.value,
      );
      if (!current && this.nodeType() !== 'P') {
        const steps = this.nodesFor('P');
        const associations = await this.processService.associateNodeWithSteps(saved.id, steps);
        this.stepAssociations.update((items) => [...items, ...associations]);
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
    if (!current || !confirm('Excluir este item?')) return;
    try {
      await this.processService.deleteSipocNode(current.id);
      this.allNodes.update((items) => items.filter((item) => item.id !== current.id));
      this.toast.success('Item excluído');
      this.nodeOpen.set(false);
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao excluir'));
    }
  }

  async saveProcess(): Promise<void> {
    if (this.processForm.invalid) {
      this.processError.set('Título e categoria são obrigatórios.');
      return;
    }
    try {
      const value = this.processForm.getRawValue();
      const saved = await this.processService.createProcess({
        ...value,
        code: value.code.trim() || null,
        owner: value.owner.trim() || null,
        impact_score: 5,
        complexity_score: 5,
        maturity_level: 1,
      });
      this.processes.update((items) => [...items, saved]);
      this.processControl.setValue(saved.id);
      this.toast.success('Processo criado');
      this.processOpen.set(false);
      this.processForm.reset({ title: '', code: '', category_id: '', owner: '' });
    } catch (e) {
      this.processError.set(errorMessage(e, 'Erro ao criar processo'));
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
