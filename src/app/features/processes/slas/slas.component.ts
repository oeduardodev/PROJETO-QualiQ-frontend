import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { errorMessage } from '@shared/utils/error.utils';
import { toSlaPayload } from '../data-access/sla.mapper';
import { SlaService } from '@features/processes/data-access/sla.service';
import { ProcessService } from '@features/processes/data-access/process.service';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import type { Process, SLA, SipocNode, SlaStatus, SlaStatusOption } from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { ToastService } from '@shared/services/toast.service';

@Component({
  selector: 'app-slas',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective, ModalComponent],
  templateUrl: './slas.component.html',
  styleUrl: './slas.component.scss',
})
export class SlasComponent {
  private readonly slaService = inject(SlaService);
  private readonly processService = inject(ProcessService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly management = this.route.snapshot.data['mode'] === 'management';
  readonly statuses = signal<SlaStatusOption[]>([]);
  readonly activeStatuses = computed(() => this.statuses().filter((option) => option.is_active));
  readonly formStatuses = computed(() =>
    this.statuses().filter((option) => option.is_active || option.key === this.editing()?.status),
  );
  readonly slas = signal<SLA[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly nodes = signal<SipocNode[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<SLA | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly searchValue = signal('');
  readonly statusValue = signal('all');
  readonly search = new FormControl('', { nonNullable: true });
  readonly statusFilter = new FormControl('all', { nonNullable: true });
  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    supplier_process_id: new FormControl('', { nonNullable: true }),
    client_process_id: new FormControl('', { nonNullable: true }),
    sipoc_input_id: new FormControl('', { nonNullable: true }),
    lead_time_hours: new FormControl(0, { nonNullable: true }),
    quality_criteria: new FormControl('', { nonNullable: true }),
    status: new FormControl<SlaStatus>('', { nonNullable: true, validators: Validators.required }),
  });
  readonly canManage = computed(() => this.auth.isAdmin() || this.auth.isGestor());
  readonly inputs = computed(() => this.nodes().filter((node) => node.node_type === 'I'));
  readonly filtered = computed(() =>
    this.slas().filter(
      (sla) =>
        (this.statusValue() === 'all' || sla.status === this.statusValue()) &&
        (!this.searchValue() || sla.title.toLowerCase().includes(this.searchValue().toLowerCase())),
    ),
  );
  readonly summary = computed(() => [
    { label: 'Total de SLAs', value: this.slas().length, icon: 'Gauge', color: '#2563eb' },
    ...this.statuses().map((status) => ({
      label: status.label,
      value: this.slas().filter((sla) => sla.status === status.key).length,
      icon: 'CircleCheck',
      color: status.badge_foreground,
    })),
  ]);

  constructor() {
    this.search.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.searchValue.set(value));
    this.statusFilter.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.statusValue.set(value));
    void this.loadSlas();
  }

  async loadSlas(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [slas, processes, nodes, statuses] = await Promise.all([
        this.slaService.fetchSlas(),
        this.processService.fetchProcesses(),
        this.processService.fetchSipocNodes(),
        this.slaService.fetchStatuses(),
      ]);
      this.slas.set(slas);
      this.processes.set(processes);
      this.nodes.set(nodes);
      this.statuses.set(statuses);
    } catch (e) {
      this.error.set(errorMessage(e, 'Erro ao carregar SLAs'));
    } finally {
      this.loading.set(false);
    }
  }

  openCreateSla(): void {
    if (!this.activeStatuses().length) return;
    this.editing.set(null);
    this.form.reset({
      title: '',
      supplier_process_id: '',
      client_process_id: '',
      sipoc_input_id: '',
      lead_time_hours: 0,
      quality_criteria: '',
      status: this.defaultStatus(),
    });
    this.formOpen.set(true);
  }

  openEditSla(sla: SLA): void {
    this.editing.set(sla);
    this.form.reset({
      title: sla.title,
      supplier_process_id: sla.supplier_process_id ?? '',
      client_process_id: sla.client_process_id ?? '',
      sipoc_input_id: sla.sipoc_input_id ?? '',
      lead_time_hours: sla.lead_time_hours,
      quality_criteria: sla.quality_criteria ?? '',
      status: sla.status,
    });
    this.formOpen.set(true);
  }

  async saveSla(): Promise<void> {
    if (this.form.invalid) {
      this.formError.set('Título é obrigatório.');
      return;
    }
    this.saving.set(true);
    try {
      const value = this.form.getRawValue();
      const payload = toSlaPayload(value);
      const current = this.editing();
      const saved = current
        ? await this.slaService.updateSla(current.id, payload)
        : await this.slaService.createSla(payload);
      this.slas.update((items) =>
        current ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
      );
      this.toast.success(current ? 'SLA atualizado' : 'SLA criado');
      this.formOpen.set(false);
    } catch (e) {
      this.formError.set(errorMessage(e, 'Erro ao salvar SLA'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteSla(sla: SLA): Promise<void> {
    if (!confirm('Excluir este SLA?')) return;
    try {
      await this.slaService.deleteSla(sla.id);
      this.slas.update((items) => items.filter((item) => item.id !== sla.id));
      this.toast.success('SLA excluído');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao excluir'));
    }
  }

  processName(id: string | null): string {
    return this.processes().find((process) => process.id === id)?.title ?? '—';
  }

  statusLabel(status: SlaStatus): string {
    return this.statuses().find((option) => option.key === status)?.label ?? status;
  }

  statusBackground(status: SlaStatus): string {
    return this.statuses().find((option) => option.key === status)?.badge_background ?? '#f1f5f9';
  }

  statusForeground(status: SlaStatus): string {
    return this.statuses().find((option) => option.key === status)?.badge_foreground ?? '#475569';
  }

  private defaultStatus(): SlaStatus {
    return (
      this.activeStatuses().find((option) => option.is_default)?.key ??
      this.activeStatuses()[0]?.key ??
      ''
    );
  }
}
