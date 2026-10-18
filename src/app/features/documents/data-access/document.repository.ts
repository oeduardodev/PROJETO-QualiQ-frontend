import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
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

async function integrationError(error: Error): Promise<Error> {
  const context = (error as Error & { context?: unknown }).context;
  if (context instanceof Response) {
    try {
      const payload: unknown = await context.clone().json();
      if (
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof payload.error === 'string'
      )
        return new Error(payload.error);
    } catch {
      // Keep the HTTP status when the function response is not JSON.
    }
    return new Error(`A Edge Function respondeu ${context.status} ${context.statusText}.`);
  }
  const message = error.message || 'Falha ao chamar a Edge Function de documentos.';
  if (message.includes('Failed to send a request to the Edge Function'))
    return new Error(
      'Falha de rede ou CORS ao chamar a Edge Function. Confirme se document-integration está implantada e se PUBLIC_APP_ORIGIN corresponde à origem deste app.',
    );
  return new Error(message);
}

@Injectable({ providedIn: 'root' })
export class DocumentRepository {
  private readonly client = inject(SupabaseService).client;

  async saveDocument(
    current: GEDDocument | null,
    payload: DocumentSavePayload,
  ): Promise<GEDDocument> {
    const { data, error } = await this.client
      .rpc('save_operation_document', {
        p_id: current?.id ?? null,
        p_expected_updated_at: current?.updated_at ?? null,
        p_payload: { ...payload },
        p_reason: payload.justification?.trim() ?? '',
      })
      .single();
    if (error) throw error;
    return data;
  }

  async transition(document: GEDDocument, action: string, reason: string): Promise<GEDDocument> {
    const { data, error } = await this.client
      .rpc('transition_operation_document', {
        p_id: document.id,
        p_expected_updated_at: document.updated_at,
        p_action: action,
        p_reason: reason,
      })
      .single();
    if (error) throw error;
    return data;
  }

  async requestCopy(id: string, reason: string, due: string): Promise<ControlledCopy> {
    const { data, error } = await this.client
      .rpc('request_operation_copy', { p_document_id: id, p_reason: reason, p_due_date: due })
      .single();
    if (error) throw error;
    return data;
  }

  async transitionCopy(
    copy: ControlledCopy,
    status: ControlledCopy['status'],
    reason: string,
  ): Promise<ControlledCopy> {
    const { data, error } = await this.client
      .rpc('transition_operation_copy', {
        p_id: copy.id,
        p_expected_status: copy.status,
        p_status: status,
        p_reason: reason,
      })
      .single();
    if (error) throw error;
    return data;
  }

  async versions(id: string) {
    const { data, error } = await this.client
      .from('document_versions')
      .select('*')
      .eq('document_id', id)
      .order('version', { ascending: false });
    if (error) throw error;
    return data;
  }

  async syncGoogle(document: GEDDocument): Promise<GEDDocument> {
    const { data, error } = await this.client.functions.invoke('document-integration', {
      body: { action: 'sync', document_id: document.id, expected_updated_at: document.updated_at },
    });
    if (error) throw await integrationError(error);
    if (data?.error) throw new Error(data.error);
    return data.document;
  }

  async emailCopy(id: string): Promise<void> {
    const { data, error } = await this.client.functions.invoke('document-integration', {
      body: { action: 'email', copy_id: id },
    });
    if (error) throw await integrationError(error);
    if (data?.error) throw new Error(data.error);
  }

  fetchDocumentTypes(): Promise<DocumentType[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('document_types')
        .select('*')
        .order('hierarchy_level')
        .order('id')
        .range(from, to),
    );
  }

  fetchDocumentLevels(): Promise<DocumentLevel[]> {
    return fetchAllPages((from, to) =>
      this.client.from('document_levels').select('*').order('level').range(from, to),
    );
  }

  async saveDocumentLevel(
    level: number | null,
    name: string,
    justification: string | null,
  ): Promise<DocumentLevel> {
    const { data, error } = await this.client
      .rpc('save_document_level_with_reason', {
        p_level: level,
        p_name: name,
        p_justification: justification,
      })
      .single();
    if (error) throw error;
    return data;
  }

  fetchDocumentTypeHistory(typeId: string): Promise<DocumentTypeHistory[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('document_type_history')
        .select('*')
        .eq('type_id', typeId)
        .order('changed_at', { ascending: false })
        .range(from, to),
    );
  }

  async saveDocumentType(
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
    const { data, error } = await this.client
      .rpc('save_document_type', {
        p_type_id: id,
        p_name: input.name,
        p_acronym: input.acronym,
        p_level: input.hierarchy_level,
        p_validity_days: input.validity_days,
        p_review_days: input.sla_review_days,
        p_approval_days: input.sla_approval_days,
        p_publication_days: input.sla_publication_days,
        p_print_allowed: input.print_allowed,
        p_public_panel: input.public_panel,
        p_active: input.active,
        p_justification: justification,
      })
      .single();
    if (error) throw error;
    return data;
  }

  fetchDocuments(): Promise<GEDDocument[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  fetchDocumentWorkflows(documentId: string): Promise<DocumentWorkflow[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('document_workflows')
        .select('*')
        .eq('document_id', documentId)
        .order('changed_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  fetchDocumentDecisions(documentIds: string[]): Promise<DocumentDecision[]> {
    if (!documentIds.length) return Promise.resolve([]);
    return fetchAllPages((from, to) =>
      this.client
        .from('document_decisions')
        .select('*')
        .in('document_id', documentIds)
        .order('decided_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  fetchControlledCopies(): Promise<ControlledCopy[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('controlled_copies')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  fetchDocumentsByProcess(processId: string): Promise<GEDDocument[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('documents')
        .select('*')
        .eq('process_id', processId)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }
}
