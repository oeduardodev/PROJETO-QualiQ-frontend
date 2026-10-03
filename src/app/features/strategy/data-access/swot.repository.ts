import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type { SwotAnalysis, SwotItem } from '@core/models/database';

export type SwotAnalysisInput = Partial<Omit<SwotAnalysis, 'id' | 'created_at' | 'updated_at'>>;
export type SwotItemInput = Partial<Omit<SwotItem, 'id' | 'created_at' | 'updated_at'>>;

@Injectable({ providedIn: 'root' })
export class SwotRepository {
  private readonly client = inject(SupabaseService).client;

  fetchAnalyses(): Promise<SwotAnalysis[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('swot_analyses')
        .select('*')
        .order('order_index')
        .order('id')
        .range(from, to),
    );
  }

  async createAnalysis(input: SwotAnalysisInput): Promise<SwotAnalysis> {
    const { data, error } = await this.client
      .from('swot_analyses')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async updateAnalysis(id: string, patch: SwotAnalysisInput): Promise<SwotAnalysis> {
    const { data, error } = await this.client
      .from('swot_analyses')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteAnalysis(id: string): Promise<void> {
    const { error } = await this.client.from('swot_analyses').delete().eq('id', id);
    if (error) throw error;
  }

  fetchItems(analysisId: string): Promise<SwotItem[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('swot_items')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('order_index')
        .order('id')
        .range(from, to),
    );
  }

  fetchAllItems(): Promise<SwotItem[]> {
    return fetchAllPages((from, to) =>
      this.client.from('swot_items').select('*').order('id').range(from, to),
    );
  }

  async createItem(input: SwotItemInput): Promise<SwotItem> {
    const { data, error } = await this.client.from('swot_items').insert(input).select('*').single();
    if (error) throw error;
    return data;
  }

  async updateItem(id: string, patch: SwotItemInput): Promise<SwotItem> {
    const { data, error } = await this.client
      .from('swot_items')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteItem(id: string): Promise<void> {
    const { error } = await this.client.from('swot_items').delete().eq('id', id);
    if (error) throw error;
  }
}
