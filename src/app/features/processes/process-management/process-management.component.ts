import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { errorMessage } from '@shared/utils/error.utils';
import { toProcessPayload } from '../data-access/process.mapper';
import {
  normalizeProcessTag,
  PROCESS_TAG_INPUT_PATTERN,
  processTag,
  processCodeError,
} from '../data-access/process-code.utils';
import { ProcessService } from '@features/processes/data-access/process.service';
import { ProfileRepository } from '@core/data-access/profile.repository';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import type { Process, ProcessHistory, Profile, ValueChainCategory } from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { SideDrawerComponent } from '@shared/components/side-drawer/side-drawer.component';
import { ToastService } from '@shared/services/toast.service';

@Component({
  selector: 'app-process-management',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective, SideDrawerComponent],
  templateUrl: './process-management.component.html',
  styleUrl: './process-management.component.scss',
})
export class ProcessManagementComponent {
  private readonly processService = inject(ProcessService);
  private readonly profilesRepository = inject(ProfileRepository);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly processes = signal<Process[]>([]);
  readonly categories = signal<ValueChainCategory[]>([]);
  readonly users = signal<Profile[]>([]);
  readonly history = signal<ProcessHistory[]>([]);
  readonly historyProcessId = signal<string | null>(null);
  readonly historyLoading = signal(false);
  readonly historyError = signal<string | null>(null);
  private historyRequestId = 0;
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<Process | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly search = new FormControl('', { nonNullable: true });
  readonly categoryFilter = new FormControl('all', { nonNullable: true });
  readonly statusFilter = new FormControl('active', { nonNullable: true });
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    description: new FormControl('', { nonNullable: true, validators: Validators.required }),
    objective: new FormControl('', { nonNullable: true, validators: Validators.required }),
    tag: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(PROCESS_TAG_INPUT_PATTERN)],
    }),
    category_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    owner: new FormControl('', { nonNullable: true }),
    owner_id: new FormControl('', { nonNullable: true }),
    participant_ids: new FormControl<string[]>([], { nonNullable: true }),
    obsolete: new FormControl(false, { nonNullable: true }),
    justification: new FormControl('', { nonNullable: true }),
    impact_score: new FormControl(5, { nonNullable: true }),
    complexity_score: new FormControl(5, { nonNullable: true }),
    maturity_level: new FormControl(1, { nonNullable: true }),
  });
  readonly canManage = computed(() => this.auth.isAdmin());
  readonly filtered = signal<Process[]>([]);

  constructor() {
    if (this.canManage()) void this.loadProcesses();
    this.form.controls.tag.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const normalized = normalizeProcessTag(value) ?? '';
      if (value !== normalized) this.form.controls.tag.setValue(normalized, { emitEvent: false });
    });
    this.search.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.filterProcesses());
    this.categoryFilter.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.filterProcesses());
    this.statusFilter.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.filterProcesses());
  }

  private filterProcesses(): void {
    const term = this.search.value.toLowerCase();
    const category = this.categoryFilter.value;
    const status = this.statusFilter.value;
    this.filtered.set(
      this.processes().filter(
        (process) =>
          (category === 'all' || process.category_id === category) &&
          (status === 'all' || (status === 'obsolete') === process.obsolete) &&
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
      const [processes, categories, users] = await Promise.all([
        this.processService.fetchProcesses(),
        this.processService.fetchCategories(),
        this.profilesRepository.findAssignableUsers(),
      ]);
      this.processes.set(processes);
      this.filterProcesses();
      this.categories.set(categories);
      this.users.set(users);
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
      description: '',
      objective: '',
      tag: '',
      category_id: '',
      owner: '',
      owner_id: '',
      participant_ids: [],
      obsolete: false,
      justification: '',
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
      description: process.description ?? '',
      objective: process.objective ?? '',
      tag: processTag(process.code),
      category_id: process.category_id,
      owner: process.owner ?? '',
      owner_id: process.owner_id ?? '',
      participant_ids: process.participant_ids ?? [],
      obsolete: process.obsolete ?? false,
      justification: '',
      impact_score: process.impact_score,
      complexity_score: process.complexity_score,
      maturity_level: process.maturity_level,
    });
    this.formError.set(null);
    this.formOpen.set(true);
  }

  async saveProcess(): Promise<void> {
    if (!this.canManage()) return;
    if (this.saving()) return;
    if (this.form.invalid) {
      this.formError.set(
        'Informe título, descrição, missão/objetivo e categoria. A sigla deve ter 3 letras.',
      );
      return;
    }
    if (
      !this.form.controls.description.value.trim() ||
      !this.form.controls.objective.value.trim()
    ) {
      this.formError.set('Informe a descrição e a missão/objetivo do processo.');
      return;
    }
    if (this.editing() && !this.form.controls.justification.value.trim()) {
      this.formError.set('Informe a justificativa da alteração.');
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    try {
      const value = this.form.getRawValue();
      const current = this.editing();
      const payload = toProcessPayload(value);
      const owner = this.users().find((user) => user.id === value.owner_id);
      payload.owner = owner?.name ?? (current?.owner_id ? null : (current?.owner ?? null));
      if (
        this.processes().some(
          (process) => process.id !== current?.id && processTag(process.code) === payload.code,
        )
      ) {
        this.formError.set('Esta sigla já está em uso por outro processo.');
        return;
      }
      const saved = current
        ? await this.processService.updateProcess(current.id, payload, value.justification.trim())
        : await this.processService.createProcess(payload);
      this.processes.update((items) =>
        current ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
      );
      this.filterProcesses();
      if (this.historyProcessId() === saved.id) void this.loadHistory(saved.id);
      this.toast.success(current ? 'Processo atualizado' : 'Processo criado');
      this.formOpen.set(false);
    } catch (e) {
      this.formError.set(processCodeError(e) ?? errorMessage(e, 'Erro ao salvar processo'));
    } finally {
      this.saving.set(false);
    }
  }

  async setObsolete(process: Process, obsolete: boolean): Promise<void> {
    if (!this.canManage() || this.saving()) return;
    this.saving.set(true);
    try {
      const saved = await this.processService.updateProcess(
        process.id,
        { obsolete },
        obsolete ? 'Processo desativado' : 'Processo reativado',
      );
      this.processes.update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      this.filterProcesses();
      if (this.historyProcessId() === saved.id) void this.loadHistory(saved.id);
      this.toast.success(obsolete ? 'Processo marcado como obsoleto' : 'Processo reativado');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao alterar o processo'));
    } finally {
      this.saving.set(false);
    }
  }

  toggleHistory(process: Process): void {
    if (this.historyProcessId() === process.id) {
      this.historyProcessId.set(null);
      this.historyRequestId++;
      return;
    }
    this.historyProcessId.set(process.id);
    void this.loadHistory(process.id);
  }

  private async loadHistory(processId: string): Promise<void> {
    this.history.set([]);
    this.historyError.set(null);
    this.historyLoading.set(true);
    const requestId = ++this.historyRequestId;
    try {
      const entries = await this.processService.fetchProcessHistory(processId);
      if (requestId === this.historyRequestId) this.history.set(entries);
    } catch (error) {
      if (requestId === this.historyRequestId)
        this.historyError.set(errorMessage(error, 'Erro ao carregar histórico'));
    } finally {
      if (requestId === this.historyRequestId) this.historyLoading.set(false);
    }
  }

  toggleParticipant(id: string): void {
    const control = this.form.controls.participant_ids;
    const ids = new Set(control.value);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    control.setValue([...ids]);
  }

  userName(id: string | null): string {
    return this.users().find((user) => user.id === id)?.name ?? 'Usuário não disponível';
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  historyChanges(entry: ProcessHistory): { label: string; before: string; after: string }[] {
    if (!entry.before_data) return [];
    const labels: Record<string, string> = {
      title: 'Nome',
      code: 'Sigla',
      category_id: 'Classificação',
      description: 'Descrição',
      objective: 'Missão/objetivo',
      owner_id: 'Responsável',
      owner: 'Responsável (legado)',
      participant_ids: 'Participantes',
      obsolete: 'Obsoleto',
      impact_score: 'Impacto',
      complexity_score: 'Complexidade',
      maturity_level: 'Maturidade',
      order_index: 'Ordem na matriz',
      custom_fields: 'Campos adicionais',
    };
    return Object.entries(labels)
      .filter(
        ([key]) =>
          !(key === 'owner' && entry.before_data?.['owner_id'] !== entry.after_data['owner_id']) &&
          JSON.stringify(entry.before_data?.[key]) !== JSON.stringify(entry.after_data[key]),
      )
      .map(([key, label]) => ({
        label,
        before: this.historyValue(key, entry.before_data?.[key]),
        after: this.historyValue(key, entry.after_data[key]),
      }));
  }

  private historyValue(key: string, value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (key === 'category_id') return this.categoryName(String(value));
    if (key === 'owner_id') return this.userName(String(value));
    if (key === 'participant_ids' && Array.isArray(value))
      return value.length ? value.map((id) => this.userName(String(id))).join(', ') : '—';
    if (key === 'obsolete') return value ? 'Sim' : 'Não';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
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
