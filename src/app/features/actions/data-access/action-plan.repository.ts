import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { ActionPlan } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class ActionPlanRepository {
  private readonly client = inject(SupabaseService).client;

  async fetchActionPlans(): Promise<ActionPlan[]> {
    const { data, error } = await this.client
      .from('action_plans')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async fetchActionPlansByTicket(ticketId: string): Promise<ActionPlan[]> {
    const { data, error } = await this.client
      .from('action_plans')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async fetchActionPlansByProcess(processId: string): Promise<ActionPlan[]> {
    const { data, error } = await this.client
      .from('action_plans')
      .select('*, ticket:tickets!inner(process_id)')
      .eq('ticket.process_id', processId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as ActionPlan[];
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
