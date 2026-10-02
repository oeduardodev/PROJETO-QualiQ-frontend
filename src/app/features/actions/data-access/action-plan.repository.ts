import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type { ActionPlan } from '@core/models/database';
import type { ActionPlanSuggestion } from '@features/indicators/data-access/indicator-analysis.model';

@Injectable({ providedIn: 'root' })
export class ActionPlanRepository {
  private readonly client = inject(SupabaseService).client;

  fetchActionPlans(): Promise<ActionPlan[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('action_plans')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  fetchActionPlansByTicket(ticketId: string): Promise<ActionPlan[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('action_plans')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  fetchActionPlansByProcess(processId: string): Promise<ActionPlan[]> {
    return fetchAllPages<ActionPlan>((from, to) =>
      this.client
        .from('action_plans')
        .select('*, ticket:tickets!inner(process_id)')
        .eq('ticket.process_id', processId)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  async createActionPlan(
    input: Partial<Omit<ActionPlan, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<ActionPlan> {
    const { data, error } = await this.client
      .from('action_plans')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async createFromSuggestions(
    ticketId: string,
    suggestions: ActionPlanSuggestion[],
  ): Promise<ActionPlan[]> {
    const { data, error } = await this.client.rpc('create_action_plans_from_suggestions', {
      p_ticket_id: ticketId,
      p_suggestions: suggestions,
    });
    if (error) throw error;
    return data ?? [];
  }

  async updateActionPlan(
    id: string,
    patch: Partial<Omit<ActionPlan, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<ActionPlan> {
    const { data, error } = await this.client
      .from('action_plans')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteActionPlan(id: string): Promise<void> {
    const { error } = await this.client.from('action_plans').delete().eq('id', id);
    if (error) throw error;
  }
}
