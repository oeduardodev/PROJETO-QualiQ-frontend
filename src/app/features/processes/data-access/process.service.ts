import { inject, Injectable } from '@angular/core';
import { ProcessRepository } from './process.repository';
import type {
  ValueChainCategory,
  NodeType,
  Process,
  ProcessHistory,
  SipocNode,
  SipocNodeAssociation,
  SipocStepAssociation,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class ProcessService {
  private readonly repository = inject(ProcessRepository);

  async fetchRelevantNodes(processId: string): Promise<SipocNode[]> {
    const [nodes, associations] = await Promise.all([
      this.repository.fetchSipocNodes(),
      this.repository.fetchAssociationsByProcess(processId),
    ]);
    const associatedIds = new Set(associations.map((association) => association.node_id));
    return nodes.filter((node) => node.process_id === processId || associatedIds.has(node.id));
  }

  async fetchNodeStepAssociations(nodes: SipocNode[]): Promise<SipocStepAssociation[]> {
    const associations = await Promise.all(
      nodes
        .filter((node) => node.node_type === 'P')
        .map((node) => this.repository.fetchStepAssociations(node.id)),
    );
    return associations.flat();
  }

  saveNode(
    form: { title: string; description: string },
    current: SipocNode | null,
    type: NodeType,
    processId: string,
  ): Promise<SipocNode> {
    const attributes = { title: form.title.trim(), description: form.description.trim() || null };
    if (current) return this.repository.updateSipocNode(current.id, attributes);

    return this.repository.createSipocNode({
      ...attributes,
      node_type: type,
      order_index: 0,
      process_id: type === 'P' ? processId : null,
    });
  }

  createNodeWithSteps(
    form: { title: string; description: string },
    type: NodeType,
    processId: string,
    steps: SipocNode[],
  ): Promise<SipocNode> {
    return this.repository.createSipocNodeWithSteps(
      form,
      type,
      processId,
      steps.map((step) => step.id),
    );
  }

  fetchProcesses(): Promise<Process[]> {
    return this.repository.fetchProcesses();
  }

  createProcess(
    input: Partial<Omit<Process, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Process> {
    return this.repository.createProcess(input);
  }

  updateProcess(
    id: string,
    patch: Partial<Omit<Process, 'id' | 'created_at' | 'updated_at'>>,
    justification?: string,
  ): Promise<Process> {
    return this.repository.updateProcess(id, patch, justification);
  }

  fetchProcessHistory(id: string): Promise<ProcessHistory[]> {
    return this.repository.fetchProcessHistory(id);
  }

  fetchCategories(): Promise<ValueChainCategory[]> {
    return this.repository.fetchCategories();
  }

  createCategory(
    input: Pick<ValueChainCategory, 'name' | 'description' | 'color_key' | 'order_index'>,
  ): Promise<ValueChainCategory> {
    return this.repository.createCategory(input);
  }

  updateCategory(
    id: string,
    patch: Partial<Pick<ValueChainCategory, 'name' | 'description' | 'color_key' | 'order_index'>>,
  ): Promise<ValueChainCategory> {
    return this.repository.updateCategory(id, patch);
  }

  fetchSipocNodes(): Promise<SipocNode[]> {
    return this.repository.fetchSipocNodes();
  }

  createSipocNode(
    input: Partial<Omit<SipocNode, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<SipocNode> {
    return this.repository.createSipocNode(input);
  }

  updateSipocNode(
    id: string,
    patch: Partial<Omit<SipocNode, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<SipocNode> {
    return this.repository.updateSipocNode(id, patch);
  }

  deleteSipocNode(id: string): Promise<void> {
    return this.repository.deleteSipocNode(id);
  }

  fetchAssociationsByProcess(processId: string): Promise<SipocNodeAssociation[]> {
    return this.repository.fetchAssociationsByProcess(processId);
  }

  fetchAssociationsByNode(nodeId: string): Promise<SipocNodeAssociation[]> {
    return this.repository.fetchAssociationsByNode(nodeId);
  }

  createAssociation(nodeId: string, processId: string): Promise<void> {
    return this.repository.createAssociation(nodeId, processId);
  }

  deleteAssociation(nodeId: string, processId: string): Promise<void> {
    return this.repository.deleteAssociation(nodeId, processId);
  }

  fetchSharedSipocNodes(nodeType: NodeType): Promise<SipocNode[]> {
    return this.repository.fetchSharedSipocNodes(nodeType);
  }

  fetchAllSipocNodesByType(nodeType: NodeType): Promise<SipocNode[]> {
    return this.repository.fetchAllSipocNodesByType(nodeType);
  }

  fetchStepAssociations(stepNodeId: string): Promise<SipocStepAssociation[]> {
    return this.repository.fetchStepAssociations(stepNodeId);
  }

  createStepAssociation(stepNodeId: string, associatedNodeId: string): Promise<void> {
    return this.repository.createStepAssociation(stepNodeId, associatedNodeId);
  }

  deleteStepAssociation(stepNodeId: string, associatedNodeId: string): Promise<void> {
    return this.repository.deleteStepAssociation(stepNodeId, associatedNodeId);
  }
}
