import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type {
  Risk,
  RiskFactor,
  RiskPreventiveAction,
  RiskContingencyPlan,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class RiskRepository {
  private readonly client = inject(SupabaseService).client;

  async fetchRisks(): Promise<Risk[]> {
    const { data, error } = await this.client
      .from('risks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async fetchRisksByProcess(processId: string): Promise<Risk[]> {
    const { data, error } = await this.client
      .from('risks')
      .select('*')
      .eq('process_id', processId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
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
  ): Promise<Risk> {
    const { data, error } = await this.client
      .from('risks')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteRisk(id: string): Promise<void> {
    const { error } = await this.client.from('risks').delete().eq('id', id);
    if (error) throw error;
  }

  async fetchRiskFactors(riskId: string): Promise<RiskFactor[]> {
    const { data, error } = await this.client
      .from('risk_factors')
      .select('*')
      .eq('risk_id', riskId)
      .order('created_at');
    if (error) throw error;
    return data ?? [];
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

  async fetchPreventiveActions(riskId: string): Promise<RiskPreventiveAction[]> {
    const { data, error } = await this.client
      .from('risk_preventive_actions')
      .select('*')
      .eq('risk_id', riskId)
      .order('created_at');
    if (error) throw error;
    return data ?? [];
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

  async fetchContingencyPlans(riskId: string): Promise<RiskContingencyPlan[]> {
    const { data, error } = await this.client
      .from('risk_contingency_plans')
      .select('*')
      .eq('risk_id', riskId)
      .order('created_at');
    if (error) throw error;
    return data ?? [];
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
