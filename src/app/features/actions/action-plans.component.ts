import { COLUMNS } from './action-plans.constants';
import { toActionPlanPayload } from './data-access/action-plan.mapper';
import { ActionPlanService } from '@features/actions/data-access/action-plan.service';
import { TicketService } from '@features/notifications/data-access/ticket.service';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { ActionPlan, ActionPlanStatus, Ticket } from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { SideDrawerComponent } from '@shared/components/side-drawer/side-drawer.component';
import { ToastService } from '@shared/services/toast.service';
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
  readonly columns = COLUMNS;
  readonly methodology = METHODOLOGIES['actionPlans'] ?? METHODOLOGIES['tickets'];
  readonly plans = signal<ActionPlan[]>([]);
  readonly tickets = signal<Ticket[]>([]);
  readonly loading = signal(true);
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
    status: new FormControl<ActionPlanStatus>('pendente', { nonNullable: true }),
  });

  constructor() {
    void this.loadActionPlans();
  }

  async loadActionPlans(): Promise<void> {
    this.loading.set(true);
    try {
      const [plans, tickets] = await Promise.all([
        this.actionPlanService.fetchActionPlans(),
        this.ticketService.fetchTickets(),
      ]);
      this.plans.set(plans);
      this.tickets.set(tickets);
    } finally {
      this.loading.set(false);
    }
  }

  byStatus(status: ActionPlanStatus): ActionPlan[] {
    return this.plans().filter((plan) => plan.status === status);
  }

  ticketName(ticketId: string): string {
    return this.tickets().find((ticket) => ticket.id === ticketId)?.title ?? '—';
  }

  openCreateActionPlan(): void {
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
      status: 'pendente',
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
    const value = this.form.getRawValue();

    const payload = toActionPlanPayload(value);
    const current = this.editing();
    const saved = current
      ? await this.actionPlanService.updateActionPlan(current.id, payload)
      : await this.actionPlanService.createActionPlan(payload);
    this.plans.update((items) =>
      current ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
    );
    this.toast.success(current ? 'Plano atualizado' : 'Plano criado');
    this.formOpen.set(false);
  }

  async advanceActionPlan(plan: ActionPlan): Promise<void> {
    const saved = await this.actionPlanService.advance(plan);
    this.plans.update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
    this.toast.success('Status atualizado');
  }

  async deleteActionPlan(plan: ActionPlan): Promise<void> {
    if (!confirm('Excluir este plano de ação?')) return;
    await this.actionPlanService.deleteActionPlan(plan.id);
    this.plans.update((items) => items.filter((item) => item.id !== plan.id));
    this.toast.success('Plano excluído');
  }
}
