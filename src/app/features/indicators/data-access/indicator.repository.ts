import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { Indicator, IndicatorHistoryEntry } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class IndicatorRepository {
  async recordValue(id: string, period: string, value: number): Promise<Indicator> {
    const { data, error } = await this.client
      .rpc('record_indicator_value', {
        p_indicator_id: id,
        p_period: period,
        p_value: value,
      })
      .single();
    if (error) throw error;
    return data;
  }

  async insertHistory(
    entry: Pick<IndicatorHistoryEntry, 'indicator_id' | 'period' | 'value' | 'goal'>,
  ): Promise<void> {
    const { error } = await this.client.from('indicator_history').insert(entry);
    if (error) throw error;
  }

  private readonly client = inject(SupabaseService).client;

  async fetchIndicators(): Promise<Indicator[]> {
    const { data, error } = await this.client
      .from('indicators')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async createIndicator(
    input: Partial<Omit<Indicator, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Indicator> {
    const { data, error } = await this.client.from('indicators').insert(input).select('*').single();
    if (error) throw error;
    return data;
  }

  async updateIndicator(
    id: string,
    patch: Partial<Omit<Indicator, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Indicator> {
    const { data, error } = await this.client
      .from('indicators')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteIndicator(id: string): Promise<void> {
    const { error } = await this.client.from('indicators').delete().eq('id', id);
    if (error) throw error;
  }

  async fetchIndicatorHistory(indicatorId: string): Promise<IndicatorHistoryEntry[]> {
    const { data, error } = await this.client
      .from('indicator_history')
      .select('*')
      .eq('indicator_id', indicatorId)
      .order('created_at');
    if (error) throw error;
    return data ?? [];
  }

  async fetchIndicatorsByProcess(processId: string): Promise<Indicator[]> {
    const { data, error } = await this.client
      .from('indicators')
      .select('*')
      .eq('process_id', processId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async fetchIndicatorsByStep(stepId: string): Promise<Indicator[]> {
    const { data, error } = await this.client
      .from('indicators')
      .select('*')
      .eq('step_id', stepId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
}
