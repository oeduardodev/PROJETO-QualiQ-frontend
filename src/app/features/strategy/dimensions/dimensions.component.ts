import { toDimensionPayload } from '../data-access/dimension.mapper';
import { errorMessage } from '@shared/utils/error.utils';
import { DimensionService } from '@features/strategy/data-access/dimension.service';
import { ActionPlanService } from '@features/actions/data-access/action-plan.service';
import { IndicatorService } from '@features/indicators/data-access/indicator.service';
import { ProcessService } from '@features/processes/data-access/process.service';
import { TicketService } from '@features/notifications/data-access/ticket.service';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
  ActionPlan,
  Dimension,
  DimensionItemType,
  DimensionLink,
  Indicator,
  Process,
  Ticket,
} from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { ToastService } from '@shared/services/toast.service';
import { METHODOLOGIES } from '@shared/data/methodologies';

@Component({
  selector: 'app-dimensions',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective, ModalComponent, MethodologyComponent],
  templateUrl: './dimensions.component.html',
  styleUrl: './dimensions.component.scss',
})
export class DimensionsComponent {
  private readonly dimensionService = inject(DimensionService);
  private readonly actionPlanService = inject(ActionPlanService);
  private readonly indicatorService = inject(IndicatorService);
  private readonly processService = inject(ProcessService);
  private readonly ticketService = inject(TicketService);
  private readonly toast = inject(ToastService);
  readonly methodology = METHODOLOGIES['dimensoes'];
  readonly dimensions = signal<Dimension[]>([]);
  readonly links = signal<DimensionLink[]>([]);
  readonly indicators = signal<Indicator[]>([]);
  readonly plans = signal<ActionPlan[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly tickets = signal<Ticket[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<Dimension | null>(null);
  readonly linkOpen = signal(false);
  readonly linkDimension = signal<Dimension | null>(null);
  readonly linkType = signal<DimensionItemType>('indicator');
  readonly methodologyOpen = signal(false);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    description: new FormControl('', { nonNullable: true }),
    color_key: new FormControl('blue', { nonNullable: true }),
    order_index: new FormControl(0, { nonNullable: true }),
  });
  readonly ordered = computed(() =>
    [...this.dimensions()].sort((a, b) => a.order_index - b.order_index),
  );
  readonly availableItems = computed(() => {
    const dimension = this.linkDimension();
    if (!dimension) return [];
    const linked = new Set(
      this.links()
        .filter((item) => item.dimension_id === dimension.id && item.item_type === this.linkType())
        .map((item) => item.item_id),
    );
    return (this.linkType() === 'indicator' ? this.indicators() : this.plans()).filter(
      (item) => !linked.has(item.id),
    );
  });

  constructor() {
    void this.loadDimensions();
  }

  async loadDimensions(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [dimensions, indicators, plans, processes, tickets] = await Promise.all([
        this.dimensionService.fetchDimensions(),
        this.indicatorService.fetchIndicators(),
        this.actionPlanService.fetchActionPlans(),
        this.processService.fetchProcesses(),
        this.ticketService.fetchTickets(),
      ]);
      this.dimensions.set(dimensions);
      this.indicators.set(indicators);
      this.plans.set(plans);
      this.processes.set(processes);
      this.tickets.set(tickets);
      const links = await Promise.all(
        dimensions.map((item) => this.dimensionService.fetchDimensionLinks(item.id)),
      );
      this.links.set(links.flat());
    } catch (error) {
      this.error.set(errorMessage(error, 'Erro ao carregar dimensões'));
    } finally {
      this.loading.set(false);
    }
  }

  linkedIndicators(id: string): Indicator[] {
    const linked = new Set(
      this.links()
        .filter((item) => item.dimension_id === id && item.item_type === 'indicator')
        .map((item) => item.item_id),
    );
    return this.indicators().filter((item) => linked.has(item.id));
  }

  linkedPlans(id: string): ActionPlan[] {
    const linked = new Set(
      this.links()
        .filter((item) => item.dimension_id === id && item.item_type === 'action_plan')
        .map((item) => item.item_id),
    );
    return this.plans().filter((item) => linked.has(item.id));
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      name: '',
      description: '',
      color_key: 'blue',
      order_index: this.dimensions().length,
    });
    this.formOpen.set(true);
  }

  openEdit(item: Dimension): void {
    this.editing.set(item);
    this.form.reset({
      name: item.name,
      description: item.description ?? '',
      color_key: item.color_key,
      order_index: item.order_index,
    });
    this.formOpen.set(true);
  }

  async saveDimension(): Promise<void> {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const payload = toDimensionPayload(value);
    const current = this.editing();
    const saved = current
      ? await this.dimensionService.updateDimension(current.id, payload)
      : await this.dimensionService.createDimension(payload);
    this.dimensions.update((items) =>
      current ? items.map((item) => (item.id === saved.id ? saved : item)) : [...items, saved],
    );
    this.toast.success('Dimensão salva');
    this.formOpen.set(false);
  }

  async deleteDimension(item: Dimension): Promise<void> {
    if (!confirm('Excluir esta dimensão?')) return;
    await this.dimensionService.deleteDimension(item.id);
    this.dimensions.update((items) => items.filter((current) => current.id !== item.id));
    this.links.update((items) => items.filter((link) => link.dimension_id !== item.id));
    this.toast.success('Dimensão excluída');
  }

  openLink(dimension: Dimension, type: DimensionItemType): void {
    this.linkDimension.set(dimension);
    this.linkType.set(type);
    this.linkOpen.set(true);
  }

  async linkItem(item: Indicator | ActionPlan): Promise<void> {
    const dimension = this.linkDimension();
    if (!dimension) return;
    const processId = this.itemProcessId(item);
    if (!processId) {
      this.toast.error('Não foi possível identificar o processo vinculado.');
      return;
    }
    await this.dimensionService.createDimensionLink({
      dimension_id: dimension.id,
      item_type: this.linkType(),
      item_id: item.id,
      process_id: processId,
    });
    this.links.update((items) => [
      ...items,
      {
        id: `local-${Date.now()}`,
        dimension_id: dimension.id,
        item_type: this.linkType(),
        item_id: item.id,
        process_id: processId,
        created_at: new Date().toISOString(),
      },
    ]);
    this.toast.success('Item vinculado');
  }

  async unlinkItem(dimensionId: string, type: DimensionItemType, itemId: string): Promise<void> {
    await this.dimensionService.deleteDimensionLink(dimensionId, type, itemId);
    this.links.update((items) =>
      items.filter(
        (item) =>
          item.dimension_id !== dimensionId || item.item_type !== type || item.item_id !== itemId,
      ),
    );
    this.toast.success('Vínculo removido');
  }

  processName(id: string): string {
    return this.processes().find((item) => item.id === id)?.title ?? '—';
  }

  colorBg(color: string): string {
    return (
      (
        {
          blue: 'bg-blue-50',
          green: 'bg-emerald-50',
          orange: 'bg-orange-50',
          amber: 'bg-amber-50',
          rose: 'bg-rose-50',
          violet: 'bg-violet-50',
        } as Record<string, string>
      )[color] ?? 'bg-slate-50'
    );
  }

  colorText(color: string): string {
    return this.colorBg(color).replace('bg-', 'text-');
  }

  itemProcessId(item: Indicator | ActionPlan): string | null {
    return 'process_id' in item
      ? item.process_id
      : (this.tickets().find((ticket) => ticket.id === item.ticket_id)?.process_id ?? null);
  }
}
