import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { errorMessage } from '@shared/utils/error.utils';
import { toHelpdeskTicketPayload } from './data-access/helpdesk-ticket.mapper';
import { HelpdeskService } from '@features/helpdesk/data-access/helpdesk.service';
import { ProcessService } from '@features/processes/data-access/process.service';
import { AuthService } from '@core/services/auth.service';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
  HelpdeskCategory,
  HelpdeskCategoryOption,
  HelpdeskPriority,
  HelpdeskPriorityOption,
  HelpdeskStatus,
  HelpdeskStatusOption,
  HelpdeskTicket,
  Process,
} from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { SideDrawerComponent } from '@shared/components/side-drawer/side-drawer.component';
import { ToastService } from '@shared/services/toast.service';
import { METHODOLOGIES } from '@shared/data/methodologies';

@Component({
  selector: 'app-helpdesk',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective, SideDrawerComponent, MethodologyComponent],
  templateUrl: './helpdesk.component.html',
  styleUrl: './helpdesk.component.scss',
  host: { class: 'ui-standard-fields' },
})
export class HelpdeskComponent {
  private readonly helpdeskService = inject(HelpdeskService);
  private readonly processService = inject(ProcessService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly methodology = METHODOLOGIES['helpdesk'];
  readonly columns = signal<HelpdeskStatusOption[]>([]);
  readonly activeStatuses = computed(() => this.columns().filter((option) => option.is_active));
  readonly formStatuses = computed(() =>
    this.columns().filter((option) => option.is_active || option.key === this.editing()?.status),
  );
  readonly tickets = signal<HelpdeskTicket[]>([]);
  readonly categories = signal<HelpdeskCategoryOption[]>([]);
  readonly priorities = signal<HelpdeskPriorityOption[]>([]);
  readonly activeCategories = computed(() =>
    this.categories().filter((option) => option.is_active),
  );
  readonly activePriorities = computed(() =>
    this.priorities().filter((option) => option.is_active),
  );
  readonly formCategories = computed(() =>
    this.categories().filter(
      (option) => option.is_active || option.key === this.editing()?.category,
    ),
  );
  readonly formPriorities = computed(() =>
    this.priorities().filter(
      (option) => option.is_active || option.key === this.editing()?.priority,
    ),
  );
  readonly processes = signal<Process[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<HelpdeskTicket | null>(null);
  readonly readOnly = signal(false);
  readonly saving = signal(false);
  readonly methodologyOpen = signal(false);
  readonly searchValue = signal('');
  readonly categoryValue = signal('all');
  readonly search = new FormControl('', { nonNullable: true });
  readonly categoryFilter = new FormControl('all', { nonNullable: true });
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    description: new FormControl('', { nonNullable: true }),
    category: new FormControl<HelpdeskCategory>('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    status: new FormControl<HelpdeskStatus>('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    priority: new FormControl<HelpdeskPriority>('', {
      nonNullable: true,
      validators: Validators.required,
    }),
    requester_name: new FormControl('', { nonNullable: true }),
    assigned_to: new FormControl('', { nonNullable: true }),
    process_id: new FormControl('', { nonNullable: true }),
  });
  readonly filtered = computed(() =>
    this.tickets().filter(
      (ticket) =>
        (this.categoryValue() === 'all' || ticket.category === this.categoryValue()) &&
        (!this.searchValue() ||
          ticket.title.toLowerCase().includes(this.searchValue().toLowerCase())),
    ),
  );

  constructor() {
    this.search.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.searchValue.set(value));
    this.categoryFilter.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.categoryValue.set(value));
    void this.loadTickets();
  }

  async loadTickets(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [tickets, processes, categories, priorities, statuses] = await Promise.all([
        this.helpdeskService.fetchHelpdeskTickets(),
        this.processService.fetchProcesses(),
        this.helpdeskService.fetchCategories(),
        this.helpdeskService.fetchPriorities(),
        this.helpdeskService.fetchStatuses(),
      ]);
      this.tickets.set(tickets);
      this.processes.set(processes);
      this.categories.set(categories);
      this.priorities.set(priorities);
      this.columns.set(statuses);
    } catch (e) {
      this.error.set(errorMessage(e, 'Erro ao carregar helpdesk'));
    } finally {
      this.loading.set(false);
    }
  }

  ticketsByStatus(status: HelpdeskStatus): HelpdeskTicket[] {
    return this.filtered().filter((ticket) => ticket.status === status);
  }

  canAdvance(status: HelpdeskStatus): boolean {
    const next = this.columns().find((option) => option.key === status)?.next_status_key;
    return !!next && this.activeStatuses().some((option) => option.key === next);
  }

  openCreateTicket(): void {
    if (
      !this.activeCategories().length ||
      !this.activePriorities().length ||
      !this.activeStatuses().length
    )
      return;
    this.editing.set(null);
    this.readOnly.set(false);
    this.form.enable();
    this.form.reset({
      title: '',
      description: '',
      category: this.defaultCategory(),
      status: this.defaultStatus(),
      priority: this.defaultPriority(),
      requester_name: '',
      assigned_to: '',
      process_id: '',
    });
    this.formOpen.set(true);
  }

  openEditTicket(ticket: HelpdeskTicket): void {
    this.editing.set(ticket);
    this.readOnly.set(!this.canManage(ticket));
    this.form.reset({
      title: ticket.title,
      description: ticket.description ?? '',
      category: ticket.category,
      status: ticket.status,
      priority: ticket.priority,
      requester_name: ticket.requester_name ?? '',
      assigned_to: ticket.assigned_to ?? '',
      process_id: ticket.process_id ?? '',
    });
    if (this.readOnly()) this.form.disable();
    else this.form.enable();
    this.formOpen.set(true);
  }

  async saveTicket(): Promise<void> {
    if (this.readOnly() || this.form.invalid) return;
    this.saving.set(true);
    try {
      const value = this.form.getRawValue();
      const payload = toHelpdeskTicketPayload(value);
      const current = this.editing();
      const saved = current
        ? await this.helpdeskService.updateHelpdeskTicket(current.id, payload)
        : await this.helpdeskService.createHelpdeskTicket(payload);
      this.tickets.update((items) =>
        current ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
      );
      this.toast.success(current ? 'Chamado atualizado' : 'Chamado criado');
      this.formOpen.set(false);
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao salvar chamado'));
    } finally {
      this.saving.set(false);
    }
  }

  async advanceTicket(ticket: HelpdeskTicket): Promise<void> {
    if (!this.canManage(ticket)) return;
    try {
      const saved = await this.helpdeskService.advance(ticket);
      this.tickets.update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      this.toast.success('Status atualizado');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao atualizar status'));
    }
  }

  async deleteTicket(ticket: HelpdeskTicket): Promise<void> {
    if (!this.canManage(ticket)) return;
    if (!confirm('Excluir este chamado?')) return;
    try {
      await this.helpdeskService.deleteHelpdeskTicket(ticket.id);
      this.tickets.update((items) => items.filter((item) => item.id !== ticket.id));
      this.toast.success('Chamado excluído');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao excluir chamado'));
    }
  }

  canManage(ticket: HelpdeskTicket): boolean {
    return (
      this.auth.isAdmin() || this.auth.isGestor() || ticket.created_by === this.auth.user()?.id
    );
  }

  categoryLabel(value: HelpdeskCategory): string {
    return this.categories().find((option) => option.key === value)?.label ?? value;
  }

  priorityLabel(value: HelpdeskPriority): string {
    return this.priorities().find((option) => option.key === value)?.label ?? value;
  }

  priorityBackground(value: HelpdeskPriority): string {
    return this.priorities().find((option) => option.key === value)?.badge_background ?? '#f1f5f9';
  }

  priorityForeground(value: HelpdeskPriority): string {
    return this.priorities().find((option) => option.key === value)?.badge_foreground ?? '#475569';
  }

  private defaultCategory(): HelpdeskCategory {
    return (
      this.activeCategories().find((option) => option.is_default)?.key ??
      this.activeCategories()[0]?.key ??
      ''
    );
  }

  private defaultPriority(): HelpdeskPriority {
    return (
      this.activePriorities().find((option) => option.is_default)?.key ??
      this.activePriorities()[0]?.key ??
      ''
    );
  }

  private defaultStatus(): HelpdeskStatus {
    return (
      this.activeStatuses().find((option) => option.is_initial)?.key ??
      this.activeStatuses()[0]?.key ??
      ''
    );
  }
}
