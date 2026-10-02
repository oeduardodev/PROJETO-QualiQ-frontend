import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type { Dimension, DimensionItemType, DimensionLink } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class DimensionRepository {
  private readonly client = inject(SupabaseService).client;

  fetchDimensions(): Promise<Dimension[]> {
    return fetchAllPages((from, to) =>
      this.client.from('dimensions').select('*').order('order_index').order('id').range(from, to),
    );
  }

  async createDimension(
    input: Partial<Omit<Dimension, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Dimension> {
    const { data, error } = await this.client.from('dimensions').insert(input).select('*').single();
    if (error) throw error;
    return data;
  }

  async updateDimension(
    id: string,
    patch: Partial<Omit<Dimension, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Dimension> {
    const { data, error } = await this.client
      .from('dimensions')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteDimension(id: string): Promise<void> {
    const { error } = await this.client.from('dimensions').delete().eq('id', id);
    if (error) throw error;
  }

  fetchDimensionLinks(dimensionId: string): Promise<DimensionLink[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('dimension_links')
        .select('*')
        .eq('dimension_id', dimensionId)
        .order('created_at')
        .order('id')
        .range(from, to),
    );
  }

  fetchAllDimensionLinks(): Promise<DimensionLink[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('dimension_links')
        .select('*')
        .order('created_at')
        .order('id')
        .range(from, to),
    );
  }

  async createDimensionLink(input: {
    dimension_id: string;
    item_type: DimensionItemType;
    item_id: string;
    process_id: string;
  }): Promise<void> {
    const { error } = await this.client.from('dimension_links').insert(input);
    if (error) throw error;
  }

  async deleteDimensionLink(
    dimensionId: string,
    itemType: DimensionItemType,
    itemId: string,
  ): Promise<void> {
    const { error } = await this.client
      .from('dimension_links')
      .delete()
      .eq('dimension_id', dimensionId)
      .eq('item_type', itemType)
      .eq('item_id', itemId);
    if (error) throw error;
  }
}
