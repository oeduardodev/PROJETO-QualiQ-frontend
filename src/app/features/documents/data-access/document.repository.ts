import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type {
  DocumentType,
  GEDDocument,
  DocumentWorkflow,
  ControlledCopy,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class DocumentRepository {
  private readonly client = inject(SupabaseService).client;

  async fetchDocumentTypes(): Promise<DocumentType[]> {
    const { data, error } = await this.client
      .from('document_types')
      .select('*')
      .order('hierarchy_level');
    if (error) throw error;
    return data ?? [];
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

  async fetchDocuments(): Promise<GEDDocument[]> {
    const { data, error } = await this.client
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async createDocument(
    input: Partial<Omit<GEDDocument, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<GEDDocument> {
    const { data, error } = await this.client.from('documents').insert(input).select('*').single();
    if (error) throw error;
    return data;
  }

  async updateDocument(
    id: string,
    patch: Partial<Omit<GEDDocument, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<GEDDocument> {
    const { data, error } = await this.client
      .from('documents')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
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

  async fetchDocumentWorkflows(documentId: string): Promise<DocumentWorkflow[]> {
    const { data, error } = await this.client
      .from('document_workflows')
      .select('*')
      .eq('document_id', documentId)
      .order('changed_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async createDocumentWorkflow(
    input: Partial<Omit<DocumentWorkflow, 'id' | 'changed_at'>>,
  ): Promise<DocumentWorkflow> {
    const { data, error } = await this.client
      .from('document_workflows')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async fetchControlledCopies(): Promise<ControlledCopy[]> {
    const { data, error } = await this.client
      .from('controlled_copies')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
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

  async fetchDocumentsByProcess(processId: string): Promise<GEDDocument[]> {
    const { data, error } = await this.client
      .from('documents')
      .select('*')
      .eq('process_id', processId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
}
