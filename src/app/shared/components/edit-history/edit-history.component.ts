import { DatePipe } from '@angular/common';
import { Component, inject, input, OnChanges, output, signal } from '@angular/core';
import type { EditHistory } from '@core/models/database';
import { SideDrawerComponent } from '@shared/components/side-drawer/side-drawer.component';
import { ProfileService } from '@core/services/profile.service';
import { EditHistoryService, type AuditedEntity } from '@shared/services/edit-history.service';
import { errorMessage } from '@shared/utils/error.utils';

const FIELD_LABELS: Record<string, string> = {
  name: 'Nome',
  title: 'Título',
  description: 'Descrição',
  objective: 'Objetivo',
  code: 'Código',
  color_key: 'Cor',
  classification_key: 'Classificação',
  classification_id: 'Classificação',
  form_schema: 'Questionário',
  sla_hours: 'Prazo',
  analysis_tool: 'Análise de causa',
  requires_root_cause: 'Exigir análise de causa',
  active: 'Ativo',
  risk_id: 'Risco',
  sla_id: 'SLA',
  category: 'Categoria',
  status: 'Status',
  priority: 'Prioridade',
  requester_name: 'Solicitante',
  assigned_to: 'Atribuído a',
  process_id: 'Processo',
  custom_fields: 'Atributos',
  node_type: 'Tipo de item',
  hierarchy_level: 'Nível',
  link: 'Vínculo',
};

@Component({
  selector: 'app-edit-history',
  standalone: true,
  imports: [DatePipe, SideDrawerComponent],
  template: `
    <app-side-drawer
      [open]="!!recordId()"
      [title]="'Histórico · ' + title()"
      width="max-w-xl"
      (closed)="closed.emit()"
    >
      @if (loading()) {
        <p class="text-sm text-slate-500">Carregando histórico...</p>
      } @else if (error()) {
        <p class="text-sm text-rose-600" role="alert">{{ error() }}</p>
      } @else {
        <div class="space-y-3">
          @for (entry of entries(); track entry.id) {
            <article class="rounded-lg border border-slate-200 p-4 text-sm">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <strong class="text-slate-700">{{ actionLabel(entry.action) }}</strong>
                <span class="text-xs text-slate-500">{{
                  entry.changed_at | date: 'dd/MM/yyyy HH:mm'
                }}</span>
              </div>
              <p class="mt-1 text-xs text-slate-500">{{ actorName(entry.changed_by) }}</p>
              @if (entry.justification) {
                <p class="mt-2 text-slate-600">Justificativa: {{ entry.justification }}</p>
              }
              @if (changes(entry).length) {
                <dl class="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">
                  @for (change of changes(entry); track change.key) {
                    <div>
                      <dt class="font-medium text-slate-600">{{ change.label }}</dt>
                      <dd class="break-words text-slate-500">
                        {{ valueLabel(change.before) }} → {{ valueLabel(change.after) }}
                      </dd>
                    </div>
                  }
                </dl>
              }
            </article>
          } @empty {
            <p class="text-sm text-slate-500">Nenhuma alteração registrada.</p>
          }
        </div>
      }
    </app-side-drawer>
  `,
})
export class EditHistoryComponent implements OnChanges {
  private readonly service = inject(EditHistoryService);
  private readonly profileService = inject(ProfileService);
  readonly entity = input.required<AuditedEntity>();
  readonly recordId = input<string | null>(null);
  readonly title = input('');
  readonly closed = output<void>();
  readonly entries = signal<EditHistory[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly profileNames = signal<Record<string, string>>({});
  private requestId = 0;

  ngOnChanges(): void {
    const id = this.recordId();
    const request = ++this.requestId;
    this.entries.set([]);
    this.error.set(null);
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    void this.profileService
      .findAll()
      .then((profiles) => {
        if (request === this.requestId)
          this.profileNames.set(
            Object.fromEntries(profiles.map((profile) => [profile.id, profile.name])),
          );
      })
      .catch(() => {
        if (request === this.requestId) this.profileNames.set({});
      });
    void this.service
      .fetch(this.entity(), id)
      .then(
        (entries) => {
          if (request === this.requestId) this.entries.set(entries);
        },
        (error: unknown) => {
          if (request === this.requestId)
            this.error.set(errorMessage(error, 'Erro ao carregar histórico'));
        },
      )
      .finally(() => {
        if (request === this.requestId) this.loading.set(false);
      });
  }

  actionLabel(action: EditHistory['action']): string {
    return (
      {
        baseline: 'Estado inicial',
        created: 'Criado',
        registered: 'Registrado',
        public_registration: 'Registro público',
        updated: 'Alterado',
        forward: 'Encaminhado',
        archive: 'Arquivado',
        submit: 'Enviado para validação',
        accept: 'Aceito',
        return: 'Devolvido',
      }[action] ?? action
    );
  }

  actorName(id: string | null): string {
    return id ? (this.profileNames()[id] ?? 'Usuário') : 'Sistema';
  }

  changes(entry: EditHistory): { key: string; label: string; before: unknown; after: unknown }[] {
    if (!entry.before_data) return [];
    return Object.keys(entry.after_data)
      .filter((key) => !['id', 'created_at', 'updated_at'].includes(key))
      .filter(
        (key) => JSON.stringify(entry.before_data?.[key]) !== JSON.stringify(entry.after_data[key]),
      )
      .map((key) => ({
        key,
        label: FIELD_LABELS[key] ?? key.replaceAll('_', ' '),
        before: entry.before_data?.[key],
        after: entry.after_data[key],
      }));
  }

  valueLabel(value: unknown): string {
    if (value == null || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}
