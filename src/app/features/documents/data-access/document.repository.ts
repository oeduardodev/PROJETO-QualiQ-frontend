import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type { DocumentSavePayload } from './document.mapper';
import type {
  DocumentType,
  GEDDocument,
  DocumentWorkflow,
  ControlledCopy,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class DocumentRepository {
  private readonly client = inject(SupabaseService).client;

  async saveDocument(
    current: GEDDocument | null,
    payload: DocumentSavePayload,
  ): Promise<GEDDocument> {
    const { data, error } = await this.client
      .rpc('save_document', {
        p_document_id: current?.id ?? null,
        p_expected_status: current?.status ?? null,
        p_status: payload.status,
        p_title: payload.title,
        p_type_id: payload.type_id,
        p_process_id: payload.process_id,
        p_drive_link: payload.drive_link,
        p_print_allowed: payload.print_allowed,
      })
      .single();
    if (error) throw error;
    return data;
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

  async createDocumentType(
    input: Partial<Omit<DocumentType, 'id' | 'created_at'>>,
  ): Promise<DocumentType> {
    const { data, error } = await this.client
      .from('document_types')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async updateDocumentType(
    id: string,
    patch: Partial<Omit<DocumentType, 'id' | 'created_at'>>,
  ): Promise<DocumentType> {
    const { data, error } = await this.client
      .from('document_types')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteDocumentType(id: string): Promise<void> {
    const { error } = await this.client.from('document_types').delete().eq('id', id);
    if (error) throw error;
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

  async advanceDocument(
    id: string,
    expectedStatus: GEDDocument['status'],
    nextStatus: GEDDocument['status'],
  ): Promise<GEDDocument> {
    const { data, error } = await this.client
      .rpc('advance_document', {
        p_document_id: id,
        p_expected_status: expectedStatus,
        p_next_status: nextStatus,
      })
      .single();
    if (error) throw error;
    return data;
  }

  async deleteDocument(id: string): Promise<void> {
    const { error } = await this.client.from('documents').delete().eq('id', id);
    if (error) throw error;
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

  async createControlledCopy(
    input: Partial<Omit<ControlledCopy, 'id' | 'created_at'>>,
  ): Promise<ControlledCopy> {
    const { data, error } = await this.client
      .from('controlled_copies')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async updateControlledCopy(
    id: string,
    patch: Partial<Omit<ControlledCopy, 'id' | 'created_at'>>,
  ): Promise<ControlledCopy> {
    const { data, error } = await this.client
      .from('controlled_copies')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteControlledCopy(id: string): Promise<void> {
    const { error } = await this.client.from('controlled_copies').delete().eq('id', id);
    if (error) throw error;
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
