import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActionPlanService } from './data-access/action-plan.service';
import { IncidentTicketService } from '@features/incidents/data-access/incident-ticket.service';
import { ProcessService } from '@features/processes/data-access/process.service';
import { ProfileService } from '@core/services/profile.service';
import { AuthService } from '@core/services/auth.service';
import { SideDrawerComponent } from '@shared/components/side-drawer/side-drawer.component';
import { CheckboxListComponent } from '@shared/components/checkbox-list/checkbox-list.component';
import { ToastService } from '@shared/services/toast.service';
import { errorMessage } from '@shared/utils/error.utils';
import type {
  ActionPlan,
  ActionPlanTask,
  ActionPlanStatusOption,
  ActionPlanComment,
  ActionPlanEvidence,
  ActionPlanHistory,
  Profile,
  Process,
  Ticket,
} from '@core/models/database';

@Component({
  selector: 'app-action-plans',
  imports: [ReactiveFormsModule, DatePipe, SideDrawerComponent, CheckboxListComponent],
  templateUrl: './action-plans.component.html',
  styleUrl: './action-plans.component.scss',
  host: { class: 'ui-standard-fields' },
})
export class ActionPlansComponent {
  private readonly service = inject(ActionPlanService);
  private readonly ticketService = inject(IncidentTicketService);
  private readonly profileService = inject(ProfileService);
  private readonly processService = inject(ProcessService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly plans = signal<ActionPlan[]>([]);
  readonly tickets = signal<Ticket[]>([]);
  readonly profiles = signal<Profile[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly columns = signal<ActionPlanStatusOption[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly formOpen = signal(false);
  readonly editing = signal<ActionPlan | null>(null);
  readonly tasks = signal<ActionPlanTask[]>([]);
  readonly comments = signal<ActionPlanComment[]>([]);
  readonly evidence = signal<ActionPlanEvidence[]>([]);
  readonly history = signal<ActionPlanHistory[]>([]);
  readonly search = signal('');
  readonly originFilter = signal('');
  readonly showInactive = signal(false);
  readonly onlyMine = signal(false);
  readonly today = new Date().toLocaleDateString('en-CA');
  readonly comment = new FormControl('', { nonNullable: true });
  readonly reason = new FormControl('', { nonNullable: true });
  readonly operation = signal<{
    plan: ActionPlan;
    action: string;
    label: string;
    task?: ActionPlanTask;
  } | null>(null);
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    ticket_id: new FormControl('', { nonNullable: true }),
    process_id: new FormControl('', { nonNullable: true }),
    owner_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    controller_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    participant_ids: new FormControl<string[]>([], { nonNullable: true }),
    what: new FormControl('', { nonNullable: true }),
    why: new FormControl('', { nonNullable: true }),
    where: new FormControl('', { nonNullable: true }),
    when: new FormControl('', { nonNullable: true }),
    how: new FormControl('', { nonNullable: true }),
    how_much: new FormControl('', { nonNullable: true }),
    how_mode: new FormControl<'text' | 'tasks'>('text', { nonNullable: true }),
    reason: new FormControl('', { nonNullable: true }),
  });
  readonly filtered = computed(() =>
    this.plans().filter(
      (p) =>
        (this.showInactive() ? !p.active : p.active) &&
        (!this.originFilter() || p.origin === this.originFilter()) &&
        [p.title, p.code].join(' ').toLowerCase().includes(this.search().toLowerCase()) &&
        (!this.onlyMine() ||
          p.owner_id === this.auth.user()?.id ||
          p.controller_id === this.auth.user()?.id ||
          p.participant_ids.includes(this.auth.user()?.id ?? '')),
    ),
  );
  readonly overduePlans = computed(
    () => this.plans().filter((p) => p.active && this.isOverdue(p)).length,
  );
  readonly overdueTasks = computed(
    () =>
      this.plans()
        .filter((p) => p.active)
        .flatMap((p) => p.tasks)
        .filter((t) => !t.completed && t.due_date < this.today).length,
  );
  readonly pendingReviews = computed(
    () =>
      this.plans().filter(
        (p) => p.active && p.review_state === 'pending' && p.controller_id === this.auth.user()?.id,
      ).length,
  );

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [plans, tickets, profiles, processes, columns] = await Promise.all([
        this.service.fetchActionPlans(),
        this.ticketService.fetchTickets(),
        this.profileService.findAll(),
        this.processService.fetchProcesses(),
        this.service.fetchStatuses(),
      ]);
      this.plans.set(plans);
      this.tickets.set(tickets);
      this.profiles.set(profiles);
      this.processes.set(processes);
      this.columns.set(columns);
      const ticket = this.route.snapshot.queryParamMap.get('ticket');
      if (ticket) this.open(undefined, ticket);
      const id = this.route.snapshot.queryParamMap.get('id');
      const plan = plans.find((p) => p.id === id);
      if (plan) this.open(plan);
    } catch (e) {
      this.error.set(errorMessage(e, 'Erro ao carregar planos'));
    } finally {
      this.loading.set(false);
    }
  }

  byStatus(status: string): ActionPlan[] {
    return this.filtered().filter((p) => p.status === status);
  }

  profileName(id: string | null): string {
    return this.profiles().find((p) => p.id === id)?.name ?? 'Não definido';
  }

  originLabel(origin: string): string {
    return (
      (
        {
          manual: 'Criado no módulo',
          notification: 'Incidente',
          critical_analysis: 'Análise crítica',
          system: 'Outro módulo',
        } as Record<string, string>
      )[origin] ?? origin
    );
  }

  isOverdue(plan: ActionPlan): boolean {
    return (
      !!plan.when &&
      plan.when < this.today &&
      !this.columns().find((c) => c.key === plan.status)?.is_terminal
    );
  }

  canEdit(plan: ActionPlan | null = this.editing()): boolean {
    return !plan
      ? this.auth.isAdmin() || this.auth.isGestor()
      : plan.active && (this.auth.isAdmin() || plan.owner_id === this.auth.user()?.id);
  }

  open(plan?: ActionPlan, ticketId = ''): void {
    this.editing.set(plan ?? null);
    this.tasks.set(plan?.tasks.map((t) => ({ ...t })) ?? []);
    this.comment.reset();
    this.comments.set([]);
    this.evidence.set([]);
    this.history.set([]);
    this.form.reset({
      title: plan?.title ?? '',
      ticket_id: plan?.ticket_id ?? ticketId,
      process_id: plan?.process_id ?? '',
      owner_id: plan?.owner_id ?? this.auth.user()?.id ?? '',
      controller_id: plan?.controller_id ?? '',
      participant_ids: plan?.participant_ids ?? [],
      what: plan?.what ?? '',
      why: plan?.why ?? '',
      where: plan?.where ?? '',
      when: plan?.when ?? '',
      how: plan?.how ?? '',
      how_much: plan?.how_much ?? '',
      how_mode: plan?.how_mode ?? 'text',
      reason: '',
    });
    this.formOpen.set(true);
    if (plan) void this.loadActivity(plan.id);
  }

  async loadActivity(id: string): Promise<void> {
    try {
      const activity = await this.service.activity(id);
      if (this.editing()?.id === id) {
        this.comments.set(activity.comments);
        this.evidence.set(activity.evidence);
        this.history.set(activity.history);
      }
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao carregar histórico'));
    }
  }

  addTask(): void {
    this.tasks.update((items) => [
      ...items,
      { id: crypto.randomUUID(), title: '', due_date: '', completed: false },
    ]);
  }

  updateTask(id: string, key: 'title' | 'due_date', value: string): void {
    this.tasks.update((items) => items.map((t) => (t.id === id ? { ...t, [key]: value } : t)));
  }

  removeTask(id: string): void {
    this.tasks.update((items) => items.filter((t) => t.id !== id));
  }

  private saved(plan: ActionPlan): void {
    this.plans.update((items) => [plan, ...items.filter((p) => p.id !== plan.id)]);
    if (this.editing()?.id === plan.id) {
      this.editing.set(plan);
      this.tasks.set(plan.tasks);
      void this.loadActivity(plan.id);
    }
  }

  async save(): Promise<void> {
    if (this.busy() || !this.canEdit()) return;
    const value = this.form.getRawValue();
    if (this.form.invalid || !value.title.trim() || (this.editing() && !value.reason.trim())) {
      this.toast.error('Informe título, responsável, controlador e justificativa das alterações.');
      return;
    }
    if (
      value.how_mode === 'tasks' &&
      (!this.tasks().length ||
        this.tasks().some(
          (t) => !t.title.trim() || !t.due_date || (value.when && t.due_date > value.when),
        ))
    ) {
      this.toast.error('Preencha título e prazo de todas as tarefas, dentro do prazo do plano.');
      return;
    }
    this.busy.set(true);
    try {
      const saved = await this.service.save(
        this.editing(),
        {
          ...value,
          ticket_id: value.ticket_id || null,
          process_id: value.process_id || null,
          tasks: value.how_mode === 'tasks' ? this.tasks() : [],
        },
        value.reason,
      );
      this.saved(saved);
      this.formOpen.set(false);
      this.toast.success('Plano salvo');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao salvar plano'));
    } finally {
      this.busy.set(false);
    }
  }

  begin(plan: ActionPlan, action: string, label: string, task?: ActionPlanTask): void {
    this.reason.reset();
    this.operation.set({ plan, action, label, task });
  }

  async confirmOperation(): Promise<void> {
    const op = this.operation();
    if (!op || this.busy()) return;
    if (!this.reason.value.trim()) {
      this.toast.error('Informe a justificativa.');
      return;
    }
    this.busy.set(true);
    try {
      const saved = op.task
        ? await this.service.task(op.plan, op.task.id, !op.task.completed, this.reason.value)
        : await this.service.transition(op.plan, op.action, this.reason.value);
      this.saved(saved);
      this.operation.set(null);
      this.toast.success('Evolução registrada');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Não foi possível atualizar o plano'));
    } finally {
      this.busy.set(false);
    }
  }

  async addComment(): Promise<void> {
    const plan = this.editing();
    if (!plan || this.busy() || !this.comment.value.trim()) return;
    this.busy.set(true);
    try {
      const saved = await this.service.comment(plan.id, this.comment.value.trim());
      this.comments.update((items) => [...items, saved]);
      this.comment.reset();
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao salvar comentário'));
    } finally {
      this.busy.set(false);
    }
  }

  async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const plan = this.editing();
    if (!file || !plan || this.busy()) return;
    this.busy.set(true);
    try {
      const saved = await this.service.upload(plan, file);
      this.evidence.update((items) => [...items, saved]);
      this.toast.success('Evidência anexada');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao anexar evidência'));
    } finally {
      this.busy.set(false);
      input.value = '';
    }
  }

  async openEvidence(item: ActionPlanEvidence): Promise<void> {
    try {
      const url = await this.service.evidenceUrl(item);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao abrir evidência'));
    }
  }
}
