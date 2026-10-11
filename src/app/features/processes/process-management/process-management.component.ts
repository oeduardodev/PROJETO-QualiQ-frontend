import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { errorMessage } from '@shared/utils/error.utils';
import { toProcessPayload } from '../data-access/process.mapper';
import {
  normalizeProcessTag,
  PROCESS_TAG_INPUT_PATTERN,
  processTag,
  processTagSuggestions,
} from '../data-access/process-code.utils';
import { ProcessService } from '@features/processes/data-access/process.service';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import type { Process, ValueChainCategory } from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { ToastService } from '@shared/services/toast.service';

@Component({
  selector: 'app-process-management',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective, ModalComponent],
  templateUrl: './process-management.component.html',
  styleUrl: './process-management.component.scss',
})
export class ProcessManagementComponent {
  private readonly processService = inject(ProcessService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly processes = signal<Process[]>([]);
  readonly categories = signal<ValueChainCategory[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<Process | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly search = new FormControl('', { nonNullable: true });
  readonly categoryFilter = new FormControl('all', { nonNullable: true });
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    tag: new FormControl('', {
      nonNullable: true,
      validators: Validators.pattern(PROCESS_TAG_INPUT_PATTERN),
    }),
    category_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    owner: new FormControl('', { nonNullable: true }),
    impact_score: new FormControl(5, { nonNullable: true }),
    complexity_score: new FormControl(5, { nonNullable: true }),
    maturity_level: new FormControl(1, { nonNullable: true }),
  });
  readonly canManage = computed(() => this.auth.isAdmin() || this.auth.isGestor());
  readonly filtered = signal<Process[]>([]);
  readonly tagSuggestions = computed(() => processTagSuggestions(this.processes()));

  constructor() {
    void this.loadProcesses();
    this.form.controls.tag.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const normalized = normalizeProcessTag(value) ?? '';
      if (value !== normalized) this.form.controls.tag.setValue(normalized, { emitEvent: false });
    });
    this.search.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.filterProcesses());
    this.categoryFilter.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.filterProcesses());
  }

  private filterProcesses(): void {
    const term = this.search.value.toLowerCase();
    const category = this.categoryFilter.value;
    this.filtered.set(
      this.processes().filter(
        (process) =>
          (category === 'all' || process.category_id === category) &&
          (!term ||
            process.title.toLowerCase().includes(term) ||
            (process.code ?? '').toLowerCase().includes(term)),
      ),
    );
  }

  async loadProcesses(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [processes, categories] = await Promise.all([
        this.processService.fetchProcesses(),
        this.processService.fetchCategories(),
      ]);
      this.processes.set(processes);
      this.filterProcesses();
      this.categories.set(categories);
    } catch (e) {
      this.error.set(errorMessage(e, 'Erro ao carregar processos'));
    } finally {
      this.loading.set(false);
    }
  }

  openCreateProcess(): void {
    this.editing.set(null);
    this.form.reset({
      title: '',
      tag: '',
      category_id: '',
      owner: '',
      impact_score: 5,
      complexity_score: 5,
      maturity_level: 1,
    });
    this.formError.set(null);
    this.formOpen.set(true);
  }

  openEditProcess(process: Process): void {
    this.editing.set(process);
    this.form.reset({
      title: process.title,
      tag: processTag(process.code),
      category_id: process.category_id,
      owner: process.owner ?? '',
      impact_score: process.impact_score,
      complexity_score: process.complexity_score,
      maturity_level: process.maturity_level,
    });
    this.formError.set(null);
    this.formOpen.set(true);
  }

  async saveProcess(): Promise<void> {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.formError.set('Informe título e categoria. A tag deve ter exatamente 3 letras.');
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    try {
      const value = this.form.getRawValue();
      const current = this.editing();
      const payload = toProcessPayload(value, current);
      const saved = current
        ? await this.processService.updateProcess(current.id, payload)
        : await this.processService.createProcess(payload);
      this.processes.update((items) =>
        current ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
      );
      this.filterProcesses();
      this.toast.success(current ? 'Processo atualizado' : 'Processo criado');
      this.formOpen.set(false);
    } catch (e) {
      this.formError.set(errorMessage(e, 'Erro ao salvar processo'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteProcess(process: Process): Promise<void> {
    if (
      !confirm(
        'Excluir este processo? Todos os itens SIPOC, riscos e indicadores vinculados serão removidos.',
      )
    )
      return;
    try {
      await this.processService.deleteProcess(process.id);
      this.processes.update((items) => items.filter((item) => item.id !== process.id));
      this.filterProcesses();
      this.toast.success('Processo excluído');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao excluir'));
    }
  }

  categoryName(id: string): string {
    return this.categories().find((item) => item.id === id)?.name ?? '—';
  }

  categoryColor(id: string): string {
    const key = this.categories().find((item) => item.id === id)?.color_key;
    if (key && /^#[0-9a-fA-F]{6}$/.test(key)) return key;
    return (
      (
        {
          blue: '#3b82f6',
          green: '#10b981',
          orange: '#f97316',
          amber: '#f59e0b',
          rose: '#f43f5e',
          violet: '#8b5cf6',
        } as Record<string, string>
      )[key ?? 'blue'] ?? '#3b82f6'
    );
  }
}
