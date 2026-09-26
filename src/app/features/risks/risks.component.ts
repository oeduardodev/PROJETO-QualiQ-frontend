import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toSignal } from '@angular/core/rxjs-interop';
import { errorMessage } from '@shared/utils/error.utils';
import { STATUSES, TYPES } from './risks.constants';
import { toRiskPayload } from './data-access/risk.mapper';
import { RiskService } from '@features/risks/data-access/risk.service';
import { ProcessService } from '@features/processes/data-access/process.service';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import type {
  Process,
  Risk,
  RiskContingencyPlan,
  RiskFactor,
  RiskPreventiveAction,
  RiskStatus,
  RiskType,
  SipocNode,
} from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { ToastService } from '@shared/services/toast.service';
import { METHODOLOGIES } from '@shared/data/methodologies';

@Component({
  selector: 'app-risks',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective, MethodologyComponent, ModalComponent],
  templateUrl: './risks.component.html',
  styleUrl: './risks.component.scss',
})
export class RisksComponent {
  private readonly riskService = inject(RiskService);
  private readonly processService = inject(ProcessService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly management = this.route.snapshot.data['mode'] === 'management';
  readonly statuses = STATUSES;
  readonly types = TYPES;
  readonly scoreAxis = [1, 2, 3, 4, 5];
  readonly probabilityAxis = [5, 4, 3, 2, 1];
  readonly methodology = METHODOLOGIES['riscos'];
  readonly risks = signal<Risk[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly nodes = signal<SipocNode[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly searchValue = signal('');
  readonly processValue = signal('all');
  readonly methodologyOpen = signal(false);
  readonly formOpen = signal(false);
  readonly editing = signal<Risk | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly detailOpen = signal(false);
  readonly selectedRisk = signal<Risk | null>(null);
  readonly factors = signal<RiskFactor[]>([]);
  readonly actions = signal<RiskPreventiveAction[]>([]);
  readonly plans = signal<RiskContingencyPlan[]>([]);
  readonly search = new FormControl('', { nonNullable: true });
  readonly processFilter = new FormControl('all', { nonNullable: true });
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    description: new FormControl('', { nonNullable: true }),
    process_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    step_id: new FormControl('', { nonNullable: true }),
    probability: new FormControl(1, { nonNullable: true }),
    impact: new FormControl(1, { nonNullable: true }),
    risk_type: new FormControl<RiskType>('Operacional', { nonNullable: true }),
    barriers: new FormControl('', { nonNullable: true }),
    status: new FormControl<RiskStatus>('identificado', { nonNullable: true }),
    owner: new FormControl('', { nonNullable: true }),
  });
  readonly canManage = computed(() => this.auth.isAdmin() || this.auth.isGestor());
  readonly filtered = computed(() =>
    this.risks().filter(
      (risk) =>
        (this.processValue() === 'all' || risk.process_id === this.processValue()) &&
        (!this.searchValue() ||
          risk.title.toLowerCase().includes(this.searchValue().toLowerCase())),
    ),
  );
  readonly summary = computed(() => [
    { label: 'Total', value: this.risks().length },
    { label: 'Críticos', value: this.risks().filter((risk) => risk.risk_score >= 20).length },
    {
      label: 'Altos',
      value: this.risks().filter((risk) => risk.risk_score >= 10 && risk.risk_score < 20).length,
    },
    { label: 'Tratados', value: this.risks().filter((risk) => risk.status === 'tratado').length },
  ]);
  readonly selectedProcessId = toSignal(this.form.controls.process_id.valueChanges, {
    initialValue: this.form.controls.process_id.value,
  });
  readonly stepsForForm = computed(() =>
    this.nodes().filter(
      (node) => node.node_type === 'P' && node.process_id === this.selectedProcessId(),
    ),
  );
  readonly detailSections = computed(() => [
    { key: 'factor' as const, label: 'Fatores de risco', items: this.factors() },
    { key: 'action' as const, label: 'Ações preventivas', items: this.actions() },
    { key: 'plan' as const, label: 'Planos de contingência', items: this.plans() },
  ]);

  constructor() {
    this.search.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.searchValue.set(value));
    this.processFilter.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.processValue.set(value));
    void this.loadRisks();
  }

  async loadRisks(): Promise<void> {
    this.loading.set(true);
    try {
      const [risks, processes, nodes] = await Promise.all([
        this.riskService.fetchRisks(),
        this.processService.fetchProcesses(),
        this.processService.fetchSipocNodes(),
      ]);
      this.risks.set(risks);
      this.processes.set(processes);
      this.nodes.set(nodes);
    } catch (e) {
      this.error.set(errorMessage(e, 'Erro ao carregar riscos'));
    } finally {
      this.loading.set(false);
    }
  }

  risksInCell(probability: number, impact: number): Risk[] {
    return this.filtered().filter(
      (risk) => risk.probability === probability && risk.impact === impact,
    );
  }

  clearSelectedStep(): void {
    this.form.controls.step_id.setValue('');
  }

  selectCell(probability: number, impact: number): void {
    if (this.canManage()) {
      this.openCreateRisk();
      this.form.patchValue({ probability, impact });
    }
  }

  openCreateRisk(): void {
    this.editing.set(null);
    this.form.reset({
      title: '',
      description: '',
      process_id: '',
      step_id: '',
      probability: 1,
      impact: 1,
      risk_type: 'Operacional',
      barriers: '',
      status: 'identificado',
      owner: '',
    });
    this.formError.set(null);
    this.formOpen.set(true);
  }

  openEditRisk(risk: Risk): void {
    this.editing.set(risk);
    this.form.reset({
      title: risk.title,
      description: risk.description ?? '',
      process_id: risk.process_id,
      step_id: risk.step_id ?? '',
      probability: risk.probability,
      impact: risk.impact,
      risk_type: risk.risk_type,
      barriers: risk.barriers ?? '',
      status: risk.status,
      owner: risk.owner ?? '',
    });
    this.formOpen.set(true);
  }

  async saveRisk(): Promise<void> {
    if (this.form.invalid) {
      this.formError.set('Título e processo são obrigatórios.');
      return;
    }
    this.saving.set(true);
    try {
      const value = this.form.getRawValue();
      const payload = toRiskPayload(value);
      const current = this.editing();
      const saved = current
        ? await this.riskService.updateRisk(current.id, payload)
        : await this.riskService.createRisk(payload);
      this.risks.update((items) =>
        current ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
      );
      this.toast.success(current ? 'Risco atualizado' : 'Risco criado');
      this.formOpen.set(false);
    } catch (e) {
      this.formError.set(errorMessage(e, 'Erro ao salvar risco'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteRisk(risk: Risk): Promise<void> {
    if (!confirm('Excluir este risco e seus registros relacionados?')) return;
    try {
      await this.riskService.deleteRisk(risk.id);
      this.risks.update((items) => items.filter((item) => item.id !== risk.id));
      this.toast.success('Risco excluído');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao excluir'));
    }
  }

  async openDetail(risk: Risk): Promise<void> {
    this.selectedRisk.set(risk);
    this.detailOpen.set(true);
    const { factors, actions, plans } = await this.riskService.fetchDetails(risk.id);
    this.factors.set(factors);
    this.actions.set(actions);
    this.plans.set(plans);
  }

  async addDetail(kind: 'factor' | 'action' | 'plan'): Promise<void> {
    const risk = this.selectedRisk();
    if (!risk) return;
    const description = prompt(
      kind === 'factor'
        ? 'Descreva o fator de risco:'
        : kind === 'action'
          ? 'Descreva a ação preventiva:'
          : 'Descreva o plano de contingência:',
    );
    if (!description?.trim()) return;
    try {
      if (kind === 'factor') {
        const saved = await this.riskService.addFactor(risk.id, description);
        this.factors.update((items) => [...items, saved]);
      } else if (kind === 'action') {
        const saved = await this.riskService.addPreventiveAction(risk.id, description);
        this.actions.update((items) => [...items, saved]);
      } else {
        const saved = await this.riskService.addContingencyPlan(risk.id, description);
        this.plans.update((items) => [...items, saved]);
      }
      this.toast.success('Registro adicionado');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao adicionar'));
    }
  }

  async removeDetail(kind: 'factor' | 'action' | 'plan', id: string): Promise<void> {
    if (!confirm('Excluir este registro?')) return;
    if (kind === 'factor') {
      await this.riskService.deleteRiskFactor(id);
      this.factors.update((items) => items.filter((item) => item.id !== id));
    } else if (kind === 'action') {
      await this.riskService.deletePreventiveAction(id);
      this.actions.update((items) => items.filter((item) => item.id !== id));
    } else {
      await this.riskService.deleteContingencyPlan(id);
      this.plans.update((items) => items.filter((item) => item.id !== id));
    }
  }

  processName(id: string): string {
    return this.processes().find((process) => process.id === id)?.title ?? '—';
  }

  levelLabel(score: number): string {
    return score >= 20 ? 'Crítico' : score >= 10 ? 'Alto' : score >= 5 ? 'Moderado' : 'Baixo';
  }

  levelClass(score: number): string {
    return score >= 20
      ? 'bg-rose-100 text-rose-700'
      : score >= 10
        ? 'bg-orange-100 text-orange-700'
        : score >= 5
          ? 'bg-amber-100 text-amber-700'
          : 'bg-emerald-100 text-emerald-700';
  }

  matrixClass(score: number): string {
    return this.levelClass(score).replace('text-', 'border-');
  }

  statusLabel(status: RiskStatus): string {
    return {
      identificado: 'Identificado',
      em_analise: 'Em análise',
      tratado: 'Tratado',
      monitorado: 'Monitorado',
    }[status];
  }
}
