import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type {
  AnalysisToolOption,
  IncidentClassification,
  IncidentSeverityOption,
  IncidentType,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class IncidentRepository {
  private readonly client = inject(SupabaseService).client;

  async fetchAnalysisTools(): Promise<AnalysisToolOption[]> {
    const { data, error } = await this.client
      .from('analysis_tools')
      .select('*')
      .order('order_index')
      .order('key');
    if (error) throw error;
    return data;
  }

  async fetchIncidentSeverities(): Promise<IncidentSeverityOption[]> {
    const { data, error } = await this.client
      .from('notification_severities')
      .select('*')
      .order('order_index')
      .order('key');
    if (error) throw error;
    return data;
  }

  fetchIncidentClassifications(): Promise<IncidentClassification[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('notification_classifications')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  async createIncidentClassification(
    input: Partial<Omit<IncidentClassification, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<IncidentClassification> {
    const { data, error } = await this.client
      .from('notification_classifications')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async updateIncidentClassification(
    id: string,
    patch: Partial<Omit<IncidentClassification, 'id' | 'created_at' | 'updated_at'>>,
    justification?: string,
  ): Promise<IncidentClassification> {
    if (justification !== undefined) {
      const { data, error } = await this.client.rpc('update_audited_record', {
        p_entity: 'notification_classifications',
        p_id: id,
        p_patch: patch,
        p_justification: justification,
      });
      if (error) throw error;
      return data as unknown as IncidentClassification;
    }
    const { data, error } = await this.client
      .from('notification_classifications')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteIncidentClassification(id: string): Promise<void> {
    const { error } = await this.client.from('notification_classifications').delete().eq('id', id);
    if (error) throw error;
  }

  fetchIncidentTypes(): Promise<IncidentType[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('notification_types')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  async createIncidentType(
    input: Partial<Omit<IncidentType, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<IncidentType> {
    const { data, error } = await this.client
      .from('notification_types')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async updateIncidentType(
    id: string,
    patch: Partial<Omit<IncidentType, 'id' | 'created_at' | 'updated_at'>>,
    justification?: string,
  ): Promise<IncidentType> {
    if (justification !== undefined) {
      const { data, error } = await this.client.rpc('update_audited_record', {
        p_entity: 'notification_types',
        p_id: id,
        p_patch: patch,
        p_justification: justification,
      });
      if (error) throw error;
      return data as unknown as IncidentType;
    }
    const { data, error } = await this.client
      .from('notification_types')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteIncidentType(id: string): Promise<void> {
    const { error } = await this.client.from('notification_types').delete().eq('id', id);
    if (error) throw error;
  }
}
