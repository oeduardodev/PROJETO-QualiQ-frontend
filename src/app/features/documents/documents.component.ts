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
  GEDDocument,
} from '@core/models/database';
import { IconDirective } from '@shared/components/icon/icon.directive';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { ToastService } from '@shared/services/toast.service';
import { DocumentsStore } from './documents.store';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [ReactiveFormsModule, IconDirective, ModalComponent],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss',
  host: { class: 'ui-standard-fields' },
  providers: [DocumentsStore],
})
export class DocumentsComponent {
  private readonly documentService = inject(DocumentService);
  readonly store = inject(DocumentsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  readonly mode = this.route.snapshot.data['mode'] as
    'panel' | 'hierarchy' | 'management' | 'copies';
  readonly workflow = WORKFLOW;
  readonly locked = DOCUMENTS_LOCKED;
  readonly levels = [1, 2, 3, 4];
  readonly searchValue = signal('');
  readonly search = new FormControl('', { nonNullable: true });
  readonly documentOpen = signal(false);
  readonly editingDocument = signal<GEDDocument | null>(null);
  readonly typeOpen = signal(false);
  readonly editingType = signal<DocumentType | null>(null);
  readonly formError = signal<string | null>(null);
  readonly documentForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: Validators.required }),
    type_id: new FormControl('', { nonNullable: true }),
    process_id: new FormControl('', { nonNullable: true }),
    drive_link: new FormControl('', { nonNullable: true }),
    status: new FormControl<DocumentStatus>('rascunho', { nonNullable: true }),
    print_allowed: new FormControl(false, { nonNullable: true }),
  });
  readonly typeForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    hierarchy_level: new FormControl(1, { nonNullable: true }),
    sla_review_days: new FormControl(0, { nonNullable: true }),
    sla_approval_days: new FormControl(0, { nonNullable: true }),
    print_allowed: new FormControl(false, { nonNullable: true }),
  });
  readonly panelDocuments = computed(() =>
    this.store
      .published()
      .filter(
        (document) =>
          !this.searchValue() ||
          document.title.toLowerCase().includes(this.searchValue().toLowerCase()),
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
    if (!DOCUMENTS_LOCKED) return false;
    this.toast.error(DOCUMENTS_LOCKED_MESSAGE);
    return true;
  }

  docsByStatus(status: DocumentStatus): GEDDocument[] {
    return this.store.documents().filter((document) => document.status === status);
  }

  typesAt(level: number): DocumentType[] {
    return this.store.types().filter((type) => type.hierarchy_level === level);
  }

  levelLabel(level: number): string {
    return level === 1 ? 'Nível 1 — Topo' : level === 4 ? 'Nível 4 — Base' : `Nível ${level}`;
  }

  levelIcon(level: number): string {
    return ({ 1: 'Triangle', 2: 'Pentagon', 3: 'Hexagon', 4: 'Square' } as Record<number, string>)[
      level
    ];
  }

  openDocument(document?: GEDDocument): void {
    if (this.blocked()) return;
    this.editingDocument.set(document ?? null);
    this.documentForm.reset(
      document
        ? {
            title: document.title,
            type_id: document.type_id ?? '',
            process_id: document.process_id ?? '',
            drive_link: document.drive_link ?? '',
            status: document.status,
            print_allowed: document.print_allowed,
          }
        : {
            title: '',
            type_id: '',
            process_id: '',
            drive_link: '',
            status: 'rascunho',
            print_allowed: false,
          },
    );
    this.documentOpen.set(true);
  }

  async saveDocument(): Promise<void> {
    if (this.blocked()) return;
    if (this.documentForm.invalid) {
      this.formError.set('Título é obrigatório.');
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

  async advance(document: GEDDocument): Promise<void> {
    if (this.blocked()) return;
    try {
      const { savedDocument, nextStatus } = await this.documentService.advanceDocument(document);
      this.store.documents.update((items) =>
        items.map((item) => (item.id === savedDocument.id ? savedDocument : item)),
      );
      this.toast.success(
        `Documento movido para ${WORKFLOW.find((item) => item.value === nextStatus)?.label}`,
      );
    } catch (error) {
      this.toast.error(errorMessage(error, 'Erro ao avançar documento'));
    }
  }

  async removeDocument(document: GEDDocument): Promise<void> {
    if (this.blocked()) return;
    if (!confirm('Excluir este documento?')) return;
    await this.documentService.deleteDocument(document.id);
    this.store.documents.update((items) => items.filter((item) => item.id !== document.id));
    this.toast.success('Documento excluído');
  }

  openType(type?: DocumentType): void {
    if (this.blocked()) return;
    this.editingType.set(type ?? null);
    this.typeForm.reset(
      type
        ? {
            name: type.name,
            hierarchy_level: type.hierarchy_level,
            sla_review_days: type.sla_review_days,
            sla_approval_days: type.sla_approval_days,
            print_allowed: type.print_allowed,
          }
        : {
            name: '',
            hierarchy_level: 1,
            sla_review_days: 0,
            sla_approval_days: 0,
            print_allowed: false,
          },
    );
    this.typeOpen.set(true);
  }

  async saveType(): Promise<void> {
    if (this.blocked()) return;
    if (this.typeForm.invalid) return;
    const current = this.editingType();
    const saved = current
      ? await this.documentService.updateDocumentType(current.id, this.typeForm.getRawValue())
      : await this.documentService.createDocumentType(this.typeForm.getRawValue());
    this.store.types.update((items) =>
      current ? items.map((item) => (item.id === saved.id ? saved : item)) : [...items, saved],
    );
    this.toast.success(current ? 'Tipo atualizado' : 'Tipo criado');
    this.typeOpen.set(false);
  }

  async removeType(type: DocumentType): Promise<void> {
    if (this.blocked()) return;
    if (!confirm('Excluir este tipo documental?')) return;
    await this.documentService.deleteDocumentType(type.id);
    this.store.types.update((items) => items.filter((item) => item.id !== type.id));
    this.toast.success('Tipo excluído');
  }

  preview(document: GEDDocument): void {
    if (this.blocked()) return;
    if (!document.drive_link) return;
    let url: URL;
    try {
      url = new URL(document.drive_link);
    } catch {
      this.toast.error('Link do documento inválido');
      return;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      this.toast.error('Use um link HTTP ou HTTPS para o documento');
      return;
    }
    const match =
      url.hostname === 'docs.google.com'
        ? url.pathname.match(/^\/document\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)
        : null;
    window.open(
      match ? `https://docs.google.com/document/d/${match[1]}/preview` : url.href,
      '_blank',
      'noopener,noreferrer',
    );
  }

  async requestCopy(document: GEDDocument): Promise<void> {
    if (this.blocked()) return;
    try {
      const saved = await this.documentService.requestCopy(document.id);
      this.store.copies.update((items) => [saved, ...items]);
      this.toast.success('Cópia controlada solicitada');
    } catch (e) {
      this.toast.error(errorMessage(e, 'Erro ao solicitar cópia'));
    }
  }

  documentName(id: string): string {
    return this.store.documents().find((document) => document.id === id)?.title ?? '—';
  }

  formatDate(value: string | null): string {
    return formatDate(value);
  }

  async changeCopyStatus(copy: ControlledCopy, event: Event): Promise<void> {
    if (this.blocked()) return;
    const status = (event.target as HTMLSelectElement).value as CopyStatus;
    const saved = await this.documentService.changeCopyStatus(copy, status);
    this.store.copies.update((items) => items.map((item) => (item.id === saved.id ? saved : item)));
    this.toast.success('Status atualizado');
  }

  async removeCopy(copy: ControlledCopy): Promise<void> {
    if (this.blocked()) return;
    if (!confirm('Excluir este registro de cópia?')) return;
    await this.documentService.deleteControlledCopy(copy.id);
    this.store.copies.update((items) => items.filter((item) => item.id !== copy.id));
    this.toast.success('Cópia excluída');
  }
}
