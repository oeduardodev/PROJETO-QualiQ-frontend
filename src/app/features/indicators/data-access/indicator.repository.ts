import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type {
  Indicator,
  IndicatorDefinitionHistory,
  IndicatorFrequencyOption,
  IndicatorHistoryEntry,
  IndicatorStatusOption,
  IndicatorUnitOption,
} from '@core/models/database';
import type { AppDatabase } from '@core/models/database';

export type SaveIndicatorDefinitionInput =
  AppDatabase['public']['Functions']['save_indicator_definition']['Args'];

@Injectable({ providedIn: 'root' })
export class IndicatorRepository {
  async fetchResultActors(): Promise<Record<string, string>> {
    const { data, error } = await this.client.rpc('indicator_result_actors');
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((actor) => [actor.id, actor.name]));
  }

  async fetchStatusOptions(): Promise<IndicatorStatusOption[]> {
    const { data, error } = await this.client
      .from('indicator_statuses')
      .select('*')
      .order('order_index')
      .order('key');
    if (error) throw error;
    return data;
  }

  async fetchUnitOptions(): Promise<IndicatorUnitOption[]> {
    const { data, error } = await this.client.rpc('get_indicator_unit_options');
    if (error) throw error;
    return data;
  }

  async fetchFrequencyOptions(): Promise<IndicatorFrequencyOption[]> {
    const { data, error } = await this.client.rpc('get_indicator_frequency_options');
    if (error) throw error;
    return data;
  }

  async recordValue(
    id: string,
    period: string,
    value: number,
    lateJustification: string,
    analysis: string,
  ): Promise<{ indicator: Indicator; history: IndicatorHistoryEntry }> {
    const { data, error } = await this.client.rpc('record_indicator_result', {
      p_indicator_id: id,
      p_period: period,
      p_value: value,
      p_late_justification: lateJustification.trim() || null,
      p_analysis: analysis.trim() || null,
    });
    if (error) throw error;
    return data;
  }

  private readonly client = inject(SupabaseService).client;

  fetchIndicators(): Promise<Indicator[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('indicators')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  async saveDefinition(input: SaveIndicatorDefinitionInput): Promise<Indicator> {
    const { data, error } = await this.client.rpc('save_indicator_definition', input);
    if (error) throw error;
    return data;
  }

  fetchDefinitionHistory(indicatorId: string): Promise<IndicatorDefinitionHistory[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('indicator_definition_history')
        .select('*')
        .eq('indicator_id', indicatorId)
        .order('changed_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to),
    );
  }

  fetchIndicatorHistory(indicatorId: string): Promise<IndicatorHistoryEntry[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('indicator_history')
        .select('*')
        .eq('indicator_id', indicatorId)
        .order('created_at')
        .order('id')
        .range(from, to),
    );
  }

  async fetchHistories(indicatorIds: string[]): Promise<IndicatorHistoryEntry[]> {
    const batches: Promise<IndicatorHistoryEntry[]>[] = [];
    for (let index = 0; index < indicatorIds.length; index += 100) {
      const ids = indicatorIds.slice(index, index + 100);
      batches.push(
        fetchAllPages((from, to) =>
          this.client
            .from('indicator_history')
            .select('*')
            .in('indicator_id', ids)
            .order('created_at')
            .order('id')
            .range(from, to),
        ),
      );
    }
    return (await Promise.all(batches)).flat();
  }

  fetchIndicatorsByProcess(processId: string): Promise<Indicator[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('indicators')
        .select('*')
        .eq('process_id', processId)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  fetchIndicatorsByStep(stepId: string): Promise<Indicator[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('indicators')
        .select('*')
        .eq('step_id', stepId)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }
}
