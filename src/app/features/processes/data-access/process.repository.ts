import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
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

  async fetchProcesses(): Promise<Process[]> {
    const { data, error } = await this.client.from('processes').select('*').order('created_at');
    if (error) throw error;
    return data ?? [];
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

  async fetchCategories(): Promise<ValueChainCategory[]> {
    const { data, error } = await this.client
      .from('value_chain_categories')
      .select('*')
      .order('order_index');
    if (error) throw error;
    return data ?? [];
  }

  async fetchSipocNodes(): Promise<SipocNode[]> {
    const { data, error } = await this.client.from('sipoc_nodes').select('*').order('created_at');
    if (error) throw error;
    return data ?? [];
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

  async fetchAssociationsByProcess(processId: string): Promise<SipocNodeAssociation[]> {
    const { data, error } = await this.client
      .from('sipoc_node_associations')
      .select('*')
      .eq('process_id', processId);
    if (error) throw error;
    return data ?? [];
  }

  async fetchAssociationsByNode(nodeId: string): Promise<SipocNodeAssociation[]> {
    const { data, error } = await this.client
      .from('sipoc_node_associations')
      .select('*')
      .eq('node_id', nodeId);
    if (error) throw error;
    return data ?? [];
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

  async fetchSharedSipocNodes(nodeType: NodeType): Promise<SipocNode[]> {
    const { data, error } = await this.client
      .from('sipoc_nodes')
      .select('*')
      .is('process_id', null)
      .eq('node_type', nodeType)
      .order('title');
    if (error) throw error;
    return data ?? [];
  }

  async fetchAllSipocNodesByType(nodeType: NodeType): Promise<SipocNode[]> {
    const { data, error } = await this.client
      .from('sipoc_nodes')
      .select('*')
      .eq('node_type', nodeType)
      .order('title');
    if (error) throw error;
    return data ?? [];
  }

  async fetchStepAssociations(stepNodeId: string): Promise<SipocStepAssociation[]> {
    const { data, error } = await this.client
      .from('sipoc_step_associations')
      .select('*')
      .eq('step_node_id', stepNodeId);
    if (error) throw error;
    return data ?? [];
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
