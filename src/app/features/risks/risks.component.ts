import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toSignal } from '@angular/core/rxjs-interop';
import { errorMessage } from '@shared/utils/error.utils';
import { toRiskPayload } from './data-access/risk.mapper';
import { RiskService } from '@features/risks/data-access/risk.service';
import { ProcessService } from '@features/processes/data-access/process.service';
import { TicketService } from '@features/notifications/data-access/ticket.service';
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
  RiskPreventiveActionStatusOption,
  RiskContingencyPlanStatusOption,
  RiskStatus,
  RiskStatusOption,
  RiskType,
  RiskTypeOption,
  SipocNode,
  Ticket,
} from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { SideDrawerComponent } from '@shared/components/side-drawer/side-drawer.component';
import { ToastService } from '@shared/services/toast.service';
import { METHODOLOGIES } from '@shared/data/methodologies';

@Component({
  selector: 'app-risks',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective, MethodologyComponent, SideDrawerComponent],
  templateUrl: './risks.component.html',
  styleUrl: './risks.component.scss',
})
export class RisksComponent {
  private readonly riskService = inject(RiskService);
  private readonly processService = inject(ProcessService);
  private readonly ticketService = inject(TicketService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly management = this.route.snapshot.data['mode'] === 'management';
  readonly statuses = signal<RiskStatusOption[]>([]);
  readonly activeStatuses = computed(() => this.statuses().filter((option) => option.is_active));
  readonly formStatuses = computed(() =>
    this.statuses().filter((option) => option.is_active || option.key === this.editing()?.status),
  );
  readonly types = signal<RiskTypeOption[]>([]);
  readonly preventiveActionStatuses = signal<RiskPreventiveActionStatusOption[]>([]);
  readonly contingencyPlanStatuses = signal<RiskContingencyPlanStatusOption[]>([]);
  readonly activeTypes = computed(() => this.types().filter((option) => option.is_active));
  readonly formTypes = computed(() =>
    this.types().filter((option) => option.is_active || option.key === this.editing()?.risk_type),
  );
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
  readonly riskTickets = signal<Ticket[]>([]);
  readonly detailLoading = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly search = new FormControl('', { nonNullable: true });
  readonly processFilter = new FormControl('all', { nonNullable: true });
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    description: new FormControl('', { nonNullable: true }),
    process_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    step_id: new FormControl('', { nonNullable: true }),
    probability: new FormControl(1, { nonNullable: true }),
    impact: new FormControl(1, { nonNullable: true }),
    risk_type: new FormControl<RiskType>('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    barriers: new FormControl('', { nonNullable: true }),
    status: new FormControl<RiskStatus>('', { nonNullable: true, validators: Validators.required }),
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
    {
      label: 'Tratados',
      value: this.risks().filter(
        (risk) => this.statuses().find((status) => status.key === risk.status)?.is_treated,
      ).length,
    },
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
    this.error.set(null);
    try {
      const [risks, processes, nodes, types, statuses, preventiveStatuses, contingencyStatuses] =
        await Promise.all([
          this.riskService.fetchRisks(),
          this.processService.fetchProcesses(),
          this.processService.fetchSipocNodes(),
          this.riskService.fetchRiskTypes(),
          this.riskService.fetchRiskStatuses(),
          this.riskService.fetchPreventiveActionStatuses(),
          this.riskService.fetchContingencyPlanStatuses(),
        ]);
      this.risks.set(risks);
      this.processes.set(processes);
      this.nodes.set(nodes);
      this.types.set(types);
      this.statuses.set(statuses);
      this.preventiveActionStatuses.set(preventiveStatuses);
      this.contingencyPlanStatuses.set(contingencyStatuses);
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
    if (!this.activeTypes().length || !this.activeStatuses().length) return;
    this.editing.set(null);
    this.form.reset({
      title: '',
      description: '',
      process_id: '',
      step_id: '',
      probability: 1,
      impact: 1,
      risk_type: this.defaultRiskType(),
      barriers: '',
      status: this.defaultRiskStatus(),
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
    this.detailError.set(null);
    this.detailLoading.set(true);
    try {
      const [{ factors, actions, plans }, tickets] = await Promise.all([
        this.riskService.fetchDetails(risk.id),
        this.ticketService.fetchTicketsByProcess(risk.process_id),
      ]);
      if (this.selectedRisk()?.id !== risk.id) return;
      this.factors.set(factors);
      this.actions.set(actions);
      this.plans.set(plans);
      this.riskTickets.set(tickets.filter((ticket) => ticket.risk_id === risk.id));
    } catch (error) {
      this.detailError.set(errorMessage(error, 'Erro ao carregar detalhes do risco'));
    } finally {
      this.detailLoading.set(false);
    }
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

  stepName(id: string | null): string {
    return this.nodes().find((node) => node.id === id)?.title ?? '—';
  }

  detailMeta(
    kind: 'factor' | 'action' | 'plan',
    item: RiskFactor | RiskPreventiveAction | RiskContingencyPlan,
  ): string {
    if (kind === 'factor') return (item as RiskFactor).category || '';
    if (kind === 'action') {
      const action = item as RiskPreventiveAction;
      return [
        action.responsible,
        this.preventiveActionStatuses().find((option) => option.key === action.status)?.label ??
          action.status,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    const plan = item as RiskContingencyPlan;
    return [
      plan.trigger && `Gatilho: ${plan.trigger}`,
      plan.responsible,
      plan.estimated_cost,
      this.contingencyPlanStatuses().find((option) => option.key === plan.status)?.label ??
        plan.status,
    ]
      .filter(Boolean)
      .join(' · ');
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
    return this.statuses().find((option) => option.key === status)?.label ?? status;
  }

  riskTypeLabel(value: RiskType): string {
    return this.types().find((option) => option.key === value)?.label ?? value;
  }

  private defaultRiskStatus(): RiskStatus {
    return (
      this.activeStatuses().find((option) => option.is_default)?.key ??
      this.activeStatuses()[0]?.key ??
      ''
    );
  }

  private defaultRiskType(): RiskType {
    return (
      this.activeTypes().find((option) => option.is_default)?.key ??
      this.activeTypes()[0]?.key ??
      ''
    );
  }
}
