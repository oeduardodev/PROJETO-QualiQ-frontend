import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type { Ticket } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class TicketRepository {
  private readonly client = inject(SupabaseService).client;

  fetchTickets(): Promise<Ticket[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  async createTicket(
    input: Partial<Omit<Ticket, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Ticket> {
    const { data, error } = await this.client.from('tickets').insert(input).select('*').single();
    if (error) throw error;
    return data;
  }

  async updateTicket(
    id: string,
    patch: Partial<Omit<Ticket, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Ticket> {
    const { data, error } = await this.client
      .from('tickets')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteTicket(id: string): Promise<void> {
    const { error } = await this.client.from('tickets').delete().eq('id', id);
    if (error) throw error;
  }

  fetchTicketsByProcess(processId: string): Promise<Ticket[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('tickets')
        .select('*')
        .eq('process_id', processId)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  fetchTicketsByStep(stepId: string): Promise<Ticket[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('tickets')
        .select('*')
        .eq('step_id', stepId)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }
}
