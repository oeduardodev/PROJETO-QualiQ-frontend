import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { errorMessage } from '@shared/utils/error.utils';
import { toSlaPayload } from '../data-access/sla.mapper';
import { processTag } from '../data-access/process-code.utils';
import { SlaService } from '@features/processes/data-access/sla.service';
import { ProcessService } from '@features/processes/data-access/process.service';
import { TicketService } from '@features/notifications/data-access/ticket.service';
import { NotificationService } from '@features/notifications/data-access/notification.service';
import { RiskService } from '@features/risks/data-access/risk.service';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { ProfileRepository } from '@core/data-access/profile.repository';
import type {
  Profile,
  Process,
  Risk,
  NotificationType,
  SLA,
  SlaHistory,
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
  private readonly ticketService = inject(TicketService);
  private readonly notificationService = inject(NotificationService);
  private readonly riskService = inject(RiskService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly profilesRepository = inject(ProfileRepository);
  private readonly toast = inject(ToastService);
  readonly management = this.route.snapshot.data['mode'] === 'management';
  readonly statuses = signal<SlaStatusOption[]>([]);
  readonly activeStatuses = computed(() => this.statuses().filter((option) => option.is_active));
  readonly formStatuses = computed(() =>
    this.statuses().filter((option) => option.is_active || option.key === this.editing()?.status),
  );
  readonly slas = signal<SLA[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly nodes = signal<SipocNode[]>([]);
  readonly tickets = signal<Ticket[]>([]);
  readonly notificationTypes = signal<NotificationType[]>([]);
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
    lead_time_hours: new FormControl(0, { nonNullable: true }),
    quality_criteria: new FormControl('', { nonNullable: true }),
    criticality: new FormControl<SlaCriticality | ''>('', { nonNullable: true }),
    status: new FormControl<SlaStatus>('', { nonNullable: true, validators: Validators.required }),
    justification: new FormControl('', { nonNullable: true }),
  });
  readonly canManage = computed(() => this.auth.isAdmin() || this.auth.isGestor());
  readonly inputs = computed(() => this.nodes().filter((node) => node.node_type === 'I'));
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
  readonly slasWithNotifications = computed(
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
      ...this.notificationTypes()
        .filter((type) => type.sla_id === this.selectedId())
        .map((type) => type.risk_id),
    ]);
    return this.risks().filter((risk) => ids.has(risk.id));
  });
  readonly summary = computed(() => [
    { label: 'SLAs encontrados', value: this.filtered().length, icon: 'Gauge', color: '#2563eb' },
    {
      label: 'Notificações no período',
      value: this.filteredTickets().length,
      icon: 'Bell',
      color: '#e11d48',
    },
    {
      label: 'SLAs com notificações',
      value: this.slasWithNotifications(),
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
      const [slas, processes, nodes, statuses, tickets, risks, notificationTypes] =
        await Promise.all([
          this.slaService.fetchSlas(),
          this.processService.fetchProcesses(),
          this.processService.fetchSipocNodes(),
          this.slaService.fetchStatuses(),
          this.ticketService.fetchTickets(),
          this.riskService.fetchRisks(),
          this.notificationService.fetchNotificationTypes(),
        ]);
      this.slas.set(slas);
      this.processes.set(processes);
      this.nodes.set(nodes);
      this.statuses.set(statuses);
      this.tickets.set(tickets);
      this.risks.set(risks);
      this.notificationTypes.set(notificationTypes);
    } catch (e) {
      this.error.set(errorMessage(e, 'Erro ao carregar SLAs'));
    } finally {
      this.loading.set(false);
    }
  }

  openCreateSla(): void {
    if (!this.activeStatuses().length) return;
    this.editing.set(null);
    this.formError.set(null);
    this.form.reset({
      title: '',
      supplier_process_id: '',
      client_process_id: '',
      sipoc_input_id: '',
      lead_time_hours: 0,
      quality_criteria: '',
      criticality: '',
      status: this.defaultStatus(),
      justification: '',
    });
    this.formOpen.set(true);
  }

  openEditSla(sla: SLA): void {
    this.editing.set(sla);
    this.formError.set(null);
    this.form.reset({
      title: sla.title,
      supplier_process_id: sla.supplier_process_id ?? '',
      client_process_id: sla.client_process_id ?? '',
      sipoc_input_id: sla.sipoc_input_id ?? '',
      lead_time_hours: sla.lead_time_hours,
      quality_criteria: sla.quality_criteria ?? '',
      criticality: sla.criticality ?? '',
      status: sla.status,
      justification: '',
    });
    this.formOpen.set(true);
  }

  openDetail(sla: SLA): void {
    this.selectedId.set(sla.id);
    this.detailOpen.set(true);
  }

  async saveSla(): Promise<void> {
    if (this.form.invalid) {
      this.formError.set('Título é obrigatório.');
      return;
    }
    if (
      !this.form.controls.client_process_id.value &&
      !this.form.controls.supplier_process_id.value
    ) {
      this.formError.set('Selecione um processo cliente ou fornecedor para associar ao SLA.');
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
      if (current && this.historySlaId() === current.id) void this.loadHistory(current.id);
    } catch (e) {
      this.formError.set(errorMessage(e, 'Erro ao salvar SLA'));
    } finally {
      this.saving.set(false);
    }
  }

  async setSlaActive(sla: SLA, active: boolean): Promise<void> {
    if (!this.management || !this.canManage() || this.saving()) return;
    const status = this.statuses().find((option) => option.key === (active ? 'Ativo' : 'Inativo'));
    if (!status) {
      this.toast.error('Status do SLA não disponível');
      return;
    }
    this.saving.set(true);
    try {
      const saved = await this.slaService.updateSla(
        sla.id,
        { status: status.key },
        active ? 'SLA reativado' : 'SLA desativado',
      );
      this.slas.update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      if (this.historySlaId() === saved.id) void this.loadHistory(saved.id);
      this.toast.success(active ? 'SLA reativado' : 'SLA desativado');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao alterar o SLA'));
    } finally {
      this.saving.set(false);
    }
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
    return this.statuses().find((option) => option.key === status)?.badge_foreground ?? '#475569';
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
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  ticketCount(slaId: string): number {
    return this.ticketsInPeriod().filter((ticket) => ticket.sla_id === slaId).length;
  }

  notificationTypeLabel(id: string | null): string {
    return this.notificationTypes().find((type) => type.id === id)?.name ?? 'Não informado';
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

  private defaultStatus(): SlaStatus {
    return (
      this.activeStatuses().find((option) => option.is_default)?.key ??
      this.activeStatuses()[0]?.key ??
      ''
    );
  }
}
