import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type {
  HelpdeskCategoryOption,
  HelpdeskPriorityOption,
  HelpdeskStatusOption,
  HelpdeskTicket,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class HelpdeskRepository {
  private readonly client = inject(SupabaseService).client;

  async fetchStatuses(): Promise<HelpdeskStatusOption[]> {
    const { data, error } = await this.client
      .from('helpdesk_statuses')
      .select('*')
      .order('order_index')
      .order('key');
    if (error) throw error;
    return data;
  }

  async fetchCategories(): Promise<HelpdeskCategoryOption[]> {
    const { data, error } = await this.client
      .from('helpdesk_categories')
      .select('*')
      .order('order_index')
      .order('key');
    if (error) throw error;
    return data;
  }

  async fetchPriorities(): Promise<HelpdeskPriorityOption[]> {
    const { data, error } = await this.client
      .from('helpdesk_priorities')
      .select('*')
      .order('order_index')
      .order('key');
    if (error) throw error;
    return data;
  }

  fetchHelpdeskTickets(): Promise<HelpdeskTicket[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('helpdesk_tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  async createHelpdeskTicket(
    input: Partial<Omit<HelpdeskTicket, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<HelpdeskTicket> {
    const { data, error } = await this.client
      .from('helpdesk_tickets')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async updateHelpdeskTicket(
    id: string,
    patch: Partial<Omit<HelpdeskTicket, 'id' | 'created_at' | 'updated_at'>>,
    justification?: string,
  ): Promise<HelpdeskTicket> {
    if (justification !== undefined) {
      const { data, error } = await this.client.rpc('update_audited_record', {
        p_entity: 'helpdesk_tickets',
        p_id: id,
        p_patch: patch,
        p_justification: justification,
      });
      if (error) throw error;
      return data as unknown as HelpdeskTicket;
    }
    const { data, error } = await this.client
      .from('helpdesk_tickets')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteHelpdeskTicket(id: string): Promise<void> {
    const { error } = await this.client.from('helpdesk_tickets').delete().eq('id', id);
    if (error) throw error;
  }
}
