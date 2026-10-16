import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
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
export class RiskRepository {
  private readonly client = inject(SupabaseService).client;

  async fetchMatrixClassifications(): Promise<RiskMatrixClassification[]> {
    const { data, error } = await this.client
      .from('risk_matrix_classifications')
      .select('*')
      .order('min_score');
    if (error) throw error;
    return data;
  }

  async saveMatrixClassifications(
    items: RiskMatrixClassificationInput[],
  ): Promise<RiskMatrixClassification[]> {
    const { data, error } = await this.client.rpc('save_risk_matrix_classifications', {
      p_items: items,
    });
    if (error) throw error;
    return data;
  }

  async changeApprovalState(
    id: string,
    approval_state: RiskApprovalState,
    rejection_reason: string | null = null,
  ): Promise<Risk> {
    const { data, error } = await this.client
      .from('risks')
      .update({ approval_state, rejection_reason })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async fetchRiskStatuses(): Promise<RiskStatusOption[]> {
    const { data, error } = await this.client
      .from('risk_statuses')
      .select('*')
      .order('order_index')
      .order('key');
    if (error) throw error;
    return data;
  }

  async fetchPreventiveActionStatuses(): Promise<RiskPreventiveActionStatusOption[]> {
    const { data, error } = await this.client
      .from('risk_preventive_action_statuses')
      .select('*')
      .order('order_index')
      .order('key');
    if (error) throw error;
    return data;
  }

  async fetchContingencyPlanStatuses(): Promise<RiskContingencyPlanStatusOption[]> {
    const { data, error } = await this.client
      .from('risk_contingency_plan_statuses')
      .select('*')
      .order('order_index')
      .order('key');
    if (error) throw error;
    return data;
  }

  async fetchRiskTypes(): Promise<RiskTypeOption[]> {
    const { data, error } = await this.client
      .from('risk_types')
      .select('*')
      .order('order_index')
      .order('key');
    if (error) throw error;
    return data;
  }

  fetchRisks(includeInactive = false): Promise<Risk[]> {
    return fetchAllPages((from, to) => {
      let query = this.client.from('risks').select('*');
      if (!includeInactive) query = query.eq('is_active', true);
      return query.order('created_at', { ascending: false }).order('id').range(from, to);
    });
  }

  fetchRisksByProcess(processId: string): Promise<Risk[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('risks')
        .select('*')
        .eq('process_id', processId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  async createRisk(
    input: Partial<Omit<Risk, 'id' | 'created_at' | 'updated_at' | 'risk_score' | 'risk_level'>>,
  ): Promise<Risk> {
    const { data, error } = await this.client.from('risks').insert(input).select('*').single();
    if (error) throw error;
    return data;
  }

  async updateRisk(
    id: string,
    patch: Partial<Omit<Risk, 'id' | 'created_at' | 'updated_at' | 'risk_score' | 'risk_level'>>,
    justification?: string,
  ): Promise<Risk> {
    if (justification) {
      const { data, error } = await this.client.rpc('update_risk_with_reason', {
        p_id: id,
        p_patch: patch,
        p_justification: justification,
      });
      if (error) throw error;
      return data;
    }
    const { data, error } = await this.client
      .from('risks')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  fetchRiskHistory(riskId: string): Promise<RiskHistory[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('risk_history')
        .select('*')
        .eq('risk_id', riskId)
        .order('changed_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to),
    );
  }

  fetchRiskFactors(riskId: string): Promise<RiskFactor[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('risk_factors')
        .select('*')
        .eq('risk_id', riskId)
        .order('created_at')
        .order('id')
        .range(from, to),
    );
  }

  async createRiskFactor(input: Omit<RiskFactor, 'id' | 'created_at'>): Promise<RiskFactor> {
    const { data, error } = await this.client
      .from('risk_factors')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteRiskFactor(id: string): Promise<void> {
    const { error } = await this.client.from('risk_factors').delete().eq('id', id);
    if (error) throw error;
  }

  fetchPreventiveActions(riskId: string): Promise<RiskPreventiveAction[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('risk_preventive_actions')
        .select('*')
        .eq('risk_id', riskId)
        .order('created_at')
        .order('id')
        .range(from, to),
    );
  }

  async createPreventiveAction(
    input: Omit<RiskPreventiveAction, 'id' | 'created_at' | 'factor_id'> & {
      factor_id?: string | null;
    },
  ): Promise<RiskPreventiveAction> {
    const { data, error } = await this.client
      .from('risk_preventive_actions')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async updatePreventiveAction(
    id: string,
    patch: Partial<Omit<RiskPreventiveAction, 'id' | 'created_at'>>,
  ): Promise<RiskPreventiveAction> {
    const { data, error } = await this.client
      .from('risk_preventive_actions')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deletePreventiveAction(id: string): Promise<void> {
    const { error } = await this.client.from('risk_preventive_actions').delete().eq('id', id);
    if (error) throw error;
  }

  fetchContingencyPlans(riskId: string): Promise<RiskContingencyPlan[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('risk_contingency_plans')
        .select('*')
        .eq('risk_id', riskId)
        .order('created_at')
        .order('id')
        .range(from, to),
    );
  }

  async createContingencyPlan(
    input: Omit<RiskContingencyPlan, 'id' | 'created_at'>,
  ): Promise<RiskContingencyPlan> {
    const { data, error } = await this.client
      .from('risk_contingency_plans')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async updateContingencyPlan(
    id: string,
    patch: Partial<Omit<RiskContingencyPlan, 'id' | 'created_at'>>,
  ): Promise<RiskContingencyPlan> {
    const { data, error } = await this.client
      .from('risk_contingency_plans')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteContingencyPlan(id: string): Promise<void> {
    const { error } = await this.client.from('risk_contingency_plans').delete().eq('id', id);
    if (error) throw error;
  }
}
