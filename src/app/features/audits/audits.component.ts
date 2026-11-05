import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import type { Process } from '@core/models/database';
import { errorMessage } from '@shared/utils/error.utils';
import { AuditRepository } from './audit.repository';
import type {
  Audit,
  AuditItem,
  AuditKind,
  AuditResult,
  AuditRiskImpact,
  AuditTemplate,
} from './audit.models';

const KIND_LABELS: Record<AuditKind, string> = {
  risk: 'Riscos',
  indicator: 'Indicadores',
  document: 'Documentos',
  custom: 'Avulsa',
};

@Component({
  selector: 'app-audits',
  imports: [FormsModule, RouterLink, DatePipe],
  host: { class: 'ui-standard-fields' },
  templateUrl: './audits.component.html',
})
export class AuditsComponent {
  private readonly repository = inject(AuditRepository);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  readonly management = this.route.snapshot.routeConfig?.path === 'auditorias/gerenciamento';
  readonly focusedRiskId = this.route.snapshot.queryParamMap.get('risk');
  readonly kinds = Object.entries(KIND_LABELS) as [AuditKind, string][];
  readonly templates = signal<AuditTemplate[]>([]);
  readonly audits = signal<Audit[]>([]);
  readonly items = signal<AuditItem[]>([]);
  readonly impacts = signal<AuditRiskImpact[]>([]);
  readonly processes = signal<Process[]>([]);
  readonly selectedId = signal(this.route.snapshot.queryParamMap.get('id') ?? '');
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly dirtyIds = signal<string[]>([]);
  readonly selected = computed(
    () => this.audits().find((audit) => audit.id === this.selectedId()) ?? null,
  );
  readonly visibleAudits = computed(() =>
    this.focusedRiskId
      ? this.audits().filter((audit) =>
          this.items().some(
            (item) => item.audit_id === audit.id && item.risk_id === this.focusedRiskId,
          ),
        )
      : this.audits(),
  );
  readonly selectedItems = computed(() =>
    this.items().filter((item) => item.audit_id === this.selectedId()),
  );
  readonly selectedImpacts = computed(() =>
    this.impacts().filter((impact) => impact.audit_id === this.selectedId()),
  );
  readonly pending = computed(
    () => this.selectedItems().filter((item) => item.result === 'pending').length,
  );
  readonly selectedTotals = computed(() => ({
    conform: this.selectedItems().filter((item) => item.result === 'conform').length,
    partial: this.selectedItems().filter((item) => item.result === 'partial').length,
    nonconform: this.selectedItems().filter((item) => item.result === 'nonconform').length,
  }));
  readonly totals = computed(() => {
    const items = this.items();
    const completed = this.audits().filter((audit) => audit.status === 'completed');
    return {
      completed: completed.length,
      open: this.audits().length - completed.length,
      conform: items.filter((item) => item.result === 'conform').length,
      partial: items.filter((item) => item.result === 'partial').length,
      nonconform: items.filter((item) => item.result === 'nonconform').length,
    };
  });
  templateKind: AuditKind = 'risk';
  templateTitle = '';
  templateChecks = '';
  templateAuto = true;
  draft: { kind: AuditKind; title: string; processId: string; checks: string; autoApply: boolean } =
    {
      kind: 'risk',
      title: '',
      processId: '',
      checks: '',
      autoApply: true,
    };
  summary = '';

  constructor() {
    void this.load();
  }

  kindLabel(kind: AuditKind): string {
    return KIND_LABELS[kind];
  }

  resultLabel(result: AuditResult): string {
    return {
      pending: 'Pendente',
      conform: 'Conforme',
      partial: 'Parcialmente conforme',
      nonconform: 'Não conforme',
    }[result];
  }

  subjectName(riskId: string): string {
    return this.items().find((item) => item.risk_id === riskId)?.subject_label ?? 'Risco';
  }

  processName(id: string | null): string {
    return this.processes().find((process) => process.id === id)?.title ?? 'Sem processo';
  }

  subjectRoute(item: AuditItem): string | null {
    if (item.risk_id && this.auth.hasModuleAccess('risks')) return '/riscos/painel';
    if (item.indicator_id && this.auth.hasModuleAccess('indicators')) return '/indicadores/painel';
    if (item.document_id && this.auth.hasModuleAccess('documents')) return '/documentos/painel';
    return null;
  }

  splitChecks(value: string): string[] {
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [templates, audits, items, impacts, processes] = await Promise.all([
        this.repository.listTemplates(),
        this.repository.listAudits(),
        this.repository.listItems(),
        this.repository.listImpacts(),
        this.repository.listProcesses(),
      ]);
      this.templates.set(templates);
      this.audits.set(audits);
      this.items.set(items);
      this.impacts.set(impacts);
      this.processes.set(processes);
      if (!this.selectedId() && this.visibleAudits().length)
        this.selectedId.set(this.visibleAudits()[0].id);
      this.useTemplate();
      this.dirtyIds.set([]);
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível carregar as auditorias.'));
    } finally {
      this.loading.set(false);
    }
  }

  select(id: string): void {
    this.selectedId.set(id);
    this.summary = this.selected()?.summary ?? '';
    this.dirtyIds.set([]);
    this.error.set('');
  }

  useTemplate(): void {
    const template = this.templates().find((item) => item.kind === this.templateKind);
    if (!template) return;
    this.templateTitle = template.title;
    this.templateChecks = template.checks.join('\n');
    this.templateAuto = template.auto_apply_risk;
  }

  useDraftTemplate(): void {
    const template = this.templates().find((item) => item.kind === this.draft.kind);
    if (!template) return;
    this.draft.title = template.title;
    this.draft.checks = template.checks.join('\n');
    this.draft.autoApply = template.auto_apply_risk;
    if (this.draft.kind === 'custom') this.draft.processId = '';
  }

  markDirty(id: string): void {
    if (!this.dirtyIds().includes(id)) this.dirtyIds.update((ids) => [...ids, id]);
  }

  async saveTemplate(): Promise<void> {
    const template = this.templates().find((item) => item.kind === this.templateKind);
    if (!template) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const saved = await this.repository.saveTemplate(
        { ...template, title: this.templateTitle, auto_apply_risk: this.templateAuto },
        this.splitChecks(this.templateChecks),
      );
      this.templates.update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
      this.notice.set('Estrutura padrão salva para novas auditorias.');
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível salvar a estrutura.'));
    } finally {
      this.busy.set(false);
    }
  }

  async create(): Promise<void> {
    if (
      this.draft.title.trim().length < 3 ||
      (this.draft.kind !== 'custom' && !this.draft.processId)
    ) {
      this.error.set('Informe o título e o processo a auditar.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const audit = await this.repository.create(
        this.draft.kind,
        this.draft.title.trim(),
        this.draft.processId || null,
        this.splitChecks(this.draft.checks),
        this.draft.kind === 'risk' && this.draft.autoApply,
      );
      await this.load();
      this.select(audit.id);
      this.notice.set('Auditoria criada. Avalie cada item antes de concluir.');
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível criar a auditoria.'));
    } finally {
      this.busy.set(false);
    }
  }

  async saveItem(item: AuditItem): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const saved = await this.repository.saveItem(item);
      this.items.update((items) =>
        items.map((current) => (current.id === saved.id ? saved : current)),
      );
      this.dirtyIds.update((ids) => ids.filter((id) => id !== item.id));
      this.notice.set('Avaliação salva.');
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível salvar a avaliação.'));
    } finally {
      this.busy.set(false);
    }
  }

  async complete(): Promise<void> {
    const selected = this.selected();
    if (!selected || this.pending() || this.dirtyIds().length) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.repository.complete(selected.id, this.summary);
      await this.load();
      this.select(selected.id);
      this.notice.set(
        'Auditoria concluída. Os impactos nos riscos foram registrados no histórico.',
      );
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível concluir a auditoria.'));
    } finally {
      this.busy.set(false);
    }
  }
}
