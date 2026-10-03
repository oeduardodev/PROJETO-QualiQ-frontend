import { toSwotAnalysisPayload, toSwotItemPayload } from '../data-access/swot.mapper';
import type { SwotItemInput } from '@features/strategy/data-access/swot.repository';
import { QUADRANTS, STATUSES, STRATEGIES } from './swot.constants';
import {
  swotCsv,
  swotFileName,
  swotItemsByQuadrant,
  swotItemsByStrategy,
  swotStatusClass,
  swotStatusLabel,
  swotStrategies,
} from './swot.utils';
import { errorMessage } from '@shared/utils/error.utils';
import { SwotService } from '@features/strategy/data-access/swot.service';
import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import type { SwotAnalysis, SwotItem, SwotQuadrant, SwotStatus } from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { MethodologyComponent } from '@shared/components/methodology/methodology.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { ToastService } from '@shared/services/toast.service';
import { METHODOLOGIES } from '@shared/data/methodologies';

@Component({
  selector: 'app-swot',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, IconDirective, MethodologyComponent, ModalComponent],
  templateUrl: './swot.component.html',
  styleUrl: './swot.component.scss',
  host: { class: 'ui-standard-fields swot-page' },
})
export class SwotComponent {
  private readonly swotService = inject(SwotService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly statuses = STATUSES;
  readonly methodology = METHODOLOGIES['swot'];

  readonly analyses = signal<SwotAnalysis[]>([]);
  readonly allItems = signal<SwotItem[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly methodologyOpen = signal(false);
  readonly analysisFormOpen = signal(false);
  readonly editingAnalysis = signal<SwotAnalysis | null>(null);
  readonly itemFormOpen = signal(false);
  readonly editingItem = signal<SwotItem | null>(null);

  readonly analysisForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    period: new FormControl('', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true }),
    status: new FormControl<SwotStatus>('em_construcao', { nonNullable: true }),
  });

  readonly itemForm = new FormGroup({
    quadrant: new FormControl<SwotQuadrant>('forcas', { nonNullable: true }),
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    description: new FormControl('', { nonNullable: true }),
  });

  readonly canEdit = computed(() => this.auth.isAdmin() || this.auth.isGestor());
  readonly ordered = computed(() =>
    [...this.analyses()].sort((a, b) => a.order_index - b.order_index),
  );
  readonly selected = computed(
    () => this.analyses().find((analysis) => analysis.id === this.selectedId()) ?? null,
  );
  readonly itemsByAnalysis = computed(() => {
    const map: Record<string, SwotItem[]> = {};
    for (const item of this.allItems()) {
      (map[item.analysis_id] ??= []).push(item);
    }
    return map;
  });
  readonly items = computed(() => {
    const analysis = this.selected();
    return analysis ? (this.itemsByAnalysis()[analysis.id] ?? []) : [];
  });
  readonly panels = computed(() =>
    QUADRANTS.map((quadrant) => ({
      ...quadrant,
      items: swotItemsByQuadrant(this.items(), quadrant.key),
    })),
  );
  readonly crossings = computed(() =>
    STRATEGIES.map((strategy) => ({
      ...strategy,
      items: swotItemsByStrategy(this.items(), strategy.key),
    })),
  );
  readonly totalItems = computed(() => this.items().length);
  readonly filledQuadrants = computed(
    () => this.panels().filter((panel) => panel.items.length).length,
  );

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [analyses, items] = await Promise.all([
        this.swotService.fetchAnalyses(),
        this.swotService.fetchAllItems(),
      ]);
      this.analyses.set(analyses);
      this.allItems.set(items);
      const current = this.selectedId();
      const stillExists = current && analyses.some((analysis) => analysis.id === current);
      this.selectedId.set(stillExists ? current : (analyses[0]?.id ?? null));
    } catch (error) {
      this.error.set(errorMessage(error, 'Erro ao carregar a análise SWOT'));
    } finally {
      this.loading.set(false);
    }
  }

  countFor(analysisId: string): number {
    return (this.itemsByAnalysis()[analysisId] ?? []).length;
  }

  strategiesOf(item: SwotItem): string[] {
    return swotStrategies(item.quadrant);
  }

  placeholderFor(quadrant: SwotQuadrant): string {
    return QUADRANTS.find((entry) => entry.key === quadrant)?.placeholder ?? '';
  }

  statusLabel = swotStatusLabel;
  statusClass = swotStatusClass;

  tabClass(active: boolean): string {
    return active
      ? 'border-slate-400 bg-white ring-2 ring-slate-800'
      : 'border-slate-200 bg-white hover:border-slate-300';
  }

  openAnalysisCreate(): void {
    this.editingAnalysis.set(null);
    this.analysisForm.reset({
      title: '',
      period: '',
      description: '',
      status: 'em_construcao',
    });
    this.formError.set(null);
    this.analysisFormOpen.set(true);
  }

  openAnalysisEdit(analysis: SwotAnalysis): void {
    this.editingAnalysis.set(analysis);
    this.analysisForm.reset({
      title: analysis.title,
      period: analysis.period ?? '',
      description: analysis.description ?? '',
      status: analysis.status,
    });
    this.formError.set(null);
    this.analysisFormOpen.set(true);
  }

  async saveAnalysis(): Promise<void> {
    if (this.analysisForm.invalid) return;
    this.saving.set(true);
    this.formError.set(null);
    const current = this.editingAnalysis();
    const payload = toSwotAnalysisPayload({
      ...this.analysisForm.getRawValue(),
      order_index: current?.order_index ?? this.analyses().length,
    });
    try {
      const saved = current
        ? await this.swotService.updateAnalysis(current.id, payload)
        : await this.swotService.createAnalysis(payload);
      this.analyses.update((items) =>
        current ? items.map((item) => (item.id === saved.id ? saved : item)) : [...items, saved],
      );
      this.selectedId.set(saved.id);
      this.toast.success(current ? 'Análise atualizada' : 'Análise criada');
      this.analysisFormOpen.set(false);
    } catch (error) {
      this.formError.set(errorMessage(error, 'Erro ao salvar a análise'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteAnalysis(analysis: SwotAnalysis): Promise<void> {
    if (!confirm(`Excluir a análise "${analysis.title}" e todos os seus fatores?`)) return;
    await this.swotService.deleteAnalysis(analysis.id);
    this.analyses.update((items) => items.filter((item) => item.id !== analysis.id));
    this.allItems.update((items) => items.filter((item) => item.analysis_id !== analysis.id));
    if (this.selectedId() === analysis.id) {
      this.selectedId.set(this.ordered()[0]?.id ?? null);
    }
    this.toast.success('Análise excluída');
  }

  openItemCreate(quadrant: SwotQuadrant): void {
    this.editingItem.set(null);
    this.itemForm.reset({ quadrant, title: '', description: '' });
    this.formError.set(null);
    this.itemFormOpen.set(true);
  }

  openItemEdit(item: SwotItem): void {
    this.editingItem.set(item);
    this.itemForm.reset({
      quadrant: item.quadrant,
      title: item.title,
      description: item.description ?? '',
    });
    this.formError.set(null);
    this.itemFormOpen.set(true);
  }

  async saveItem(): Promise<void> {
    const analysis = this.selected();
    if (this.itemForm.invalid || !analysis) return;
    this.saving.set(true);
    this.formError.set(null);
    const value = this.itemForm.getRawValue();
    const current = this.editingItem();
    const payload: SwotItemInput = toSwotItemPayload({
      ...value,
      analysis_id: analysis.id,
      order_index: current?.order_index ?? swotItemsByQuadrant(this.items(), value.quadrant).length,
    });
    try {
      const saved = current
        ? await this.swotService.updateItem(current.id, payload)
        : await this.swotService.createItem(payload);
      this.allItems.update((items) =>
        current ? items.map((item) => (item.id === saved.id ? saved : item)) : [...items, saved],
      );
      this.toast.success(current ? 'Fator atualizado' : 'Fator adicionado');
      this.itemFormOpen.set(false);
    } catch (error) {
      this.formError.set(errorMessage(error, 'Erro ao salvar o fator'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteItem(item: SwotItem): Promise<void> {
    if (!confirm('Remover este fator da SWOT?')) return;
    await this.swotService.deleteItem(item.id);
    this.allItems.update((items) => items.filter((current) => current.id !== item.id));
    this.toast.success('Fator removido');
  }

  print(): void {
    window.print();
  }

  exportCsv(): void {
    const analysis = this.selected();
    if (!analysis) return;
    const blob = new Blob(['\uFEFF' + swotCsv(analysis, this.items())], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = swotFileName(analysis);
    link.click();
    URL.revokeObjectURL(url);
    this.toast.success('SWOT exportada em CSV');
  }
}
