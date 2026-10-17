import { DocumentViewerComponent } from './document-viewer.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { formatDate } from '@shared/utils/date.utils';
import { errorMessage } from '@shared/utils/error.utils';
import { DOCUMENTS_LOCKED, DOCUMENTS_LOCKED_MESSAGE, WORKFLOW } from './documents.constants';
import { toDocumentPayload } from './data-access/document.mapper';
import { DocumentService } from '@features/documents/data-access/document.service';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type {
  ControlledCopy,
  CopyStatus,
  DocumentStatus,
  DocumentType,
  DocumentTypeHistory,
  DocumentWorkflow,
  DocumentVersion,
  GEDDocument,
} from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { SideDrawerComponent } from '@shared/components/side-drawer/side-drawer.component';
import { ToastService } from '@shared/services/toast.service';
import { DocumentsStore } from './documents.store';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective, SideDrawerComponent, DocumentViewerComponent],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss',
  host: { class: 'ui-standard-fields' },
  providers: [DocumentsStore],
})
export class DocumentsComponent {
  private readonly documentService = inject(DocumentService);
  readonly auth = inject(AuthService);
  readonly store = inject(DocumentsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  readonly mode = this.route.snapshot.data['mode'] as
    'panel' | 'hierarchy' | 'management' | 'copies';
  readonly workflow = WORKFLOW.filter((c) => c.value !== 'obsoleto');
  readonly versions = signal<DocumentVersion[]>([]);
  readonly previewDocument = signal<GEDDocument | null>(null);
  readonly operation = signal<{
    document?: GEDDocument;
    copy?: ControlledCopy;
    action: string;
    title: string;
  } | null>(null);
  readonly reason = new FormControl('', { nonNullable: true, validators: Validators.required });
  readonly copyDue = new FormControl('', { nonNullable: true });
  readonly busy = signal(false);
  readonly showInactive = signal(false);
  readonly copyFilter = signal('');
  readonly filteredCopies = computed(() =>
    this.store
      .copies()
      .filter(
        (c) =>
          (!this.copyFilter() ||
            (this.copyFilter() === 'atrasada'
              ? this.copyOverdue(c)
              : c.status === this.copyFilter())) &&
          [
            this.documentName(c.document_id),
            this.store.profileName(c.user_id),
            this.store.documents().find((d) => d.id === c.document_id)?.code,
          ]
            .join(' ')
            .toLowerCase()
            .includes(this.searchValue().toLowerCase()),
      ),
  );
  readonly overdueCopies = computed(
    () => this.store.copies().filter((c) => this.copyOverdue(c)).length,
  );
  readonly deliveredCopies = computed(
    () => this.store.copies().filter((c) => c.status === 'entregue').length,
  );
  readonly inactiveDocuments = computed(() =>
    this.store.documents().filter((d) => d.status === 'obsoleto'),
  );
  readonly today = new Date().toLocaleDateString('en-CA');
  readonly locked = DOCUMENTS_LOCKED;
  readonly canManageTypes = computed(() => this.auth.isAdmin());
  readonly searchValue = signal('');
  readonly search = new FormControl('', { nonNullable: true });
  readonly documentOpen = signal(false);
  readonly editingDocument = signal<GEDDocument | null>(null);
  readonly workflowDocument = signal<GEDDocument | null>(null);
  readonly workflowEntries = signal<DocumentWorkflow[]>([]);
  readonly workflowLoading = signal(false);
  readonly workflowError = signal<string | null>(null);
  readonly typeOpen = signal(false);
  readonly editingType = signal<DocumentType | null>(null);
  readonly typeSaving = signal(false);
  readonly typeError = signal<string | null>(null);
  readonly levelOpen = signal(false);
  readonly editingLevel = signal<number | null>(null);
  readonly levelError = signal<string | null>(null);
  readonly levelSaving = signal(false);
  readonly levelName = new FormControl('', { nonNullable: true, validators: Validators.required });
  readonly historyType = signal<DocumentType | null>(null);
  readonly typeHistory = signal<DocumentTypeHistory[]>([]);
  readonly typeHistoryLoading = signal(false);
  readonly formError = signal<string | null>(null);
  readonly documentForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    type_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    process_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    step_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    owner_id: new FormControl('', { nonNullable: true, validators: Validators.required }),
    approver_ids: new FormControl<string[]>([], {
      nonNullable: true,
      validators: Validators.required,
    }),
    justification: new FormControl('', { nonNullable: true, validators: Validators.required }),
    drive_link: new FormControl('', { nonNullable: true }),
  });
  readonly typeForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    acronym: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9]{2,8}$/)],
    }),
    hierarchy_level: new FormControl(1, { nonNullable: true }),
    validity_days: new FormControl(365, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    sla_review_days: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    sla_approval_days: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    sla_publication_days: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    print_allowed: new FormControl(false, { nonNullable: true }),
    public_panel: new FormControl(true, { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
    justification: new FormControl('', { nonNullable: true }),
  });
  readonly panelDocuments = computed(() =>
    this.store
      .published()
      .filter(
        (document) =>
          !this.searchValue() ||
          [document.title, document.code, this.store.processName(document.process_id)]
            .join(' ')
            .toLowerCase()
            .includes(this.searchValue().toLowerCase()),
      ),
  );
  readonly publishedProcessCount = computed(
    () =>
      new Set(
        this.store
          .published()
          .map((item) => item.process_id)
          .filter(Boolean),
      ).size,
  );

  get title(): string {
    return {
      panel: 'Documentos Públicos',
      hierarchy: 'Hierarquia e Parametrização',
      management: 'Gerenciamento de Documentos',
      copies: 'Controle de Cópias',
    }[this.mode];
  }

  get subtitle(): string {
    return {
      panel: `${this.store.published().length} documentos disponíveis para consulta`,
      hierarchy: `${this.store.types().length} tipos documentais configurados`,
      management: `${this.store.documents().length} documentos no workflow`,
      copies: `${this.store.copies().length} cópias controladas`,
    }[this.mode];
  }

  constructor() {
    this.search.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.searchValue.set(value));
    void this.store.load();
  }

  private blocked(): boolean {
    if (!this.locked) return false;
    this.toast.error(DOCUMENTS_LOCKED_MESSAGE);
    return true;
  }

  docsByStatus(status: DocumentStatus): GEDDocument[] {
    return this.store.documents().filter((document) => document.status === status);
  }

  typesAt(level: number): DocumentType[] {
    return this.store.types().filter((type) => type.hierarchy_level === level);
  }

  tierWidth(index: number): number {
    const count = this.store.levels().length;
    return count <= 1 ? 100 : 52 + (48 * index) / (count - 1);
  }

  canPrint(document: GEDDocument): boolean {
    return (
      document.print_allowed &&
      !!this.store.types().find((type) => type.id === document.type_id)?.print_allowed
    );
  }

  isExpired(document: GEDDocument): boolean {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return !!document.expires_at && document.expires_at < today;
  }

  formatDateOnly(value: string): string {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  levelLabel(level: number): string {
    return this.store.levels().find((item) => item.level === level)?.name ?? `Nível ${level}`;
  }

  openDocument(document?: GEDDocument): void {
    if (this.blocked()) return;
    if (!this.canEdit(document)) {
      this.preview(document!);
      return;
    }
    this.formError.set(null);
    this.editingDocument.set(document ?? null);
    this.documentForm.reset(
      document
        ? {
            step_id: document.step_id ?? '',
            owner_id: document.owner_id ?? '',
            approver_ids: document.approver_ids ?? [],
            justification: '',
            title: document.title,
            type_id: document.type_id ?? '',
            process_id: document.process_id ?? '',
            drive_link: document.drive_link ?? '',
          }
        : {
            step_id: '',
            owner_id: this.auth.user()?.id ?? '',
            approver_ids: [],
            justification: '',
            title: '',
            type_id: '',
            process_id: '',
            drive_link: '',
          },
    );
    this.documentOpen.set(true);
  }

  async openWorkflow(document: GEDDocument): Promise<void> {
    this.workflowDocument.set(document);
    this.workflowEntries.set([]);
    this.workflowError.set(null);
    this.workflowLoading.set(true);
    try {
      const [entries, versions] = await Promise.all([
        this.documentService.fetchDocumentWorkflows(document.id),
        this.documentService.versions(document.id),
      ]);
      this.versions.set(versions);
      if (this.workflowDocument()?.id === document.id) this.workflowEntries.set(entries);
    } catch (error) {
      this.workflowError.set(errorMessage(error, 'Erro ao carregar histórico do documento'));
    } finally {
      this.workflowLoading.set(false);
    }
  }

  async saveDocument(): Promise<void> {
    if (this.blocked()) return;
    if (this.documentForm.invalid) {
      this.formError.set(
        'Preencha título, tipo, processo, etapa, responsável, aprovadores e justificativa.',
      );
      return;
    }
    try {
      const value = this.documentForm.getRawValue();
      const current = this.editingDocument();
      const saved = await this.documentService.saveDocument(current, toDocumentPayload(value));
      this.store.documents.update((items) =>
        current ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
      );
      this.toast.success(current ? 'Documento atualizado' : 'Documento criado');
      this.documentOpen.set(false);
    } catch (e) {
      this.formError.set(errorMessage(e, 'Erro ao salvar documento'));
    }
  }

  canEdit(document?: GEDDocument): boolean {
    return document
      ? ['rascunho', 'em_revisao'].includes(document.status) &&
          (this.auth.isAdmin() || document.owner_id === this.auth.user()?.id)
      : this.auth.isAdmin();
  }

  steps() {
    return this.store
      .nodes()
      .filter(
        (n) => n.node_type === 'P' && n.process_id === this.documentForm.controls.process_id.value,
      );
  }

  canDecide(document: GEDDocument): boolean {
    return (
      document.status === 'em_validacao' &&
      document.approver_ids.includes(this.auth.user()?.id ?? '')
    );
  }

  begin(document: GEDDocument, action: string, title: string): void {
    this.reason.reset();
    this.formError.set(null);
    this.operation.set({ document, action, title });
  }

  beginCopy(copy: ControlledCopy, status: string): void {
    this.reason.reset();
    this.formError.set(null);
    this.operation.set({ copy, action: status, title: 'Atualizar cópia controlada' });
  }

  async confirmOperation(): Promise<void> {
    const operation = this.operation();
    if (!operation || this.busy() || !this.reason.value.trim()) {
      this.formError.set('Informe a justificativa.');
      return;
    }
    if (
      operation.action === 'request' &&
      (!this.copyDue.value || this.copyDue.value < this.today)
    ) {
      this.formError.set('Informe uma data limite válida.');
      return;
    }
    this.busy.set(true);
    this.formError.set(null);
    try {
      if (operation.copy) {
        const saved = await this.documentService.transitionCopy(
          operation.copy,
          operation.action as CopyStatus,
          this.reason.value,
        );
        this.store.copies.update((items) => items.map((c) => (c.id === saved.id ? saved : c)));
      } else if (operation.document && operation.action === 'request') {
        const saved = await this.documentService.requestControlledCopy(
          operation.document.id,
          this.reason.value,
          this.copyDue.value,
        );
        this.store.copies.update((items) => [saved, ...items]);
      } else if (operation.document) {
        let current = operation.document;
        if (operation.action === 'submit') {
          current = await this.documentService.syncGoogle(current);
          this.store.documents.update((items) =>
            items.map((d) => (d.id === current.id ? current : d)),
          );
        }
        const saved = await this.documentService.transition(
          current,
          operation.action,
          this.reason.value,
        );
        this.store.documents.update((items) => items.map((d) => (d.id === saved.id ? saved : d)));
      }
      this.operation.set(null);
      this.toast.success('Operação registrada com sucesso');
    } catch (error) {
      this.formError.set(errorMessage(error, 'Não foi possível concluir a operação'));
    } finally {
      this.busy.set(false);
    }
  }

  copyOverdue(copy: ControlledCopy): boolean {
    return (
      !!copy.due_date &&
      copy.due_date < this.today &&
      ['aprovada', 'entregue'].includes(copy.status)
    );
  }

  async syncGoogle(document: GEDDocument): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const saved = await this.documentService.syncGoogle(document);
      this.store.documents.update((items) => items.map((d) => (d.id === saved.id ? saved : d)));
      this.toast.success('Conteúdo sincronizado');
    } catch (error) {
      this.toast.error(
        errorMessage(error, 'Configure a integração Google Docs no servidor para sincronizar.'),
      );
    } finally {
      this.busy.set(false);
    }
  }

  async emailCopy(copy: ControlledCopy): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.documentService.emailCopy(copy.id);
      this.toast.success('Cópia enviada por e-mail');
      await this.store.load(true);
    } catch (error) {
      this.toast.error(errorMessage(error, 'Não foi possível enviar o e-mail'));
    } finally {
      this.busy.set(false);
    }
  }

  openType(type?: DocumentType): void {
    if (!this.canManageTypes()) return;
    this.editingType.set(type ?? null);
    this.typeError.set(null);
    this.typeForm.reset(
      type
        ? {
            name: type.name,
            acronym: type.acronym,
            hierarchy_level: type.hierarchy_level,
            validity_days: type.validity_days,
            sla_review_days: type.sla_review_days,
            sla_approval_days: type.sla_approval_days,
            sla_publication_days: type.sla_publication_days,
            print_allowed: type.print_allowed,
            public_panel: type.public_panel,
            active: type.active,
            justification: '',
          }
        : {
            name: '',
            acronym: '',
            hierarchy_level: this.store.levels()[0]?.level ?? 1,
            validity_days: 365,
            sla_review_days: 0,
            sla_approval_days: 0,
            sla_publication_days: 0,
            print_allowed: false,
            public_panel: true,
            active: true,
            justification: '',
          },
    );
    this.typeOpen.set(true);
  }

  async saveType(): Promise<void> {
    if (!this.canManageTypes() || this.typeSaving()) return;
    const current = this.editingType();
    const value = this.typeForm.getRawValue();
    if (
      this.typeForm.invalid ||
      !value.name.trim() ||
      !this.store.levels().some((level) => level.level === value.hierarchy_level)
    ) {
      this.typeError.set('Preencha nome, sigla, nível e prazos válidos.');
      return;
    }
    if (current && !value.justification.trim()) {
      this.typeError.set('Informe a justificativa para alterar ou inativar o tipo.');
      return;
    }
    this.typeSaving.set(true);
    this.typeError.set(null);
    try {
      const saved = await this.documentService.saveDocumentType(
        current?.id ?? null,
        {
          name: value.name.trim(),
          acronym: value.acronym.trim().toUpperCase(),
          hierarchy_level: value.hierarchy_level,
          validity_days: value.validity_days,
          sla_review_days: value.sla_review_days,
          sla_approval_days: value.sla_approval_days,
          sla_publication_days: value.sla_publication_days,
          print_allowed: value.print_allowed,
          public_panel: value.public_panel,
          active: value.active,
        },
        value.justification.trim() || null,
      );
      this.store.types.update((items) =>
        current ? items.map((item) => (item.id === saved.id ? saved : item)) : [...items, saved],
      );
      this.toast.success(current ? 'Tipo atualizado' : 'Tipo criado');
      this.typeOpen.set(false);
    } catch (error) {
      this.typeError.set(errorMessage(error, 'Erro ao salvar tipo documental'));
    } finally {
      this.typeSaving.set(false);
    }
  }

  openLevel(level?: number): void {
    if (!this.canManageTypes()) return;
    this.editingLevel.set(level ?? null);
    this.levelName.setValue(level ? this.levelLabel(level) : '');
    this.levelError.set(null);
    this.levelOpen.set(true);
  }

  async saveLevel(): Promise<void> {
    if (!this.canManageTypes() || this.levelSaving()) return;
    const name = this.levelName.value.trim();
    if (name.length < 2) {
      this.levelError.set('Informe um nome com pelo menos 2 caracteres.');
      return;
    }
    this.levelSaving.set(true);
    try {
      const saved = await this.documentService.saveDocumentLevel(this.editingLevel(), name);
      this.store.levels.update((items) =>
        [...items.filter((item) => item.level !== saved.level), saved].sort(
          (a, b) => a.level - b.level,
        ),
      );
      this.levelOpen.set(false);
      this.toast.success(this.editingLevel() ? 'Nível atualizado' : 'Nível criado');
    } catch (error) {
      this.levelError.set(errorMessage(error, 'Erro ao salvar nível'));
    } finally {
      this.levelSaving.set(false);
    }
  }

  async openTypeHistory(type: DocumentType): Promise<void> {
    this.historyType.set(type);
    this.typeHistory.set([]);
    this.typeHistoryLoading.set(true);
    try {
      const history = await this.documentService.fetchDocumentTypeHistory(type.id);
      if (this.historyType()?.id === type.id) this.typeHistory.set(history);
    } catch (error) {
      this.toast.error(errorMessage(error, 'Erro ao carregar histórico'));
    } finally {
      this.typeHistoryLoading.set(false);
    }
  }

  typeActionLabel(action: DocumentTypeHistory['action']): string {
    return {
      created: 'Criado',
      updated: 'Atualizado',
      deactivated: 'Inativado',
      reactivated: 'Reativado',
    }[action];
  }

  preview(document: GEDDocument): void {
    this.previewDocument.set(document);
  }

  requestCopy(document: GEDDocument): void {
    this.copyDue.reset();
    this.begin(document, 'request', 'Solicitar cópia controlada');
  }

  documentName(id: string): string {
    return this.store.documents().find((document) => document.id === id)?.title ?? '—';
  }

  formatDate(value: string | null): string {
    return formatDate(value);
  }
}
