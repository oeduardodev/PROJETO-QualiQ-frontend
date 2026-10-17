import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IncidentService } from './data-access/incident.service';
import { IncidentTicketService } from './data-access/incident-ticket.service';
import { ProcessService } from '@features/processes/data-access/process.service';
import { ActionPlanService } from '@features/actions/data-access/action-plan.service';
import { RiskService } from '@features/risks/data-access/risk.service';
import { SlaService } from '@features/processes/data-access/sla.service';
import { ProfileService } from '@core/services/profile.service';
import { AuthService } from '@core/services/auth.service';
import { SideDrawerComponent } from '@shared/components/side-drawer/side-drawer.component';
import { FormSchemaEditorComponent } from '@shared/components/form-schema-editor/form-schema-editor.component';
import { ToastService } from '@shared/services/toast.service';
import { errorMessage } from '@shared/utils/error.utils';
import { classificationSchema, validateAnswers, validateSchema } from './incident-form.utils';
import type {
  ActionPlan,
  AnalysisToolOption,
  FormFieldSchema,
  IncidentClassification,
  IncidentType,
  Process,
  Profile,
  Risk,
  SLA,
  SipocNode,
  Ticket,
  TicketStatusOption,
} from '@core/models/database';

@Component({
  selector: 'app-incidents',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    SideDrawerComponent,
    FormSchemaEditorComponent,
    DatePipe,
    NgTemplateOutlet,
  ],
  templateUrl: './incidents.component.html',
  styleUrl: './incidents.component.scss',
  host: { class: 'ui-standard-fields' },
})
export class IncidentsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly incidentService = inject(IncidentService);
  private readonly ticketService = inject(IncidentTicketService);
  private readonly processService = inject(ProcessService);
  private readonly planService = inject(ActionPlanService);
  private readonly riskService = inject(RiskService);
  private readonly slaService = inject(SlaService);
  private readonly profileService = inject(ProfileService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly mode = this.route.snapshot.data['mode'] as 'realize' | 'panel' | 'settings';
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly tickets = signal<Ticket[]>([]);
  readonly types = signal<IncidentType[]>([]);
  readonly classifications = signal<IncidentClassification[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly profiles = signal<Profile[]>([]);
  readonly nodes = signal<SipocNode[]>([]);
  readonly risks = signal<Risk[]>([]);
  readonly slas = signal<SLA[]>([]);
  readonly analysisTools = signal<AnalysisToolOption[]>([]);
  readonly columns = signal<TicketStatusOption[]>([]);
  readonly section = signal('classifications');
  readonly search = signal('');
  readonly processFilter = signal('');
  readonly classFilter = signal('');
  readonly selectedClass = signal('');
  readonly ticketOpen = signal(false);
  readonly editing = signal<Ticket | null>(null);
  readonly linkedPlans = signal<ActionPlan[]>([]);
  readonly dynamicFields = signal<FormFieldSchema[]>([]);
  readonly dynamicControls = new Map<string, FormControl<string | number>>();
  readonly causeControls = [
    'Máquina',
    'Método',
    'Mão de obra',
    'Material',
    'Meio ambiente',
    'Medida',
  ].map((label) => ({ label, control: new FormControl('', { nonNullable: true }) }));
  readonly whyControls = Array.from(
    { length: 5 },
    () => new FormControl('', { nonNullable: true }),
  );
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    description: new FormControl('', { nonNullable: true }),
    process_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    step_id: new FormControl('', { nonNullable: true }),
    notification_type_id: new FormControl('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    incident_datetime: new FormControl('', { nonNullable: true }),
    treatment: new FormControl('', { nonNullable: true }),
    analysis_completed: new FormControl(false, { nonNullable: true }),
    reason: new FormControl('', { nonNullable: true }),
  });
  readonly configOpen = signal(false);
  readonly configKind = signal<'classification' | 'type'>('classification');
  readonly editingClass = signal<IncidentClassification | null>(null);
  readonly editingType = signal<IncidentType | null>(null);
  readonly schema = signal<FormFieldSchema[]>([]);
  readonly config = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    code: new FormControl('', { nonNullable: true }),
    classification_id: new FormControl('', { nonNullable: true }),
    sla_hours: new FormControl<number | null>(null),
    analysis_tool: new FormControl('', { nonNullable: true }),
    requires_root_cause: new FormControl(false, { nonNullable: true }),
    risk_id: new FormControl('', { nonNullable: true }),
    sla_id: new FormControl('', { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
  });
  readonly operation = signal<{ ticket: Ticket; action: string; label: string } | null>(null);
  readonly reason = new FormControl('', { nonNullable: true });
  readonly manager = new FormControl('', { nonNullable: true });
  readonly linkClass = new FormControl('', { nonNullable: true });
  readonly linkProcess = new FormControl('', { nonNullable: true });
  readonly publicLink = signal('');
  readonly activeClasses = computed(() => this.classifications().filter((c) => c.active));
  readonly availableTypes = computed(() =>
    this.types().filter((t) => t.active && t.classification_id === this.selectedClass()),
  );
  readonly managers = computed(() =>
    this.profiles().filter((p) => p.role.toLowerCase() === 'gestor'),
  );
  readonly filteredTickets = computed(() =>
    this.tickets().filter(
      (t) =>
        (this.auth.isAdmin() ||
          t.assigned_to === this.auth.user()?.id ||
          t.created_by === this.auth.user()?.id) &&
        [t.code, t.title].join(' ').toLowerCase().includes(this.search().toLowerCase()) &&
        (!this.processFilter() || t.process_id === this.processFilter()) &&
        (!this.classFilter() || t.classification_id === this.classFilter()),
    ),
  );
  readonly title =
    this.mode === 'settings'
      ? 'Parametrização e Tipos'
      : this.mode === 'panel'
        ? 'Painel de Incidentes'
        : 'Registrar Incidente';

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [tickets, types, classes, processes, profiles, nodes, tools, columns, risks, slas] =
        await Promise.all([
          this.ticketService.fetchTickets(),
          this.incidentService.fetchIncidentTypes(),
          this.incidentService.fetchIncidentClassifications(),
          this.processService.fetchProcesses(),
          this.profileService.findAll(),
          this.processService.fetchSipocNodes(),
          this.incidentService.fetchAnalysisTools(),
          this.ticketService.fetchStatuses(),
          this.riskService.fetchRisks(),
          this.slaService.fetchSlas(),
        ]);
      this.tickets.set(tickets);
      this.types.set(types);
      this.classifications.set(classes);
      this.processes.set(processes);
      this.profiles.set(profiles);
      this.nodes.set(nodes);
      this.analysisTools.set(tools);
      this.columns.set(columns);
      this.risks.set(risks);
      this.slas.set(slas);
      const target = this.route.snapshot.queryParamMap.get('id');
      const ticket = this.mode === 'panel' ? tickets.find((item) => item.id === target) : null;
      if (ticket && this.editing()?.id !== ticket.id) void this.openTicket(ticket);
    } catch (e) {
      this.error.set(errorMessage(e, 'Erro ao carregar incidentes'));
    } finally {
      this.loading.set(false);
    }
  }

  byStatus(status: string): Ticket[] {
    return this.filteredTickets().filter((t) => t.status === status);
  }

  processName(id: string): string {
    return this.processes().find((p) => p.id === id)?.title ?? '—';
  }

  className(id: string | null): string {
    return this.classifications().find((c) => c.id === id)?.name ?? '—';
  }

  profileName(id: string | null): string {
    return this.profiles().find((p) => p.id === id)?.name ?? 'Não encaminhado';
  }

  selectClass(id: string): void {
    this.selectedClass.set(id);
    this.form.controls.notification_type_id.setValue('');
    this.dynamicFields.set(this.classifications().find((c) => c.id === id)?.form_schema ?? []);
    this.dynamicControls.clear();
  }

  selectType(): void {
    const type = this.types().find((t) => t.id === this.form.controls.notification_type_id.value);
    this.dynamicFields.set(classificationSchema(type, this.classifications()));
    this.dynamicControls.clear();
  }

  control(name: string): FormControl<string | number> {
    if (!this.dynamicControls.has(name))
      this.dynamicControls.set(name, new FormControl<string | number>('', { nonNullable: true }));
    return this.dynamicControls.get(name)!;
  }

  steps(): SipocNode[] {
    return this.nodes().filter(
      (n) => n.node_type === 'P' && n.process_id === this.form.controls.process_id.value,
    );
  }

  canTreat(ticket: Ticket): boolean {
    return (
      ticket.assigned_to === this.auth.user()?.id && ['analise', 'plano'].includes(ticket.status)
    );
  }

  canEdit(): boolean {
    const t = this.editing();
    return (
      !t ||
      (this.auth.isAdmin() && !['concluido', 'arquivado'].includes(t.status)) ||
      this.canTreat(t)
    );
  }

  analysisKind(): string {
    const t = this.editing();
    const c = this.classifications().find((c) => c.id === this.selectedClass());
    return (
      this.analysisTools().find((a) => a.key === (t?.analysis_tool_snapshot ?? c?.analysis_tool))
        ?.render_kind ?? 'none'
    );
  }

  async openTicket(ticket: Ticket): Promise<void> {
    this.editing.set(ticket);
    this.selectedClass.set(
      ticket.classification_id ??
        this.types().find((t) => t.id === ticket.notification_type_id)?.classification_id ??
        '',
    );
    this.form.reset({
      title: ticket.title,
      description: ticket.description ?? '',
      process_id: ticket.process_id,
      step_id: ticket.step_id ?? '',
      notification_type_id: ticket.notification_type_id ?? '',
      incident_datetime: ticket.incident_datetime?.slice(0, 16) ?? '',
      treatment: ticket.treatment ?? '',
      analysis_completed: ticket.analysis_completed,
      reason: '',
    });
    this.selectType();
    for (const field of this.dynamicFields())
      this.control(field.name).setValue(
        (ticket.custom_fields[field.name] as string | number) ?? '',
      );
    const keys = ['maquina', 'metodo', 'mao_de_obra', 'material', 'meio_ambiente', 'medida'];
    const cause = ticket.custom_fields['ishikawa'] as Record<string, string> | undefined;
    this.causeControls.forEach((c, i) => c.control.setValue(cause?.[keys[i]] ?? ''));
    const whys = ticket.custom_fields['five_whys'] as string[] | undefined;
    this.whyControls.forEach((c, i) => c.setValue(whys?.[i] ?? ''));
    this.linkedPlans.set([]);
    this.ticketOpen.set(true);
    try {
      const plans = await this.planService.fetchActionPlansByTicket(ticket.id);
      if (this.editing()?.id === ticket.id) this.linkedPlans.set(plans);
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao carregar planos'));
    }
  }

  async saveTicket(): Promise<void> {
    if (this.saving() || !this.canEdit()) return;
    const value = this.form.getRawValue();
    const current = this.editing();
    const fields = Object.fromEntries([...this.dynamicControls].map(([k, v]) => [k, v.value]));
    const invalid = validateAnswers(this.dynamicFields(), fields);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const requiredFields = [
        ['Tipo', this.form.controls.notification_type_id],
        ['Título', this.form.controls.title],
        ['Processo', this.form.controls.process_id],
      ] as const;
      const missing = requiredFields
        .filter(([, control]) => control.invalid)
        .map(([label]) => label);
      this.toast.error(`Preencha os campos obrigatórios: ${missing.join(', ')}.`);
      return;
    }
    if (invalid) {
      this.toast.error(invalid);
      return;
    }
    if (current && !value.reason.trim()) {
      this.toast.error('Informe a justificativa da alteração.');
      return;
    }
    const sameType = current?.notification_type_id === value.notification_type_id;
    const custom: Record<string, unknown> = {
      ...(sameType ? current?.custom_fields : {}),
      ...fields,
    };
    if (current && this.analysisKind() === 'ishikawa')
      custom['ishikawa'] = Object.fromEntries(
        ['maquina', 'metodo', 'mao_de_obra', 'material', 'meio_ambiente', 'medida'].map((k, i) => [
          k,
          this.causeControls[i].control.value,
        ]),
      );
    if (current && this.analysisKind() === 'five_whys')
      custom['five_whys'] = this.whyControls.map((c) => c.value);
    this.saving.set(true);
    try {
      const saved = await this.ticketService.save(
        current,
        { ...value, step_id: value.step_id || null, custom_fields: custom },
        value.reason,
      );
      this.tickets.update((items) => [saved, ...items.filter((t) => t.id !== saved.id)]);
      this.ticketOpen.set(false);
      this.toast.success(current ? 'Incidente atualizado' : `Incidente registrado: ${saved.code}`);
      if (!current) {
        this.form.reset();
        this.selectedClass.set('');
        this.dynamicFields.set([]);
        this.dynamicControls.clear();
      }
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao salvar incidente'));
    } finally {
      this.saving.set(false);
    }
  }

  begin(ticket: Ticket, action: string, label: string): void {
    this.operation.set({ ticket, action, label });
    this.reason.reset();
    this.manager.setValue(ticket.assigned_to ?? '');
  }

  async confirmOperation(): Promise<void> {
    const op = this.operation();
    if (!op || this.saving()) return;
    if (!this.reason.value.trim() || (op.action === 'forward' && !this.manager.value)) {
      this.toast.error('Informe a justificativa e o gestor, quando aplicável.');
      return;
    }
    this.saving.set(true);
    try {
      const saved = await this.ticketService.transition(
        op.ticket,
        op.action,
        this.manager.value || null,
        this.reason.value,
      );
      this.tickets.update((items) => items.map((t) => (t.id === saved.id ? saved : t)));
      this.operation.set(null);
      this.toast.success('Fluxo atualizado');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Não foi possível atualizar o fluxo'));
    } finally {
      this.saving.set(false);
    }
  }

  openClassification(item?: IncidentClassification): void {
    if (!this.auth.isAdmin()) return;
    this.configKind.set('classification');
    this.editingClass.set(item ?? null);
    this.editingType.set(null);
    this.config.reset({
      name: item?.name ?? '',
      code: item?.code ?? '',
      sla_hours: item?.sla_hours ?? 24,
      analysis_tool:
        item?.analysis_tool ?? this.analysisTools().find((a) => a.is_default)?.key ?? 'Nenhuma',
      requires_root_cause: item?.requires_root_cause ?? false,
      active: item?.active ?? true,
    });
    this.schema.set(item?.form_schema ?? []);
    this.configOpen.set(true);
  }

  openType(item?: IncidentType): void {
    if (!this.auth.isAdmin()) return;
    this.configKind.set('type');
    this.editingType.set(item ?? null);
    this.editingClass.set(null);
    this.config.reset({
      name: item?.name ?? '',
      classification_id: item?.classification_id ?? this.selectedClass(),
      code: item?.code ?? '',
      risk_id: item?.risk_id ?? '',
      sla_id: item?.sla_id ?? '',
      active: item?.active ?? true,
    });
    this.configOpen.set(true);
  }

  async saveConfig(): Promise<void> {
    if (!this.auth.isAdmin() || this.saving()) return;
    const v = this.config.getRawValue();
    const isClass = this.configKind() === 'classification';
    const schemaError = isClass ? validateSchema(this.schema()) : null;
    if (
      !v.name.trim() ||
      schemaError ||
      (isClass &&
        (!/^[A-Za-z][A-Za-z0-9]{1,7}$/.test(v.code) || !v.sla_hours || v.sla_hours <= 0)) ||
      (!isClass && !v.classification_id)
    ) {
      this.toast.error(
        schemaError ?? 'Informe nome, sigla e prazo válidos, ou a classificação do tipo.',
      );
      return;
    }
    this.saving.set(true);
    try {
      if (isClass) {
        const payload = {
          name: v.name.trim(),
          code: v.code.toUpperCase(),
          sla_hours: v.sla_hours,
          analysis_tool: v.analysis_tool,
          requires_root_cause: v.requires_root_cause,
          active: v.active,
          form_schema: this.schema(),
        };
        const saved = this.editingClass()
          ? await this.incidentService.updateIncidentClassification(
              this.editingClass()!.id,
              payload,
            )
          : await this.incidentService.createIncidentClassification(payload);
        this.classifications.update((items) => [saved, ...items.filter((c) => c.id !== saved.id)]);
      } else {
        const payload = {
          name: v.name.trim(),
          classification_id: v.classification_id,
          risk_id: v.risk_id || null,
          sla_id: v.sla_id || null,
          active: v.active,
        };
        const saved = this.editingType()
          ? await this.incidentService.updateIncidentType(this.editingType()!.id, payload)
          : await this.incidentService.createIncidentType(payload);
        this.types.update((items) => [saved, ...items.filter((t) => t.id !== saved.id)]);
      }
      this.configOpen.set(false);
      this.toast.success('Configuração salva');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao salvar configuração'));
    } finally {
      this.saving.set(false);
    }
  }

  async generateLink(): Promise<void> {
    if (!this.auth.isAdmin() || this.saving() || !this.linkClass.value || !this.linkProcess.value)
      return;
    this.saving.set(true);
    this.publicLink.set('');
    try {
      const token = await this.ticketService.publicLink(
        this.linkClass.value,
        this.linkProcess.value,
      );
      this.publicLink.set(new URL(`/incidente-publico/${token}`, window.location.origin).href);
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao gerar link'));
    } finally {
      this.saving.set(false);
    }
  }
}
