import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type {
  Dimension,
  DimensionItemType,
  DimensionLink,
  DimensionVersion,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class DimensionRepository {
  private readonly client = inject(SupabaseService).client;

  fetchVersions(): Promise<DimensionVersion[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('dimension_versions')
        .select('*')
        .order('version_number', { ascending: false })
        .range(from, to),
    );
  }

  async createVersion(label: string): Promise<DimensionVersion> {
    const { data, error } = await this.client
      .rpc('create_dimension_version', { p_label: label })
      .single();
    if (error) throw error;
    return data;
  }

  async saveWithLinks(input: {
    id: string | null;
    versionId: string;
    name: string;
    description: string;
    objective: string;
    classificationKey: string;
    colorKey: string;
    orderIndex: number;
    indicatorIds: string[];
    planIds: string[];
  }): Promise<Dimension> {
    const { data, error } = await this.client
      .rpc('save_dimension_with_links', {
        p_id: input.id,
        p_version_id: input.versionId,
        p_name: input.name,
        p_description: input.description,
        p_objective: input.objective,
        p_classification_key: input.classificationKey,
        p_color_key: input.colorKey,
        p_order_index: input.orderIndex,
        p_indicator_ids: input.indicatorIds,
        p_plan_ids: input.planIds,
      })
      .single();
    if (error) throw error;
    return data;
  }

  async fetchDimensions(versionId?: string): Promise<Dimension[]> {
    const selectedId = versionId ?? (await this.fetchVersions())[0]?.id;
    if (!selectedId) return [];
    return fetchAllPages((from, to) =>
      this.client
        .from('dimensions')
        .select('*')
        .eq('version_id', selectedId)
        .order('order_index')
        .order('id')
        .range(from, to),
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

  async fetchAllDimensionLinks(versionId?: string): Promise<DimensionLink[]> {
    const selectedId = versionId ?? (await this.fetchVersions())[0]?.id;
    if (!selectedId) return [];
    return fetchAllPages((from, to) =>
      this.client
        .from('dimension_links')
        .select('*')
        .eq('version_id', selectedId)
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
