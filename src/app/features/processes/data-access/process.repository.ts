import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type {
  ValueChainCategory,
  NodeType,
  Process,
  SipocNode,
  SipocNodeAssociation,
  SipocStepAssociation,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class ProcessRepository {
  private readonly client = inject(SupabaseService).client;

  fetchProcesses(): Promise<Process[]> {
    return fetchAllPages((from, to) =>
      this.client.from('processes').select('*').order('created_at').order('id').range(from, to),
    );
  }

  async createProcess(
    input: Partial<Omit<Process, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Process> {
    const { data, error } = await this.client.from('processes').insert(input).select('*').single();
    if (error) throw error;
    return data;
  }

  async updateProcess(
    id: string,
    patch: Partial<Omit<Process, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Process> {
    const { data, error } = await this.client
      .from('processes')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteProcess(id: string): Promise<void> {
    const { error } = await this.client.from('processes').delete().eq('id', id);
    if (error) throw error;
  }

  fetchCategories(): Promise<ValueChainCategory[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('value_chain_categories')
        .select('*')
        .order('order_index')
        .order('id')
        .range(from, to),
    );
  }

  async createCategory(
    input: Pick<ValueChainCategory, 'name' | 'description' | 'color_key' | 'order_index'>,
  ): Promise<ValueChainCategory> {
    const { data, error } = await this.client
      .from('value_chain_categories')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async updateCategory(
    id: string,
    patch: Partial<Pick<ValueChainCategory, 'name' | 'description' | 'color_key' | 'order_index'>>,
  ): Promise<ValueChainCategory> {
    const { data, error } = await this.client
      .from('value_chain_categories')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  fetchSipocNodes(): Promise<SipocNode[]> {
    return fetchAllPages((from, to) =>
      this.client.from('sipoc_nodes').select('*').order('created_at').order('id').range(from, to),
    );
  }

  async createSipocNode(
    input: Partial<Omit<SipocNode, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<SipocNode> {
    const { data, error } = await this.client
      .from('sipoc_nodes')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async createSipocNodeWithSteps(
    form: { title: string; description: string },
    type: NodeType,
    processId: string,
    stepIds: string[],
  ): Promise<SipocNode> {
    const { data, error } = await this.client.rpc('create_sipoc_node_with_steps', {
      p_title: form.title,
      p_description: form.description,
      p_node_type: type,
      p_process_id: processId,
      p_step_ids: stepIds,
    });
    if (error) throw error;
    return data;
  }

  async updateSipocNode(
    id: string,
    patch: Partial<Omit<SipocNode, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<SipocNode> {
    const { data, error } = await this.client
      .from('sipoc_nodes')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteSipocNode(id: string): Promise<void> {
    const { error } = await this.client.from('sipoc_nodes').delete().eq('id', id);
    if (error) throw error;
  }

  fetchAssociationsByProcess(processId: string): Promise<SipocNodeAssociation[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('sipoc_node_associations')
        .select('*')
        .eq('process_id', processId)
        .order('id')
        .range(from, to),
    );
  }

  fetchAssociationsByNode(nodeId: string): Promise<SipocNodeAssociation[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('sipoc_node_associations')
        .select('*')
        .eq('node_id', nodeId)
        .order('id')
        .range(from, to),
    );
  }

  async createAssociation(nodeId: string, processId: string): Promise<void> {
    const { error } = await this.client
      .from('sipoc_node_associations')
      .insert({ node_id: nodeId, process_id: processId });
    if (error) throw error;
  }

  async deleteAssociation(nodeId: string, processId: string): Promise<void> {
    const { error } = await this.client
      .from('sipoc_node_associations')
      .delete()
      .eq('node_id', nodeId)
      .eq('process_id', processId);
    if (error) throw error;
  }

  fetchSharedSipocNodes(nodeType: NodeType): Promise<SipocNode[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('sipoc_nodes')
        .select('*')
        .is('process_id', null)
        .eq('node_type', nodeType)
        .order('title')
        .order('id')
        .range(from, to),
    );
  }

  fetchAllSipocNodesByType(nodeType: NodeType): Promise<SipocNode[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('sipoc_nodes')
        .select('*')
        .eq('node_type', nodeType)
        .order('title')
        .order('id')
        .range(from, to),
    );
  }

  fetchStepAssociations(stepNodeId: string): Promise<SipocStepAssociation[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('sipoc_step_associations')
        .select('*')
        .eq('step_node_id', stepNodeId)
        .order('id')
        .range(from, to),
    );
  }

  async createStepAssociation(stepNodeId: string, associatedNodeId: string): Promise<void> {
    const { error } = await this.client
      .from('sipoc_step_associations')
      .insert({ step_node_id: stepNodeId, associated_node_id: associatedNodeId });
    if (error) throw error;
  }

  async deleteStepAssociation(stepNodeId: string, associatedNodeId: string): Promise<void> {
    const { error } = await this.client
      .from('sipoc_step_associations')
      .delete()
      .eq('step_node_id', stepNodeId)
      .eq('associated_node_id', associatedNodeId);
    if (error) throw error;
  }
}
