import { errorMessage } from '@shared/utils/error.utils';
import { TICKET_COLUMNS, SEVERITIES } from './notifications.constants';
import { toNotificationTypePayload } from './data-access/notification-type.mapper';
import { toNotificationClassificationPayload } from './data-access/notification-classification.mapper';
import { toNotificationTicketPayload } from './data-access/notification-ticket.mapper';
import { NotificationService } from '@features/notifications/data-access/notification.service';
import { TicketService } from '@features/notifications/data-access/ticket.service';
import { ProcessService } from '@features/processes/data-access/process.service';
import { RiskService } from '@features/risks/data-access/risk.service';
import { SlaService } from '@features/processes/data-access/sla.service';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import type {
  AnalysisTool,
  FormFieldSchema,
  NotificationClassification,
  NotificationSeverity,
  NotificationType,
  Process,
  Risk,
  SLA,
  SipocNode,
  Ticket,
  TicketSeverity,
  TicketStatus,
} from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { ToastService } from '@shared/services/toast.service';
import { METHODOLOGIES } from '@shared/data/methodologies';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective, ModalComponent, MethodologyComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
  host: { class: 'ui-standard-fields' },
})
export class NotificationsComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly ticketService = inject(TicketService);
  private readonly processService = inject(ProcessService);
  private readonly riskService = inject(RiskService);
  private readonly slaService = inject(SlaService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly mode = this.route.snapshot.data['mode'] as 'realize' | 'panel' | 'settings';
  readonly ticketColumns = TICKET_COLUMNS;
  readonly severities = SEVERITIES;
  readonly methodology = METHODOLOGIES['tickets'];
  readonly tickets = signal<Ticket[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly nodes = signal<SipocNode[]>([]);
  readonly types = signal<NotificationType[]>([]);
  readonly classifications = signal<NotificationClassification[]>([]);
  readonly risks = signal<Risk[]>([]);
  readonly slas = signal<SLA[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly methodologyOpen = signal(false);
  readonly ticketOpen = signal(false);
  readonly editingTicket = signal<Ticket | null>(null);
  readonly classificationOpen = signal(false);
  readonly editingClassification = signal<NotificationClassification | null>(null);
  readonly typeOpen = signal(false);
  readonly editingType = signal<NotificationType | null>(null);
  readonly dynamicValues = new Map<string, FormControl<string | number>>();
  readonly dynamicVersion = signal(0);
  readonly ticketForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    description: new FormControl('', { nonNullable: true }),
    process_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    step_id: new FormControl('', { nonNullable: true }),
    status: new FormControl<TicketStatus>('aberto', { nonNullable: true }),
    severity: new FormControl<TicketSeverity>('media', { nonNullable: true }),
    incident_datetime: new FormControl('', { nonNullable: true }),
    risk_id: new FormControl('', { nonNullable: true }),
    sla_id: new FormControl('', { nonNullable: true }),
    notification_type_id: new FormControl('', {
      nonNullable: true,
      validators: Validators.required,
    }),
  });
  readonly classificationForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    code: new FormControl('', { nonNullable: true }),
    default_severity: new FormControl<NotificationSeverity>('media', { nonNullable: true }),
    sla_hours: new FormControl<number | null>(null),
    analysis_tool: new FormControl<AnalysisTool>('Nenhuma', { nonNullable: true }),
    requires_root_cause: new FormControl(false, { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
  });
  readonly typeForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    code: new FormControl('', { nonNullable: true }),
    classification_id: new FormControl('', { nonNullable: true }),
    default_severity: new FormControl<NotificationSeverity>('media', { nonNullable: true }),
    sla_hours: new FormControl<number | null>(null),
    sla_id: new FormControl('', { nonNullable: true }),
    risk_id: new FormControl('', { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
  });
  readonly activeTypes = computed(() => this.types().filter((type) => type.active));
  readonly selectedProcessId = toSignal(this.ticketForm.controls.process_id.valueChanges, {
    initialValue: this.ticketForm.controls.process_id.value,
  });
  readonly stepsForProcess = computed(() =>
    this.nodes().filter(
      (node) => node.node_type === 'P' && node.process_id === this.selectedProcessId(),
    ),
  );

  get title(): string {
    return this.mode === 'realize'
      ? 'Realizar Notificação'
      : this.mode === 'panel'
        ? 'Painel de Notificações'
        : 'Parametrização de Notificações';
  }

  get subtitle(): string {
    return this.mode === 'realize'
      ? 'Registre uma nova ocorrência usando o formulário parametrizado'
      : this.mode === 'panel'
        ? `${this.tickets().length} notificações registradas`
        : `${this.classifications().length} classificações e ${this.types().length} tipos`;
  }

  constructor() {
    void this.loadNotifications();
  }

  async loadNotifications(): Promise<void> {
    this.loading.set(true);
    try {
      const [tickets, processes, nodes, types, classifications, risks, slas] = await Promise.all([
        this.ticketService.fetchTickets(),
        this.processService.fetchProcesses(),
        this.processService.fetchSipocNodes(),
        this.notificationService.fetchNotificationTypes(),
        this.notificationService.fetchNotificationClassifications(),
        this.riskService.fetchRisks(),
        this.slaService.fetchSlas(),
      ]);
      this.tickets.set(tickets);
      this.processes.set(processes);
      this.nodes.set(nodes);
      this.types.set(types);
      this.classifications.set(classifications);
      this.risks.set(risks);
      this.slas.set(slas);
    } catch (e) {
      this.error.set(errorMessage(e, 'Erro ao carregar notificações'));
    } finally {
      this.loading.set(false);
    }
  }

  ticketsByStatus(status: TicketStatus): Ticket[] {
    return this.tickets().filter((ticket) => ticket.status === status);
  }

  processName(id: string): string {
    return this.processes().find((item) => item.id === id)?.title ?? '—';
  }

  classificationName(id: string | null): string {
    return this.classifications().find((item) => item.id === id)?.name ?? 'Sem classificação';
  }

  openTicket(ticket?: Ticket): void {
    this.editingTicket.set(ticket ?? null);
    this.dynamicValues.clear();
    const type = this.types().find((item) => item.id === ticket?.notification_type_id);
    for (const field of type?.form_schema ?? []) {
      const stored = ticket?.custom_fields?.[field.name];
      const value = typeof stored === 'string' || typeof stored === 'number' ? stored : '';
      this.dynamicValues.set(field.name, new FormControl(value, { nonNullable: true }));
    }
    this.dynamicVersion.update((value) => value + 1);
    this.ticketForm.reset(
      ticket
        ? {
            title: ticket.title,
            description: ticket.description ?? '',
            process_id: ticket.process_id,
            step_id: ticket.step_id ?? '',
            status: ticket.status,
            severity: ticket.severity,
            incident_datetime: ticket.incident_datetime?.slice(0, 16) ?? '',
            risk_id: ticket.risk_id ?? '',
            sla_id: ticket.sla_id ?? '',
            notification_type_id: ticket.notification_type_id ?? '',
          }
        : {
            title: '',
            description: '',
            process_id: '',
            step_id: '',
            status: 'aberto',
            severity: 'media',
            incident_datetime: '',
            risk_id: '',
            sla_id: '',
            notification_type_id: '',
          },
    );
    this.ticketOpen.set(true);
  }

  async saveTicket(): Promise<void> {
    if (this.ticketForm.invalid) {
      this.toast.error('Tipo, título e processo são obrigatórios.');
      return;
    }
    this.saving.set(true);
    try {
      const value = this.ticketForm.getRawValue();
      const type = this.types().find((item) => item.id === value.notification_type_id);
      const customFields = Object.fromEntries(
        [...this.dynamicValues].map(([key, control]) => [key, control.value]),
      );
      const missingField = type?.form_schema?.find(
        (field) =>
          field.required && (customFields[field.name] === '' || customFields[field.name] == null),
      );
      if (missingField) {
        this.toast.error(`Preencha o campo ${missingField.label}.`);
        return;
      }
      const current = this.editingTicket();
      const preservedFields =
        current?.notification_type_id === value.notification_type_id
          ? { ...current.custom_fields, ...customFields }
          : customFields;
      const payload = toNotificationTicketPayload(
        value,
        type,
        preservedFields,
        type ? this.classificationName(type.classification_id) : null,
        current ?? undefined,
      );
      const saved = current
        ? await this.ticketService.updateTicket(current.id, payload)
        : await this.ticketService.createTicket(payload);
      this.tickets.update((items) =>
        current ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
      );
      this.toast.success(current ? 'Notificação atualizada' : 'Notificação registrada');
      this.ticketOpen.set(false);
      if (this.mode === 'realize')
        this.ticketForm.reset({
          title: '',
          description: '',
          process_id: '',
          step_id: '',
          status: 'aberto',
          severity: 'media',
          incident_datetime: '',
          risk_id: '',
          sla_id: '',
          notification_type_id: '',
        });
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao salvar notificação'));
    } finally {
      this.saving.set(false);
    }
  }

  async advanceTicket(ticket: Ticket): Promise<void> {
    const saved = await this.ticketService.advance(ticket);
    this.tickets.update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
    this.toast.success('Status atualizado');
  }

  async removeTicket(ticket: Ticket): Promise<void> {
    if (!confirm('Excluir esta notificação?')) return;
    await this.ticketService.deleteTicket(ticket.id);
    this.tickets.update((items) => items.filter((item) => item.id !== ticket.id));
    this.toast.success('Notificação excluída');
  }

  selectNotificationType(id: string): void {
    const type = this.types().find((item) => item.id === id);
    this.dynamicValues.clear();
    if (!type) {
      this.dynamicVersion.update((value) => value + 1);
      return;
    }
    this.ticketForm.patchValue({
      severity: type.default_severity,
      risk_id: type.risk_id ?? '',
      sla_id: type.sla_id ?? '',
    });
    for (const field of type.form_schema ?? [])
      this.dynamicValues.set(field.name, new FormControl('', { nonNullable: true }));
    this.dynamicVersion.update((value) => value + 1);
  }

  dynamicFields(): FormFieldSchema[] {
    this.dynamicVersion();
    const id = this.ticketForm.controls.notification_type_id.value;
    return this.types().find((item) => item.id === id)?.form_schema ?? [];
  }

  dynamicControl(name: string): FormControl<string | number> {
    let control = this.dynamicValues.get(name);
    if (!control) {
      control = new FormControl<string | number>('', { nonNullable: true });
      this.dynamicValues.set(name, control);
    }
    return control;
  }

  clearSelectedStep(): void {
    this.ticketForm.controls.step_id.setValue('');
  }

  openClassification(item?: NotificationClassification): void {
    this.editingClassification.set(item ?? null);
    this.classificationForm.reset(
      item
        ? {
            name: item.name,
            code: item.code ?? '',
            default_severity: item.default_severity,
            sla_hours: item.sla_hours,
            analysis_tool: item.analysis_tool,
            requires_root_cause: item.requires_root_cause,
            active: item.active,
          }
        : {
            name: '',
            code: '',
            default_severity: 'media',
            sla_hours: null,
            analysis_tool: 'Nenhuma',
            requires_root_cause: false,
            active: true,
          },
    );
    this.classificationOpen.set(true);
  }

  async saveClassification(): Promise<void> {
    if (this.classificationForm.invalid) return;
    const value = this.classificationForm.getRawValue();
    const payload = toNotificationClassificationPayload(value);
    const current = this.editingClassification();
    const saved = current
      ? await this.notificationService.updateNotificationClassification(current.id, payload)
      : await this.notificationService.createNotificationClassification(payload);
    this.classifications.update((items) =>
      current ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
    );
    this.toast.success('Classificação salva');
    this.classificationOpen.set(false);
  }

  async removeClassification(item: NotificationClassification): Promise<void> {
    if (!confirm('Excluir esta classificação?')) return;
    await this.notificationService.deleteNotificationClassification(item.id);
    this.classifications.update((items) => items.filter((current) => current.id !== item.id));
    this.toast.success('Classificação excluída');
  }

  openType(item?: NotificationType): void {
    this.editingType.set(item ?? null);
    this.typeForm.reset(
      item
        ? {
            name: item.name,
            code: item.code ?? '',
            classification_id: item.classification_id ?? '',
            default_severity: item.default_severity,
            sla_hours: item.sla_hours,
            sla_id: item.sla_id ?? '',
            risk_id: item.risk_id ?? '',
            active: item.active,
          }
        : {
            name: '',
            code: '',
            classification_id: '',
            default_severity: 'media',
            sla_hours: null,
            sla_id: '',
            risk_id: '',
            active: true,
          },
    );
    this.typeOpen.set(true);
  }

  async saveType(): Promise<void> {
    if (this.typeForm.invalid) return;
    const value = this.typeForm.getRawValue();
    const classification = this.classifications().find(
      (item) => item.id === value.classification_id,
    );
    const payload = toNotificationTypePayload(value, classification);
    const current = this.editingType();
    const saved = current
      ? await this.notificationService.updateNotificationType(current.id, payload)
      : await this.notificationService.createNotificationType(payload);
    this.types.update((items) =>
      current ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
    );
    this.toast.success('Tipo salvo');
    this.typeOpen.set(false);
  }

  async removeType(item: NotificationType): Promise<void> {
    if (!confirm('Excluir este tipo?')) return;
    await this.notificationService.deleteNotificationType(item.id);
    this.types.update((items) => items.filter((current) => current.id !== item.id));
    this.toast.success('Tipo excluído');
  }

  severityLabel(value: TicketSeverity): string {
    return { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' }[value];
  }

  severityClass(value: TicketSeverity): string {
    return value === 'critica'
      ? 'bg-rose-100 text-rose-700'
      : value === 'alta'
        ? 'bg-orange-100 text-orange-700'
        : value === 'media'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-slate-100 text-slate-600';
  }
}
