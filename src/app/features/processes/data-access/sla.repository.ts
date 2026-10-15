import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type { SLA, SlaApproval, SlaHistory, SlaStatusOption } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class SlaRepository {
  private readonly client = inject(SupabaseService).client;

  async fetchStatuses(): Promise<SlaStatusOption[]> {
    const { data, error } = await this.client
      .from('sla_statuses')
      .select('*')
      .order('order_index')
      .order('key');
    if (error) throw error;
    return data;
  }

  fetchSlas(): Promise<SLA[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('slas')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  fetchSlasByProcess(processId: string): Promise<SLA[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('slas')
        .select('*')
        .or(`supplier_process_id.eq.${processId},client_process_id.eq.${processId}`)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  async createSla(input: Record<string, unknown>): Promise<SLA> {
    const { data, error } = await this.client.rpc('create_sla_draft', { p_payload: input });
    if (error) throw error;
    return data;
  }

  async updateSla(id: string, patch: Record<string, unknown>, justification: string): Promise<SLA> {
    const { data, error } = await this.client.rpc('update_sla_with_reason', {
      p_id: id,
      p_patch: patch,
      p_justification: justification,
    });
    if (error) throw error;
    return data;
  }

  fetchSlaHistory(id: string): Promise<SlaHistory[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('sla_history')
        .select('*')
        .eq('sla_id', id)
        .order('changed_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  fetchApprovals(): Promise<SlaApproval[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('sla_approvals')
        .select('*')
        .order('requested_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  async activateSla(id: string): Promise<SLA> {
    const { data, error } = await this.client.rpc('activate_sla', { p_id: id });
    if (error) throw error;
    return data;
  }

  async decideApproval(id: string, approve: boolean, reason: string): Promise<SLA> {
    const { data, error } = await this.client.rpc('decide_sla_approval', {
      p_id: id,
      p_approve: approve,
      p_reason: reason,
    });
    if (error) throw error;
    return data;
  }

  async deactivate(id: string, reason: string): Promise<SLA> {
    const { data, error } = await this.client.rpc('deactivate_sla', { p_id: id, p_reason: reason });
    if (error) throw error;
    return data;
  }
}
