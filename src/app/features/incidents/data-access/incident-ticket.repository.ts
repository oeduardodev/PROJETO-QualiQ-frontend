import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type { Ticket, TicketStatusOption } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class IncidentTicketRepository {
  private readonly client = inject(SupabaseService).client;

  async save(
    current: Ticket | null,
    payload: Record<string, unknown>,
    reason: string,
  ): Promise<Ticket> {
    const { data, error } = await this.client
      .rpc('save_operation_ticket', {
        p_id: current?.id ?? null,
        p_expected_updated_at: current?.updated_at ?? null,
        p_payload: payload,
        p_reason: reason,
      })
      .single();
    if (error) throw error;
    return data;
  }

  async transition(
    ticket: Ticket,
    action: string,
    manager: string | null,
    reason: string,
  ): Promise<Ticket> {
    const { data, error } = await this.client
      .rpc('transition_operation_ticket', {
        p_id: ticket.id,
        p_expected_updated_at: ticket.updated_at,
        p_action: action,
        p_manager: manager,
        p_reason: reason,
      })
      .single();
    if (error) throw error;
    return data;
  }

  async publicLink(classification: string, process: string): Promise<string> {
    const { data, error } = await this.client.rpc('create_public_notification_link', {
      p_classification: classification,
      p_process: process,
    });
    if (error) throw error;
    return data;
  }

  async publicForm(token: string) {
    const { data, error } = await this.client.rpc('read_public_notification_form', {
      p_token: token,
    });
    if (error) throw error;
    return data;
  }

  async submitPublic(token: string, payload: Record<string, unknown>): Promise<string> {
    const { data, error } = await this.client.rpc('submit_public_notification', {
      p_token: token,
      p_payload: payload,
    });
    if (error) throw error;
    return data;
  }

  async fetchStatuses(): Promise<TicketStatusOption[]> {
    const { data, error } = await this.client
      .from('ticket_statuses')
      .select('*')
      .order('order_index')
      .order('key');
    if (error) throw error;
    return data;
  }

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
