import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type { HelpdeskTicket } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class HelpdeskRepository {
  private readonly client = inject(SupabaseService).client;

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
  ): Promise<HelpdeskTicket> {
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
