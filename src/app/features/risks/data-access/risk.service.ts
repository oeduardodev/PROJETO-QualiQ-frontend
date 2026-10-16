import { inject, Injectable } from '@angular/core';
import { RiskRepository } from './risk.repository';
import type {
  Risk,
  RiskHistory,
  RiskApprovalState,
  RiskMatrixClassification,
  RiskMatrixClassificationInput,
  RiskTypeOption,
  RiskStatusOption,
  RiskFactor,
  RiskPreventiveAction,
  RiskContingencyPlan,
  RiskPreventiveActionStatusOption,
  RiskContingencyPlanStatusOption,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class RiskService {
  private readonly repository = inject(RiskRepository);

  fetchMatrixClassifications(): Promise<RiskMatrixClassification[]> {
    return this.repository.fetchMatrixClassifications();
  }

  saveMatrixClassifications(
    items: RiskMatrixClassificationInput[],
  ): Promise<RiskMatrixClassification[]> {
    return this.repository.saveMatrixClassifications(items);
  }

  changeApprovalState(id: string, state: RiskApprovalState, reason?: string | null): Promise<Risk> {
    return this.repository.changeApprovalState(id, state, reason);
  }

  fetchRiskStatuses(): Promise<RiskStatusOption[]> {
    return this.repository.fetchRiskStatuses();
  }

  fetchPreventiveActionStatuses(): Promise<RiskPreventiveActionStatusOption[]> {
    return this.repository.fetchPreventiveActionStatuses();
  }

  fetchContingencyPlanStatuses(): Promise<RiskContingencyPlanStatusOption[]> {
    return this.repository.fetchContingencyPlanStatuses();
  }

  fetchRiskTypes(): Promise<RiskTypeOption[]> {
    return this.repository.fetchRiskTypes();
  }

  async fetchDetails(riskId: string): Promise<{
    factors: RiskFactor[];
    actions: RiskPreventiveAction[];
    plans: RiskContingencyPlan[];
  }> {
    const [factors, actions, plans] = await Promise.all([
      this.repository.fetchRiskFactors(riskId),
      this.repository.fetchPreventiveActions(riskId),
      this.repository.fetchContingencyPlans(riskId),
    ]);
    return { factors, actions, plans };
  }

  addFactor(riskId: string, description: string): Promise<RiskFactor> {
    return this.repository.createRiskFactor({
      risk_id: riskId,
      description: description.trim(),
      category: null,
    });
  }

  async addPreventiveAction(riskId: string, description: string): Promise<RiskPreventiveAction> {
    const options = (await this.fetchPreventiveActionStatuses()).filter(
      (option) => option.is_active,
    );
    const status = options.find((option) => option.is_default)?.key ?? options[0]?.key;
    if (!status) throw new Error('Nenhum status ativo de ação preventiva configurado no Supabase.');
    return this.repository.createPreventiveAction({
      risk_id: riskId,
      description: description.trim(),
      responsible: null,
      status,
    });
  }

  async addContingencyPlan(riskId: string, description: string): Promise<RiskContingencyPlan> {
    const options = (await this.fetchContingencyPlanStatuses()).filter(
      (option) => option.is_active,
    );
    const status = options.find((option) => option.is_default)?.key ?? options[0]?.key;
    if (!status)
      throw new Error('Nenhum status ativo de plano de contingência configurado no Supabase.');
    return this.repository.createContingencyPlan({
      risk_id: riskId,
      description: description.trim(),
      trigger: null,
      responsible: null,
      estimated_cost: null,
      status,
    });
  }

  fetchRisks(includeInactive = false): Promise<Risk[]> {
    return this.repository.fetchRisks(includeInactive);
  }

  fetchRisksByProcess(processId: string): Promise<Risk[]> {
    return this.repository.fetchRisksByProcess(processId);
  }

  createRisk(
    input: Partial<Omit<Risk, 'id' | 'created_at' | 'updated_at' | 'risk_score' | 'risk_level'>>,
  ): Promise<Risk> {
    return this.repository.createRisk(input);
  }

  updateRisk(
    id: string,
    patch: Partial<Omit<Risk, 'id' | 'created_at' | 'updated_at' | 'risk_score' | 'risk_level'>>,
    justification?: string,
  ): Promise<Risk> {
    return this.repository.updateRisk(id, patch, justification);
  }

  fetchRiskHistory(riskId: string): Promise<RiskHistory[]> {
    return this.repository.fetchRiskHistory(riskId);
  }

  fetchRiskFactors(riskId: string): Promise<RiskFactor[]> {
    return this.repository.fetchRiskFactors(riskId);
  }

  createRiskFactor(input: Omit<RiskFactor, 'id' | 'created_at'>): Promise<RiskFactor> {
    return this.repository.createRiskFactor(input);
  }

  deleteRiskFactor(id: string): Promise<void> {
    return this.repository.deleteRiskFactor(id);
  }

  fetchPreventiveActions(riskId: string): Promise<RiskPreventiveAction[]> {
    return this.repository.fetchPreventiveActions(riskId);
  }

  createPreventiveAction(
    input: Omit<RiskPreventiveAction, 'id' | 'created_at' | 'factor_id'> & {
      factor_id?: string | null;
    },
  ): Promise<RiskPreventiveAction> {
    return this.repository.createPreventiveAction(input);
  }

  updatePreventiveAction(
    id: string,
    patch: Partial<Omit<RiskPreventiveAction, 'id' | 'created_at'>>,
  ): Promise<RiskPreventiveAction> {
    return this.repository.updatePreventiveAction(id, patch);
  }

  deletePreventiveAction(id: string): Promise<void> {
    return this.repository.deletePreventiveAction(id);
  }

  fetchContingencyPlans(riskId: string): Promise<RiskContingencyPlan[]> {
    return this.repository.fetchContingencyPlans(riskId);
  }

  createContingencyPlan(
    input: Omit<RiskContingencyPlan, 'id' | 'created_at'>,
  ): Promise<RiskContingencyPlan> {
    return this.repository.createContingencyPlan(input);
  }

  updateContingencyPlan(
    id: string,
    patch: Partial<Omit<RiskContingencyPlan, 'id' | 'created_at'>>,
  ): Promise<RiskContingencyPlan> {
    return this.repository.updateContingencyPlan(id, patch);
  }

  deleteContingencyPlan(id: string): Promise<void> {
    return this.repository.deleteContingencyPlan(id);
  }
}
