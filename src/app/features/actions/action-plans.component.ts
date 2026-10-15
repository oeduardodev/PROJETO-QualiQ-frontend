import { errorMessage } from '@shared/utils/error.utils';
import { toActionPlanPayload } from './data-access/action-plan.mapper';
import { ActionPlanService } from '@features/actions/data-access/action-plan.service';
import { TicketService } from '@features/notifications/data-access/ticket.service';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
  ActionPlan,
  ActionPlanStatus,
  ActionPlanStatusOption,
  Ticket,
} from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { SideDrawerComponent } from '@shared/components/side-drawer/side-drawer.component';
import { ToastService } from '@shared/services/toast.service';
import { AlertDialogService } from '@shared/services/alert-dialog.service';
import { METHODOLOGIES } from '@shared/data/methodologies';

@Component({
  selector: 'app-action-plans',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective, SideDrawerComponent, MethodologyComponent],
  templateUrl: './action-plans.component.html',
  styleUrl: './action-plans.component.scss',
  host: { class: 'ui-standard-fields' },
})
export class ActionPlansComponent {
  private readonly actionPlanService = inject(ActionPlanService);
  private readonly ticketService = inject(TicketService);
  private readonly toast = inject(ToastService);
  private readonly alertDialog = inject(AlertDialogService);
  readonly columns = signal<ActionPlanStatusOption[]>([]);
  readonly activeStatuses = computed(() => this.columns().filter((option) => option.is_active));
  readonly formStatuses = computed(() =>
    this.columns().filter((option) => option.is_active || option.key === this.editing()?.status),
  );
  readonly methodology = METHODOLOGIES['actionPlans'] ?? METHODOLOGIES['tickets'];
  readonly plans = signal<ActionPlan[]>([]);
  readonly tickets = signal<Ticket[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<ActionPlan | null>(null);
  readonly methodologyOpen = signal(false);
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    ticket_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    what: new FormControl('', { nonNullable: true }),
    why: new FormControl('', { nonNullable: true }),
    where: new FormControl('', { nonNullable: true }),
    when: new FormControl('', { nonNullable: true }),
    who: new FormControl('', { nonNullable: true }),
    how: new FormControl('', { nonNullable: true }),
    how_much: new FormControl('', { nonNullable: true }),
    status: new FormControl<ActionPlanStatus>('', {
      nonNullable: true,
      validators: Validators.required,
    }),
  });

  constructor() {
    void this.loadActionPlans();
  }

  async loadActionPlans(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [plans, tickets, statuses] = await Promise.all([
        this.actionPlanService.fetchActionPlans(),
        this.ticketService.fetchTickets(),
        this.actionPlanService.fetchStatuses(),
      ]);
      this.plans.set(plans);
      this.tickets.set(tickets);
      this.columns.set(statuses);
    } catch (e) {
      this.error.set(errorMessage(e, 'Erro ao carregar planos de ação'));
    } finally {
      this.loading.set(false);
    }
  }

  byStatus(status: ActionPlanStatus): ActionPlan[] {
    return this.plans().filter((plan) => plan.status === status);
  }

  canAdvance(status: ActionPlanStatus): boolean {
    const next = this.columns().find((option) => option.key === status)?.next_status_key;
    return !!next && this.activeStatuses().some((option) => option.key === next);
  }

  ticketName(ticketId: string): string {
    return this.tickets().find((ticket) => ticket.id === ticketId)?.title ?? '—';
  }

  openCreateActionPlan(): void {
    if (!this.activeStatuses().length) return;
    this.editing.set(null);
    this.form.reset({
      title: '',
      ticket_id: '',
      what: '',
      why: '',
      where: '',
      when: '',
      who: '',
      how: '',
      how_much: '',
      status: this.defaultStatus(),
    });
    this.formOpen.set(true);
  }

  openEditActionPlan(plan: ActionPlan): void {
    this.editing.set(plan);
    this.form.reset({
      title: plan.title,
      ticket_id: plan.ticket_id,
      what: plan.what ?? '',
      why: plan.why ?? '',
      where: plan.where ?? '',
      when: plan.when ?? '',
      who: plan.who ?? '',
      how: plan.how ?? '',
      how_much: plan.how_much ?? '',
      status: plan.status,
    });
    this.formOpen.set(true);
  }

  async saveActionPlan(): Promise<void> {
    if (this.form.invalid) return;
    try {
      const payload = toActionPlanPayload(this.form.getRawValue());
      const current = this.editing();
      const saved = current
        ? await this.actionPlanService.updateActionPlan(current.id, payload)
        : await this.actionPlanService.createActionPlan(payload);
      this.plans.update((items) =>
        current ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
      );
      this.toast.success(current ? 'Plano atualizado' : 'Plano criado');
      this.formOpen.set(false);
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao salvar plano'));
    }
  }

  async advanceActionPlan(plan: ActionPlan): Promise<void> {
    try {
      const saved = await this.actionPlanService.advance(plan);
      this.plans.update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      this.toast.success('Status atualizado');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao atualizar status'));
    }
  }

  async deleteActionPlan(plan: ActionPlan): Promise<void> {
    if (!(await this.alertDialog.confirm('Excluir este plano de ação?'))) return;
    try {
      await this.actionPlanService.deleteActionPlan(plan.id);
      this.plans.update((items) => items.filter((item) => item.id !== plan.id));
      this.toast.success('Plano excluído');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao excluir plano'));
    }
  }

  private defaultStatus(): ActionPlanStatus {
    return (
      this.activeStatuses().find((option) => option.is_initial)?.key ??
      this.activeStatuses()[0]?.key ??
      ''
    );
  }
}
