import { inject, Injectable } from '@angular/core';
import { DocumentRepository } from './document.repository';
import type { CopyStatus, DocumentStatus } from '@core/models/database';
import { nextWorkflowStatus } from '@shared/utils/workflow.utils';
import { todayUtc } from '@shared/utils/date.utils';
import { DOCUMENT_STATUS_SEQUENCE } from './document-workflow.constants';
import type { DocumentSavePayload } from './document.mapper';
import type {
  DocumentType,
  DocumentLevel,
  DocumentTypeHistory,
  GEDDocument,
  DocumentWorkflow,
  ControlledCopy,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly repository = inject(DocumentRepository);

  saveDocument(current: GEDDocument | null, payload: DocumentSavePayload): Promise<GEDDocument> {
    return this.repository.saveDocument(current, payload);
  }

  async advanceDocument(
    document: GEDDocument,
  ): Promise<{ savedDocument: GEDDocument; nextStatus: DocumentStatus }> {
    const status = nextWorkflowStatus(document.status, DOCUMENT_STATUS_SEQUENCE);
    const savedDocument = await this.repository.advanceDocument(
      document.id,
      document.status,
      status,
    );
    return { savedDocument, nextStatus: status };
  }

  requestCopy(documentId: string): Promise<ControlledCopy> {
    return this.repository.createControlledCopy({ document_id: documentId });
  }

  changeCopyStatus(copy: ControlledCopy, status: CopyStatus): Promise<ControlledCopy> {
    const today = todayUtc();
    return this.repository.updateControlledCopy(copy.id, {
      status,
      delivery_date: status === 'entregue' ? today : copy.delivery_date,
      return_date: status === 'recolhida' ? today : copy.return_date,
    });
  }

  fetchDocumentTypes(): Promise<DocumentType[]> {
    return this.repository.fetchDocumentTypes();
  }

  fetchDocumentLevels(): Promise<DocumentLevel[]> {
    return this.repository.fetchDocumentLevels();
  }

  saveDocumentLevel(level: number | null, name: string): Promise<DocumentLevel> {
    return this.repository.saveDocumentLevel(level, name);
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

  deleteDocument(id: string): Promise<void> {
    return this.repository.deleteDocument(id);
  }

  fetchDocumentWorkflows(documentId: string): Promise<DocumentWorkflow[]> {
    return this.repository.fetchDocumentWorkflows(documentId);
  }

  fetchControlledCopies(): Promise<ControlledCopy[]> {
    return this.repository.fetchControlledCopies();
  }

  createControlledCopy(
    input: Partial<Omit<ControlledCopy, 'id' | 'created_at'>>,
  ): Promise<ControlledCopy> {
    return this.repository.createControlledCopy(input);
  }

  updateControlledCopy(
    id: string,
    patch: Partial<Omit<ControlledCopy, 'id' | 'created_at'>>,
  ): Promise<ControlledCopy> {
    return this.repository.updateControlledCopy(id, patch);
  }

  deleteControlledCopy(id: string): Promise<void> {
    return this.repository.deleteControlledCopy(id);
  }

  fetchDocumentsByProcess(processId: string): Promise<GEDDocument[]> {
    return this.repository.fetchDocumentsByProcess(processId);
  }
}
