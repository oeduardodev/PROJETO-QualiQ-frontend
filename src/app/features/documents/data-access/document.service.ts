import { inject, Injectable } from '@angular/core';
import { DocumentRepository } from './document.repository';
import type { CopyStatus } from '@core/models/database';
import type { DocumentSavePayload } from './document.mapper';
import type {
  DocumentType,
  DocumentLevel,
  DocumentTypeHistory,
  GEDDocument,
  DocumentWorkflow,
  DocumentDecision,
  ControlledCopy,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly repository = inject(DocumentRepository);

  transition(document: GEDDocument, action: string, reason: string) {
    if (!reason.trim()) throw new Error('Informe a justificativa.');
    return this.repository.transition(document, action, reason.trim());
  }

  versions(id: string) {
    return this.repository.versions(id);
  }

  syncGoogle(document: GEDDocument) {
    return this.repository.syncGoogle(document);
  }

  emailCopy(id: string) {
    return this.repository.emailCopy(id);
  }

  requestControlledCopy(id: string, reason: string, due: string) {
    return this.repository.requestCopy(id, reason, due);
  }

  transitionCopy(copy: ControlledCopy, status: CopyStatus, reason: string) {
    return this.repository.transitionCopy(copy, status, reason);
  }

  saveDocument(current: GEDDocument | null, payload: DocumentSavePayload): Promise<GEDDocument> {
    return this.repository.saveDocument(current, payload);
  }

  fetchDocumentTypes(): Promise<DocumentType[]> {
    return this.repository.fetchDocumentTypes();
  }

  fetchDocumentLevels(): Promise<DocumentLevel[]> {
    return this.repository.fetchDocumentLevels();
  }

  saveDocumentLevel(
    level: number | null,
    name: string,
    justification: string | null,
  ): Promise<DocumentLevel> {
    return this.repository.saveDocumentLevel(level, name, justification);
  }

  saveDocumentType(
    id: string | null,
    input: Pick<
      DocumentType,
      | 'name'
      | 'acronym'
      | 'hierarchy_level'
      | 'validity_days'
      | 'sla_review_days'
      | 'sla_approval_days'
      | 'sla_publication_days'
      | 'print_allowed'
      | 'public_panel'
      | 'active'
    >,
    justification: string | null,
  ): Promise<DocumentType> {
    return this.repository.saveDocumentType(id, input, justification);
  }

  fetchDocumentTypeHistory(typeId: string): Promise<DocumentTypeHistory[]> {
    return this.repository.fetchDocumentTypeHistory(typeId);
  }

  fetchDocuments(): Promise<GEDDocument[]> {
    return this.repository.fetchDocuments();
  }

  fetchDocumentWorkflows(documentId: string): Promise<DocumentWorkflow[]> {
    return this.repository.fetchDocumentWorkflows(documentId);
  }

  fetchDocumentDecisions(documentIds: string[]): Promise<DocumentDecision[]> {
    return this.repository.fetchDocumentDecisions(documentIds);
  }

  fetchControlledCopies(): Promise<ControlledCopy[]> {
    return this.repository.fetchControlledCopies();
  }

  fetchDocumentsByProcess(processId: string): Promise<GEDDocument[]> {
    return this.repository.fetchDocumentsByProcess(processId);
  }
}
