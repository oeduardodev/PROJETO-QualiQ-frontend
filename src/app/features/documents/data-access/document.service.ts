import { inject, Injectable } from '@angular/core';
import { DocumentRepository } from './document.repository';
import type { CopyStatus, DocumentStatus } from '@core/models/database';
import { nextWorkflowStatus } from '@shared/utils/workflow.utils';
import { todayUtc } from '@shared/utils/date.utils';
import { DOCUMENT_STATUS_SEQUENCE } from './document-workflow.constants';
import type {
  DocumentType,
  GEDDocument,
  DocumentWorkflow,
  ControlledCopy,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly repository = inject(DocumentRepository);

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

  requestCopy(documentId: string, userId: string | null): Promise<ControlledCopy> {
    return this.repository.createControlledCopy({
      document_id: documentId,
      user_id: userId,
      request_date: todayUtc(),
      delivery_date: null,
      return_date: null,
      status: 'solicitada',
    });
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

  createDocumentType(
    input: Partial<Omit<DocumentType, 'id' | 'created_at'>>,
  ): Promise<DocumentType> {
    return this.repository.createDocumentType(input);
  }

  updateDocumentType(
    id: string,
    patch: Partial<Omit<DocumentType, 'id' | 'created_at'>>,
  ): Promise<DocumentType> {
    return this.repository.updateDocumentType(id, patch);
  }

  deleteDocumentType(id: string): Promise<void> {
    return this.repository.deleteDocumentType(id);
  }

  fetchDocuments(): Promise<GEDDocument[]> {
    return this.repository.fetchDocuments();
  }

  createDocument(
    input: Partial<Omit<GEDDocument, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<GEDDocument> {
    return this.repository.createDocument(input);
  }

  updateDocument(
    id: string,
    patch: Partial<Omit<GEDDocument, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<GEDDocument> {
    return this.repository.updateDocument(id, patch);
  }

  deleteDocument(id: string): Promise<void> {
    return this.repository.deleteDocument(id);
  }

  fetchDocumentWorkflows(documentId: string): Promise<DocumentWorkflow[]> {
    return this.repository.fetchDocumentWorkflows(documentId);
  }

  createDocumentWorkflow(
    input: Partial<Omit<DocumentWorkflow, 'id' | 'changed_at'>>,
  ): Promise<DocumentWorkflow> {
    return this.repository.createDocumentWorkflow(input);
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
