import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { errorMessage } from '@shared/utils/error.utils';
import { toSlaPayload } from '../data-access/sla.mapper';
import { processTag } from '../data-access/process-code.utils';
import { SlaService } from '@features/processes/data-access/sla.service';
import { ProcessService } from '@features/processes/data-access/process.service';
import { IncidentTicketService } from '@features/incidents/data-access/incident-ticket.service';
import { IncidentService } from '@features/incidents/data-access/incident.service';
import { RiskService } from '@features/risks/data-access/risk.service';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { ProfileRepository } from '@core/data-access/profile.repository';
import type {
  Profile,
  Process,
  Risk,
  IncidentType,
  SLA,
  SlaApproval,
  SlaHistory,
  SipocNodeAssociation,
  SipocNode,
  SlaCriticality,
  SlaStatus,
  SlaStatusOption,
  Ticket,
} from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { SideDrawerComponent } from '@shared/components/side-drawer/side-drawer.component';
import { ToastService } from '@shared/services/toast.service';

@Component({
  selector: 'app-slas',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective, SideDrawerComponent],
  templateUrl: './slas.component.html',
  styleUrl: './slas.component.scss',
})
export class SlasComponent {
  private readonly slaService = inject(SlaService);
  private readonly processService = inject(ProcessService);
  private readonly ticketService = inject(IncidentTicketService);
  private readonly incidentService = inject(IncidentService);
  private readonly riskService = inject(RiskService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly profilesRepository = inject(ProfileRepository);
  private readonly toast = inject(ToastService);
  readonly management = this.route.snapshot.data['mode'] === 'management';
  readonly statuses = signal<SlaStatusOption[]>([]);
  readonly slas = signal<SLA[]>([]);
  readonly approvals = signal<SlaApproval[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly nodes = signal<SipocNode[]>([]);
  readonly associations = signal<SipocNodeAssociation[]>([]);
  readonly tickets = signal<Ticket[]>([]);
  readonly incidentTypes = signal<IncidentType[]>([]);
  readonly risks = signal<Risk[]>([]);
  readonly users = signal<Profile[]>([]);
  readonly history = signal<SlaHistory[]>([]);
  readonly historySlaId = signal<string | null>(null);
  readonly historyLoading = signal(false);
  readonly historyError = signal<string | null>(null);
  private historyRequestId = 0;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<SLA | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly detailOpen = signal(false);
  readonly selectedSla = computed(
    () => this.slas().find((sla) => sla.id === this.selectedId()) ?? null,
  );
  readonly searchValue = signal('');
  readonly statusValue = signal('all');
  readonly processValue = signal('all');
  readonly criticalityValue = signal('all');
  readonly clientProcessValue = signal('');
  readonly periodStartValue = signal('');
  readonly periodEndValue = signal('');
  readonly search = new FormControl('', { nonNullable: true });
  readonly statusFilter = new FormControl('all', { nonNullable: true });
  readonly processFilter = new FormControl('all', { nonNullable: true });
  readonly criticalityFilter = new FormControl('all', { nonNullable: true });
  readonly periodStart = new FormControl('', { nonNullable: true });
  readonly periodEnd = new FormControl('', { nonNullable: true });
  readonly criticalityOptions: { value: SlaCriticality; label: string }[] = [
    { value: 'baixa', label: 'Baixa' },
    { value: 'media', label: 'Média' },
    { value: 'alta', label: 'Alta' },
    { value: 'critica', label: 'Crítica' },
  ];
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    supplier_process_id: new FormControl('', { nonNullable: true }),
    client_process_id: new FormControl('', { nonNullable: true }),
    sipoc_input_id: new FormControl('', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true, validators: Validators.required }),
    business_rules: new FormControl('', { nonNullable: true, validators: Validators.required }),
    criticality: new FormControl<SlaCriticality | ''>('', { nonNullable: true }),
    notification_type_ids: new FormControl<string[]>([], { nonNullable: true }),
    justification: new FormControl('', { nonNullable: true }),
  });
  readonly canManage = computed(() => this.auth.canEditPage('processos/slas/gerenciamento'));
  readonly inputs = computed(() =>
    this.nodes().filter(
      (node) =>
        node.node_type === 'I' &&
        !!this.clientProcessValue() &&
        (node.process_id === this.clientProcessValue() ||
          this.associations().some(
            (association) =>
              association.node_id === node.id &&
              association.process_id === this.clientProcessValue(),
          )),
    ),
  );
  readonly availableIncidentTypes = computed(() =>
    this.incidentTypes().filter(
      (type) =>
        (type.active || type.sla_id === this.editing()?.id) &&
        (type.sla_id === null || type.sla_id === this.editing()?.id),
    ),
  );
  readonly linkedProcesses = computed(() => {
    const ids = new Set(
      this.slas().flatMap((sla) => [sla.supplier_process_id, sla.client_process_id]),
    );
    return this.processes().filter((process) => ids.has(process.id));
  });
  readonly filtered = computed(() =>
    this.slas().filter(
      (sla) =>
        (this.statusValue() === 'all' || sla.status === this.statusValue()) &&
        (this.processValue() === 'all' ||
          sla.supplier_process_id === this.processValue() ||
          sla.client_process_id === this.processValue()) &&
        (this.criticalityValue() === 'all' ||
          (this.criticalityValue() === 'none'
            ? !sla.criticality
            : sla.criticality === this.criticalityValue())) &&
        (!this.searchValue() ||
          `${sla.code ?? ''} ${sla.title} ${this.processLabel(sla.supplier_process_id)} ${this.processLabel(sla.client_process_id)}`
            .toLocaleLowerCase('pt-BR')
            .includes(this.searchValue().trim().toLocaleLowerCase('pt-BR'))),
    ),
  );
  readonly ticketsInPeriod = computed(() =>
    this.tickets().filter((ticket) => {
      const date = ticket.created_at?.slice(0, 10) ?? '';
      return (
        (!this.periodStartValue() || date >= this.periodStartValue()) &&
        (!this.periodEndValue() || date <= this.periodEndValue())
      );
    }),
  );
  readonly filteredTickets = computed(() => {
    const ids = new Set(this.filtered().map((sla) => sla.id));
    return this.ticketsInPeriod().filter((ticket) => ticket.sla_id && ids.has(ticket.sla_id));
  });
  readonly slasWithIncidents = computed(
    () => new Set(this.filteredTickets().map((ticket) => ticket.sla_id)).size,
  );
  readonly chartRows = computed(() =>
    this.filtered()
      .map((sla) => ({
        sla,
        count: this.filteredTickets().filter((ticket) => ticket.sla_id === sla.id).length,
      }))
      .sort((a, b) => b.count - a.count || a.sla.title.localeCompare(b.sla.title))
      .slice(0, 3),
  );
  readonly chartMax = computed(() => Math.max(1, ...this.chartRows().map((row) => row.count)));
  readonly selectedTickets = computed(() =>
    this.tickets().filter((ticket) => ticket.sla_id === this.selectedId()),
  );
  readonly selectedRisks = computed(() => {
    const ids = new Set([
      ...this.selectedTickets().map((ticket) => ticket.risk_id),
      ...this.incidentTypes()
        .filter((type) => type.sla_id === this.selectedId())
        .map((type) => type.risk_id),
    ]);
    return this.risks().filter((risk) => ids.has(risk.id));
  });
  readonly summary = computed(() => [
    { label: 'SLAs encontrados', value: this.filtered().length, icon: 'Gauge', color: '#006acc' },
    {
      label: 'Incidentes no período',
      value: this.filteredTickets().length,
      icon: 'TriangleAlert',
      color: '#e11d48',
    },
    {
      label: 'SLAs com incidentes',
      value: this.slasWithIncidents(),
      icon: 'TriangleAlert',
      color: '#d97706',
    },
  ]);

  constructor() {
    this.search.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.searchValue.set(value));
    this.statusFilter.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.statusValue.set(value));
    this.processFilter.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.processValue.set(value));
    this.criticalityFilter.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.criticalityValue.set(value));
    this.form.controls.client_process_id.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        this.clientProcessValue.set(value);
        if (
          this.form.controls.sipoc_input_id.value &&
          !this.inputs().some((node) => node.id === this.form.controls.sipoc_input_id.value)
        )
          this.form.controls.sipoc_input_id.setValue('');
      });
    this.periodStart.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.periodStartValue.set(value));
    this.periodEnd.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.periodEndValue.set(value));
    void this.loadSlas();
  }

  async loadSlas(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [
        slas,
        processes,
        nodes,
        associations,
        statuses,
        tickets,
        risks,
        incidentTypes,
        approvals,
        users,
      ] = await Promise.all([
        this.slaService.fetchSlas(),
        this.processService.fetchProcesses(),
        this.processService.fetchSipocNodes(),
        this.processService.fetchAllNodeAssociations(),
        this.slaService.fetchStatuses(),
        this.ticketService.fetchTickets(),
        this.riskService.fetchRisks(),
        this.incidentService.fetchIncidentTypes(),
        this.management ? this.slaService.fetchApprovals() : Promise.resolve([]),
        this.management ? this.profilesRepository.findAssignableUsers() : Promise.resolve([]),
      ]);
      this.slas.set(slas);
      this.processes.set(processes);
      this.nodes.set(nodes);
      this.associations.set(associations);
      this.statuses.set(statuses);
      this.tickets.set(tickets);
      this.risks.set(risks);
      this.incidentTypes.set(incidentTypes);
      this.approvals.set(approvals);
      this.users.set(users);
    } catch (e) {
      this.error.set(errorMessage(e, 'Erro ao carregar SLAs'));
    } finally {
      this.loading.set(false);
    }
  }

  openCreateSla(): void {
    if (!this.management || !this.canManage()) return;
    this.editing.set(null);
    this.formError.set(null);
    this.form.reset({
      title: '',
      supplier_process_id: '',
      client_process_id: '',
      sipoc_input_id: '',
      description: '',
      business_rules: '',
      criticality: '',
      notification_type_ids: [],
      justification: '',
    });
    this.clientProcessValue.set('');
    this.formOpen.set(true);
  }

  openEditSla(sla: SLA): void {
    if (!this.management || !this.canManage()) return;
    this.editing.set(sla);
    this.formError.set(null);
    this.form.reset({
      title: sla.title,
      supplier_process_id: sla.supplier_process_id ?? '',
      client_process_id: sla.client_process_id ?? '',
      sipoc_input_id: sla.sipoc_input_id ?? '',
      description: sla.description ?? '',
      business_rules: sla.business_rules ?? '',
      criticality: sla.criticality ?? '',
      notification_type_ids: this.incidentTypes()
        .filter((type) => type.sla_id === sla.id)
        .map((type) => type.id),
      justification: '',
    });
    this.clientProcessValue.set(sla.client_process_id ?? '');
    this.formOpen.set(true);
  }

  openDetail(sla: SLA): void {
    this.selectedId.set(sla.id);
    this.detailOpen.set(true);
  }

  async saveSla(): Promise<void> {
    if (!this.management || !this.canManage() || this.saving()) return;
    if (
      this.form.invalid ||
      !this.form.controls.title.value.trim() ||
      !this.form.controls.description.value.trim() ||
      !this.form.controls.business_rules.value.trim() ||
      !this.form.controls.criticality.value
    ) {
      this.formError.set('Informe nome, descrição, regras de negócio e criticidade.');
      return;
    }
    if (
      !this.form.controls.client_process_id.value ||
      !this.form.controls.supplier_process_id.value ||
      this.form.controls.client_process_id.value === this.form.controls.supplier_process_id.value
    ) {
      this.formError.set('Selecione processos diferentes para cliente e fornecedor.');
      return;
    }
    if (
      this.form.controls.sipoc_input_id.value &&
      !this.inputs().some((node) => node.id === this.form.controls.sipoc_input_id.value)
    ) {
      this.formError.set('A entrada SIPOC deve pertencer ao processo cliente.');
      return;
    }
    const current = this.editing();
    if (current && !this.form.controls.justification.value.trim()) {
      this.formError.set('Informe a justificativa da alteração.');
      return;
    }
    this.formError.set(null);
    this.saving.set(true);
    try {
      const value = this.form.getRawValue();
      const payload = toSlaPayload(value);
      const saved = current
        ? await this.slaService.updateSla(current.id, payload, value.justification.trim())
        : await this.slaService.createSla(payload);
      this.slas.update((items) =>
        current ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
      );
      this.toast.success(current ? 'SLA atualizado' : 'SLA criado');
      this.formOpen.set(false);
      void this.loadSlas();
      if (current && this.historySlaId() === current.id) void this.loadHistory(current.id);
    } catch (e) {
      this.formError.set(errorMessage(e, 'Erro ao salvar SLA'));
    } finally {
      this.saving.set(false);
    }
  }

  async activateSla(sla: SLA): Promise<void> {
    if (!this.management || !this.canManage() || this.saving()) return;
    this.saving.set(true);
    try {
      const saved = await this.slaService.activateSla(sla.id);
      this.slas.update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      void this.loadSlas();
      if (this.historySlaId() === saved.id) void this.loadHistory(saved.id);
      this.toast.success('SLA ativado');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao alterar o SLA'));
    } finally {
      this.saving.set(false);
    }
  }

  async deactivateSla(sla: SLA): Promise<void> {
    if (!this.management || !this.canManage() || this.saving()) return;
    this.saving.set(true);
    try {
      const saved = await this.slaService.deactivate(sla.id, 'Desativado pelo administrador');
      this.slas.update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      if (this.historySlaId() === saved.id) void this.loadHistory(saved.id);
      this.toast.success('SLA desativado');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao desativar SLA'));
    } finally {
      this.saving.set(false);
    }
  }

  approvalLabel(sla: SLA): string {
    const labels: Record<SLA['approval_state'], string> = {
      draft: 'Rascunho',
      pending: 'Aguardando aprovação',
      approved: 'Ativado',
      rejected: 'Rejeitado',
      legacy: 'Ativo (cadastro anterior)',
    };
    return labels[sla.approval_state];
  }

  slaApprovals(sla: SLA): SlaApproval[] {
    return this.approvals().filter(
      (approval) => approval.sla_id === sla.id && approval.revision === sla.approval_revision,
    );
  }

  slaApprovalsById(id: string): SlaApproval[] {
    const sla = this.slas().find((item) => item.id === id);
    return sla ? this.slaApprovals(sla) : [];
  }

  approvalDecisionLabel(decision: SlaApproval['decision']): string {
    return {
      pending: 'Pendente',
      approved: 'Aprovado',
      rejected: 'Rejeitado',
      cancelled: 'Cancelado',
    }[decision];
  }

  approvalProcesses(approval: SlaApproval): string {
    return approval.process_ids.map((id) => this.processName(id)).join(', ');
  }

  toggleIncidentType(id: string, checked: boolean): void {
    const control = this.form.controls.notification_type_ids;
    control.setValue(
      checked ? [...control.value, id] : control.value.filter((item) => item !== id),
    );
  }

  processLabel(id: string | null): string {
    const process = this.processes().find((item) => item.id === id);
    if (!process) return '—';
    const code = processTag(process.code);
    return code ? `${code} — ${process.title}` : process.title;
  }

  processName(id: string | null): string {
    return this.processes().find((process) => process.id === id)?.title ?? 'Não informado';
  }

  statusLabel(status: SlaStatus): string {
    return this.statuses().find((option) => option.key === status)?.label ?? status;
  }

  statusBackground(status: SlaStatus): string {
    return this.statuses().find((option) => option.key === status)?.badge_background ?? '#f1f5f9';
  }

  statusForeground(status: SlaStatus): string {
    const color =
      this.statuses().find((option) => option.key === status)?.badge_foreground ?? '#475569';
    if (this.theme.theme() !== 'dark' || !/^#[0-9a-f]{6}$/i.test(color)) return color;
    const channels = [1, 3, 5].map((index) =>
      Math.round(parseInt(color.slice(index, index + 2), 16) * 0.45 + 255 * 0.55),
    );
    return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  }

  inputLabel(id: string | null): string {
    return this.nodes().find((node) => node.id === id)?.title ?? 'Não vinculada';
  }

  criticalityLabel(value: SlaCriticality | null): string {
    return (
      this.criticalityOptions.find((option) => option.value === value)?.label ?? 'Não informada'
    );
  }

  toggleHistory(sla: SLA): void {
    if (this.historySlaId() === sla.id) {
      this.historySlaId.set(null);
      this.historyRequestId++;
      return;
    }
    this.historySlaId.set(sla.id);
    void this.loadHistory(sla.id);
  }

  userName(id: string | null): string {
    return this.users().find((user) => user.id === id)?.name ?? 'Usuário não disponível';
  }

  historyActionLabel(action: SlaHistory['action']): string {
    return action === 'created'
      ? 'Criação'
      : action === 'baseline'
        ? 'Estado inicial'
        : 'Alteração';
  }

  historyChanges(entry: SlaHistory): { label: string; before: string; after: string }[] {
    if (!entry.before_data) return [];
    const labels: Record<string, string> = {
      title: 'Nome',
      description: 'Descrição',
      business_rules: 'Regras de negócio',
      notification_type_ids: 'Tipos de incidente',
      approval_state: 'Etapa de ativação',
      approval_revision: 'Versão de ativação',
      submitted_at: 'Enviado em',
      approved_at: 'Ativado em',
      supplier_process_id: 'Processo fornecedor',
      client_process_id: 'Processo cliente',
      sipoc_input_id: 'Entrada vinculada',
      lead_time_hours: 'Prazo acordado (horas)',
      quality_criteria: 'Critérios de aceitação',
      criticality: 'Criticidade',
      status: 'Status',
    };
    return Object.entries(labels)
      .filter(
        ([key]) =>
          JSON.stringify(entry.before_data?.[key]) !== JSON.stringify(entry.after_data[key]),
      )
      .map(([key, label]) => ({
        label,
        before: this.historyValue(key, entry.before_data?.[key]),
        after: this.historyValue(key, entry.after_data[key]),
      }));
  }

  historyValue(key: string, value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (key === 'supplier_process_id' || key === 'client_process_id')
      return this.processLabel(String(value));
    if (key === 'sipoc_input_id') return this.inputLabel(String(value));
    if (key === 'criticality') return this.criticalityLabel(value as SlaCriticality);
    if (key === 'status') return this.statusLabel(String(value) as SlaStatus);
    if (key === 'approval_state') {
      return (
        {
          draft: 'Rascunho',
          pending: 'Pendente',
          approved: 'Ativado',
          rejected: 'Rejeitado',
          legacy: 'Legado',
        }[String(value)] ?? String(value)
      );
    }
    if (key === 'submitted_at' || key === 'approved_at')
      return this.formatHistoryDate(String(value));
    if (key === 'notification_type_ids' && Array.isArray(value))
      return value.length ? value.map((id) => this.incidentTypeLabel(String(id))).join(', ') : '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  ticketCount(slaId: string): number {
    return this.ticketsInPeriod().filter((ticket) => ticket.sla_id === slaId).length;
  }

  incidentTypeLabel(id: string | null): string {
    return this.incidentTypes().find((type) => type.id === id)?.name ?? 'Não informado';
  }

  formatDate(value: string | null): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value));
  }

  formatHistoryDate(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  private async loadHistory(slaId: string): Promise<void> {
    this.history.set([]);
    this.historyError.set(null);
    this.historyLoading.set(true);
    const requestId = ++this.historyRequestId;
    try {
      const [entries, users] = await Promise.all([
        this.slaService.fetchSlaHistory(slaId),
        this.profilesRepository.findAll(),
      ]);
      if (requestId === this.historyRequestId) {
        this.history.set(entries);
        this.users.set(users);
      }
    } catch (e) {
      if (requestId === this.historyRequestId)
        this.historyError.set(errorMessage(e, 'Erro ao carregar histórico'));
    } finally {
      if (requestId === this.historyRequestId) this.historyLoading.set(false);
    }
  }
}
