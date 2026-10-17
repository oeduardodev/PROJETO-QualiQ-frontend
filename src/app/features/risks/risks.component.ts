import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toSignal } from '@angular/core/rxjs-interop';
import { errorMessage } from '@shared/utils/error.utils';
import { toRiskPayload } from './data-access/risk.mapper';
import { RiskService } from '@features/risks/data-access/risk.service';
import { ProcessService } from '@features/processes/data-access/process.service';
import { ProfileRepository } from '@core/data-access/profile.repository';
import { IncidentTicketService } from '@features/incidents/data-access/incident-ticket.service';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import type {
  Process,
  Profile,
  Risk,
  RiskApprovalState,
  RiskHistory,
  RiskMatrixClassification,
  RiskMatrixClassificationInput,
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
import { AlertDialogService } from '@shared/services/alert-dialog.service';
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
  private readonly profilesRepository = inject(ProfileRepository);
  private readonly ticketService = inject(IncidentTicketService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly alertDialog = inject(AlertDialogService);
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
  readonly history = signal<RiskHistory[]>([]);
  readonly historyRiskId = signal<string | null>(null);
  readonly historyLoading = signal(false);
  readonly historyError = signal<string | null>(null);
  private historyRequestId = 0;
  readonly activationSaving = signal<string | null>(null);
  readonly matrixClassifications = signal<RiskMatrixClassification[]>([]);
  readonly matrixConfigOpen = signal(false);
  readonly matrixDraft = signal<RiskMatrixClassificationInput[]>([]);
  readonly matrixSaving = signal(false);
  readonly matrixError = signal<string | null>(null);
  readonly rejectOpen = signal(false);
  readonly rejectingRisk = signal<Risk | null>(null);
  readonly rejectionReason = new FormControl('', { nonNullable: true });
  readonly approvalSaving = signal<string | null>(null);
  readonly processes = signal<Process[]>([]);
  readonly users = signal<Profile[]>([]);
  readonly nodes = signal<SipocNode[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly searchValue = signal('');
  readonly processValue = signal('all');
  readonly activityValue = signal('active');
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
  readonly detailEntryOpen = signal(false);
  readonly detailEntryKind = signal<'factor' | 'action' | 'plan'>('factor');
  readonly detailEntryDescription = new FormControl('', {
    nonNullable: true,
    validators: Validators.required,
  });
  readonly detailEntrySaving = signal(false);
  readonly detailEntryError = signal<string | null>(null);
  readonly search = new FormControl('', { nonNullable: true });
  readonly processFilter = new FormControl('all', { nonNullable: true });
  readonly activityFilter = new FormControl('active', { nonNullable: true });
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
    owner_id: new FormControl('', { nonNullable: true }),
    justification: new FormControl('', { nonNullable: true }),
  });
  readonly canManage = computed(() => this.auth.isAdmin() || this.auth.isGestor());
  readonly canApprove = this.auth.isAdmin;
  readonly visibleRisks = computed(() =>
    this.management
      ? this.risks()
      : this.risks().filter((risk) => risk.approval_state === 'approved' && risk.is_active),
  );
  readonly filtered = computed(() =>
    this.visibleRisks().filter(
      (risk) =>
        (this.processValue() === 'all' || risk.process_id === this.processValue()) &&
        (!this.management ||
          this.activityValue() === 'all' ||
          (this.activityValue() === 'active') === risk.is_active) &&
        (!this.searchValue() ||
          `${risk.code ?? ''} ${risk.title}`
            .toLowerCase()
            .includes(this.searchValue().toLowerCase())),
    ),
  );
  readonly summary = computed(() => [
    { label: 'Total', value: this.visibleRisks().length },
    ...this.matrixClassifications().map((classification) => ({
      label: classification.label,
      value: this.visibleRisks().filter(
        (risk) =>
          risk.risk_score >= classification.min_score &&
          risk.risk_score <= classification.max_score,
      ).length,
    })),
    {
      label: 'Tratados',
      value: this.visibleRisks().filter(
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
    this.activityFilter.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.activityValue.set(value));
    void this.loadRisks();
  }

  async loadRisks(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [
        risks,
        processes,
        nodes,
        types,
        statuses,
        preventiveStatuses,
        contingencyStatuses,
        classifications,
        users,
      ] = await Promise.all([
        this.riskService.fetchRisks(this.management),
        this.processService.fetchProcesses(),
        this.processService.fetchSipocNodes(),
        this.riskService.fetchRiskTypes(),
        this.riskService.fetchRiskStatuses(),
        this.riskService.fetchPreventiveActionStatuses(),
        this.riskService.fetchContingencyPlanStatuses(),
        this.riskService.fetchMatrixClassifications(),
        this.management ? this.profilesRepository.findAssignableUsers() : Promise.resolve([]),
      ]);
      this.risks.set(risks);
      this.processes.set(processes);
      this.nodes.set(nodes);
      this.types.set(types);
      this.statuses.set(statuses);
      this.preventiveActionStatuses.set(preventiveStatuses);
      this.contingencyPlanStatuses.set(contingencyStatuses);
      this.matrixClassifications.set(classifications);
      this.users.set(users);
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

  openCreateRisk(): void {
    if (!this.management || !this.canManage()) return;
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
      owner_id: '',
      justification: '',
    });
    this.formError.set(null);
    this.formOpen.set(true);
  }

  openEditRisk(risk: Risk): void {
    if (!this.management || !this.canManage() || risk.approval_state === 'pending') return;
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
      owner_id: risk.owner_id ?? (risk.owner ? 'legacy' : ''),
      justification: '',
    });
    this.formError.set(null);
    this.formOpen.set(true);
  }

  async saveRisk(): Promise<void> {
    if (!this.management || !this.canManage()) return;
    if (this.form.invalid) {
      this.formError.set('Título e processo são obrigatórios.');
      return;
    }
    const current = this.editing();
    const value = this.form.getRawValue();
    const justification = value.justification.trim();
    if (current && !justification) {
      this.formError.set('Informe a justificativa da alteração.');
      return;
    }
    const selectedUser = this.users().find((user) => user.id === value.owner_id);
    if (value.owner_id && value.owner_id !== 'legacy' && !selectedUser) {
      this.formError.set('Selecione um usuário válido para responsável.');
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    try {
      const payload = toRiskPayload(value);
      payload.owner =
        selectedUser?.name ?? (value.owner_id === 'legacy' ? (current?.owner ?? null) : null);
      const saved = current
        ? await this.riskService.updateRisk(current.id, payload, justification)
        : await this.riskService.createRisk(payload);
      this.risks.update((items) =>
        current ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
      );
      if (this.selectedRisk()?.id === saved.id) this.selectedRisk.set(saved);
      if (this.historyRiskId() === saved.id) void this.loadHistory(saved.id);
      this.toast.success(current ? 'Risco atualizado' : 'Risco criado');
      this.formOpen.set(false);
    } catch (e) {
      this.formError.set(errorMessage(e, 'Erro ao salvar risco'));
    } finally {
      this.saving.set(false);
    }
  }

  async setActive(risk: Risk, isActive: boolean): Promise<void> {
    if (!this.management || !this.canManage() || this.activationSaving()) return;
    this.activationSaving.set(risk.id);
    try {
      const saved = await this.riskService.updateRisk(risk.id, { is_active: isActive });
      this.risks.update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      if (this.selectedRisk()?.id === saved.id) this.selectedRisk.set(saved);
      if (this.historyRiskId() === saved.id) void this.loadHistory(saved.id);
      this.toast.success(isActive ? 'Risco reativado' : 'Risco desativado');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao alterar a situação do risco'));
    } finally {
      this.activationSaving.set(null);
    }
  }

  toggleHistory(risk: Risk): void {
    if (this.historyRiskId() === risk.id) {
      this.historyRiskId.set(null);
      this.historyRequestId++;
      return;
    }
    this.historyRiskId.set(risk.id);
    void this.loadHistory(risk.id);
  }

  private async loadHistory(riskId: string): Promise<void> {
    this.history.set([]);
    this.historyError.set(null);
    this.historyLoading.set(true);
    const requestId = ++this.historyRequestId;
    try {
      const entries = await this.riskService.fetchRiskHistory(riskId);
      if (requestId === this.historyRequestId) this.history.set(entries);
    } catch (error) {
      if (requestId === this.historyRequestId)
        this.historyError.set(errorMessage(error, 'Erro ao carregar histórico'));
    } finally {
      if (requestId === this.historyRequestId) this.historyLoading.set(false);
    }
  }

  async openDetail(risk: Risk): Promise<void> {
    this.selectedRisk.set(risk);
    this.detailOpen.set(true);
    this.detailError.set(null);
    this.detailLoading.set(true);
    this.factors.set([]);
    this.actions.set([]);
    this.plans.set([]);
    this.riskTickets.set([]);
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

  openDetailEntry(kind: 'factor' | 'action' | 'plan'): void {
    if (!this.management || !this.canManage()) return;
    if (!this.selectedRisk()) return;
    this.detailEntryKind.set(kind);
    this.detailEntryDescription.reset('');
    this.detailEntryError.set(null);
    this.detailOpen.set(false);
    this.detailEntryOpen.set(true);
  }

  closeDetailEntry(): void {
    this.detailEntryOpen.set(false);
    if (this.selectedRisk()) this.detailOpen.set(true);
  }

  async addDetail(): Promise<void> {
    if (!this.management || !this.canManage()) return;
    const risk = this.selectedRisk();
    if (!risk) return;
    const description = this.detailEntryDescription.value.trim();
    if (!description) {
      this.detailEntryError.set('Informe uma descrição.');
      return;
    }
    if (this.detailEntrySaving()) return;
    const kind = this.detailEntryKind();
    this.detailEntrySaving.set(true);
    this.detailEntryError.set(null);
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
      if (this.historyRiskId() === risk.id) void this.loadHistory(risk.id);
      this.closeDetailEntry();
    } catch (e) {
      this.detailEntryError.set(errorMessage(e, 'Erro ao adicionar'));
    } finally {
      this.detailEntrySaving.set(false);
    }
  }

  async removeDetail(kind: 'factor' | 'action' | 'plan', id: string): Promise<void> {
    if (!this.management || !this.canManage()) return;
    if (!(await this.alertDialog.confirm('Excluir este registro?'))) return;
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
    const riskId = this.selectedRisk()?.id;
    if (riskId && this.historyRiskId() === riskId) void this.loadHistory(riskId);
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

  classificationFor(score: number): RiskMatrixClassification | undefined {
    return this.matrixClassifications().find(
      (item) => score >= item.min_score && score <= item.max_score,
    );
  }

  levelLabel(score: number): string {
    return this.classificationFor(score)?.label ?? 'Sem classificação';
  }

  approvalLabel(state: RiskApprovalState): string {
    return {
      draft: 'Rascunho',
      pending: 'Aguardando aprovação',
      approved: 'Aprovado',
      rejected: 'Rejeitado',
    }[state];
  }

  historyActionLabel(entry: RiskHistory): string {
    if (entry.action === 'baseline') return 'Estado inicial';
    if (entry.entity !== 'risk') {
      const subject = { factor: 'Fator', action: 'Ação preventiva', plan: 'Plano de contingência' }[
        entry.entity
      ];
      return `${subject} ${entry.action === 'added' ? 'adicionado' : entry.action === 'removed' ? 'removido' : 'alterado'}`;
    }
    return {
      created: 'Criação',
      updated: 'Alteração',
      deactivated: 'Desativação',
      reactivated: 'Reativação',
      submitted: 'Enviado para aprovação',
      approved: 'Aprovação',
      rejected: 'Rejeição',
      added: 'Adição',
      removed: 'Remoção',
    }[entry.action];
  }

  historyDescription(entry: RiskHistory): string {
    if (entry.entity === 'risk') return '';
    return String(entry.after_data?.['description'] ?? entry.before_data?.['description'] ?? '');
  }

  historyChanges(entry: RiskHistory): { label: string; before: string; after: string }[] {
    if (!entry.before_data || !entry.after_data) return [];
    const labels: Record<string, string> = {
      title: 'Título',
      description: 'Descrição',
      process_id: 'Processo',
      step_id: 'Etapa SIPOC',
      probability: 'Probabilidade',
      impact: 'Impacto',
      risk_level: 'Classificação',
      risk_type: 'Tipo',
      barriers: 'Barreiras',
      status: 'Status',
      owner: 'Responsável',
      owner_id: 'Responsável',
      responsible: 'Responsável',
      category: 'Categoria',
      trigger: 'Gatilho',
      estimated_cost: 'Custo estimado',
      approval_state: 'Aprovação',
      rejection_reason: 'Motivo da rejeição',
      is_active: 'Situação',
    };
    return Object.entries(labels)
      .filter(
        ([key]) =>
          !(
            key === 'owner' && entry.before_data?.['owner_id'] !== entry.after_data?.['owner_id']
          ) && JSON.stringify(entry.before_data?.[key]) !== JSON.stringify(entry.after_data?.[key]),
      )
      .map(([key, label]) => ({
        label,
        before:
          key === 'owner_id'
            ? String(entry.before_data?.['owner'] ?? '—')
            : this.historyValue(key, entry.before_data?.[key], entry.entity),
        after:
          key === 'owner_id'
            ? String(entry.after_data?.['owner'] ?? '—')
            : this.historyValue(key, entry.after_data?.[key], entry.entity),
      }));
  }

  private historyValue(key: string, value: unknown, entity: RiskHistory['entity']): string {
    if (value === null || value === undefined || value === '') return '—';
    if (key === 'process_id') return this.processName(String(value));
    if (key === 'step_id') return this.stepName(String(value));
    if (key === 'risk_type') return this.riskTypeLabel(String(value));
    if (key === 'status' && entity === 'action')
      return (
        this.preventiveActionStatuses().find((option) => option.key === value)?.label ??
        String(value)
      );
    if (key === 'status' && entity === 'plan')
      return (
        this.contingencyPlanStatuses().find((option) => option.key === value)?.label ??
        String(value)
      );
    if (key === 'status') return this.statusLabel(String(value));
    if (key === 'approval_state') return this.approvalLabel(value as RiskApprovalState);
    if (key === 'is_active') return value ? 'Ativado' : 'Desativado';
    return String(value);
  }

  formatHistoryDate(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  async changeApproval(
    risk: Risk,
    state: 'pending' | 'approved' | 'rejected',
    reason?: string,
  ): Promise<void> {
    if (!this.management || !this.canManage()) return;
    if (state !== 'pending' && !this.canApprove()) return;
    if (this.approvalSaving()) return;
    this.approvalSaving.set(risk.id);
    try {
      const saved = await this.riskService.changeApprovalState(risk.id, state, reason);
      this.risks.update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      if (this.selectedRisk()?.id === saved.id) this.selectedRisk.set(saved);
      if (this.historyRiskId() === saved.id) void this.loadHistory(saved.id);
      this.rejectOpen.set(false);
      this.toast.success(
        state === 'pending'
          ? 'Risco enviado para aprovação'
          : state === 'approved'
            ? 'Risco aprovado'
            : 'Risco rejeitado',
      );
    } catch (error) {
      this.toast.error(errorMessage(error, 'Erro ao atualizar aprovação'));
    } finally {
      this.approvalSaving.set(null);
    }
  }

  openReject(risk: Risk): void {
    if (!this.management || !this.canApprove()) return;
    this.rejectingRisk.set(risk);
    this.rejectionReason.reset('');
    this.rejectOpen.set(true);
  }

  submitRejection(): void {
    const risk = this.rejectingRisk();
    const reason = this.rejectionReason.value.trim();
    if (!risk || !reason) return;
    void this.changeApproval(risk, 'rejected', reason);
  }

  openMatrixConfig(): void {
    if (!this.management || !this.canApprove()) return;
    this.matrixDraft.set(
      this.matrixClassifications().map((item) => ({
        max_score: item.max_score,
        label: item.label,
        background_color: item.background_color,
        text_color: item.text_color,
      })),
    );
    this.matrixError.set(null);
    this.matrixConfigOpen.set(true);
  }

  updateMatrixDraft(
    index: number,
    field: keyof RiskMatrixClassificationInput,
    value: string,
  ): void {
    this.matrixDraft.update((items) =>
      items.map((item, position) =>
        position === index
          ? { ...item, [field]: field === 'max_score' ? Number(value) : value }
          : item,
      ),
    );
  }

  addMatrixClassification(): void {
    this.matrixDraft.update((items) => {
      const last = items.at(-1);
      const previousMax = items.at(-2)?.max_score ?? 0;
      if (!last || last.max_score - previousMax < 2) return items;
      return [
        ...items.slice(0, -1),
        { ...last, max_score: last.max_score - 1 },
        {
          label: 'Nova classificação',
          max_score: 25,
          background_color: '#e2e8f0',
          text_color: '#334155',
        },
      ];
    });
  }

  removeMatrixClassification(index: number): void {
    this.matrixDraft.update((items) => {
      if (items.length <= 1) return items;
      const next = items.filter((_, position) => position !== index);
      if (index > 0) next[index - 1] = { ...next[index - 1], max_score: items[index].max_score };
      return next;
    });
  }

  async saveMatrixConfig(): Promise<void> {
    const items = this.matrixDraft();
    let previousMax = 0;
    if (
      !items.length ||
      items.at(-1)?.max_score !== 25 ||
      items.some((item) => {
        const valid =
          Number.isInteger(item.max_score) &&
          item.max_score > previousMax &&
          item.max_score <= 25 &&
          !!item.label.trim();
        previousMax = item.max_score;
        return !valid;
      })
    ) {
      this.matrixError.set(
        'Informe nomes e limites crescentes que cubram as pontuações de 1 a 25.',
      );
      return;
    }
    this.matrixSaving.set(true);
    this.matrixError.set(null);
    try {
      const saved = await this.riskService.saveMatrixClassifications(items);
      this.matrixClassifications.set(saved);
      this.matrixConfigOpen.set(false);
      this.toast.success('Classificações da matriz salvas');
    } catch (error) {
      this.matrixError.set(errorMessage(error, 'Erro ao salvar classificações'));
    } finally {
      this.matrixSaving.set(false);
    }
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
