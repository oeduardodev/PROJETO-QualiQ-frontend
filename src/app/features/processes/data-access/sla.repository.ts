import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { SLA } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class SlaRepository {
  private readonly client = inject(SupabaseService).client;

  async fetchSlas(): Promise<SLA[]> {
    const { data, error } = await this.client
      .from('slas')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async fetchSlasByProcess(processId: string): Promise<SLA[]> {
    const { data, error } = await this.client
      .from('slas')
      .select('*')
      .or(`supplier_process_id.eq.${processId},client_process_id.eq.${processId}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async createSla(input: Partial<Omit<SLA, 'id' | 'created_at' | 'updated_at'>>): Promise<SLA> {
    const { data, error } = await this.client.from('slas').insert(input).select('*').single();
    if (error) throw error;
    return data;
  }

  async updateSla(
    id: string,
    patch: Partial<Omit<SLA, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<SLA> {
    const { data, error } = await this.client
      .from('slas')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteSla(id: string): Promise<void> {
    const { error } = await this.client.from('slas').delete().eq('id', id);
    if (error) throw error;
  }
}
