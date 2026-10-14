import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type { ActionPlan, IndicatorResultAnalysis } from '@core/models/database';
import type { ActionPlanSuggestion } from './indicator-analysis.model';

@Injectable({ providedIn: 'root' })
export class IndicatorResultAnalysisRepository {
  private readonly client = inject(SupabaseService).client;

  fetchAll(): Promise<IndicatorResultAnalysis[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('indicator_result_analyses')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  async create(input: {
    indicator_id: string;
    history_id: string | null;
    observed_value: number;
    observed_goal: number;
    observed_period: string;
    diagnostic: string;
    suggestions: ActionPlanSuggestion[];
  }): Promise<IndicatorResultAnalysis> {
    const { data, error } = await this.client
      .from('indicator_result_analyses')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async createPlans(id: string, ticketId: string): Promise<ActionPlan[]> {
    const { data, error } = await this.client.rpc('create_plans_for_indicator_analysis', {
      p_analysis_id: id,
      p_ticket_id: ticketId,
    });
    if (error) throw error;
    return data ?? [];
  }
}
