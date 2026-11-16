import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type {
  DashboardIdentity,
  DashboardPost,
  DashboardScheduledPlan,
  IndicatorHistoryEntry,
  Profile,
} from '@core/models/database';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';

@Injectable({ providedIn: 'root' })
export class DashboardRepository {
  private readonly client = inject(SupabaseService).client;

  async fetchPosts(): Promise<DashboardPost[]> {
    const { data, error } = await this.client
      .from('dashboard_posts')
      .select('*')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(40);
    if (error) throw error;
    return data;
  }

  async fetchIdentity(): Promise<DashboardIdentity | null> {
    const { data, error } = await this.client
      .from('strategic_identity')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async fetchBirthdays(): Promise<Profile[]> {
    const { data, error } = await this.client
      .from('profiles')
      .select('id,name,short_name,birth_date,is_active,role,category_id,created_at')
      .eq('is_active', true)
      .not('birth_date', 'is', null)
      .order('name');
    if (error) throw error;
    return data as Profile[];
  }

  async fetchCompanyName(establishmentId: string): Promise<string> {
    const { data, error } = await this.client
      .from('establishments')
      .select('name')
      .eq('id', establishmentId)
      .maybeSingle();
    if (error) throw error;
    return data?.name ?? '';
  }

  async fetchScheduledPlans(): Promise<DashboardScheduledPlan[]> {
    const { data, error } = await this.client.rpc('dashboard_action_schedule');
    if (error) throw error;
    return data;
  }

  async fetchRecentIndicatorHistory(
    fromMonth: string,
    untilMonth: string,
  ): Promise<IndicatorHistoryEntry[]> {
    const dated = fetchAllPages((from, to) =>
      this.client
        .from('indicator_history')
        .select('*')
        .gte('period_date', `${fromMonth}-01`)
        .lt('period_date', `${untilMonth}-01`)
        .order('period_date', { ascending: false })
        .order('id')
        .range(from, to),
    );
    const legacy = fetchAllPages((from, to) =>
      this.client
        .from('indicator_history')
        .select('*')
        .is('period_date', null)
        .gte('period', `${fromMonth}-01`)
        .lt('period', `${untilMonth}-01`)
        .order('period', { ascending: false })
        .order('id')
        .range(from, to),
    );
    const [currentEntries, legacyEntries] = await Promise.all([dated, legacy]);
    return [...currentEntries, ...legacyEntries];
  }

  async savePost(
    input: Pick<DashboardPost, 'kind' | 'title' | 'body' | 'expires_at'>,
    id?: string,
  ): Promise<void> {
    const result = id
      ? await this.client.from('dashboard_posts').update(input).eq('id', id)
      : await this.client.from('dashboard_posts').insert(input);
    if (result.error) throw result.error;
  }

  async deletePost(id: string): Promise<void> {
    const { error } = await this.client.from('dashboard_posts').delete().eq('id', id);
    if (error) throw error;
  }

  async saveIdentity(
    input: Pick<DashboardIdentity, 'mission' | 'vision' | 'values' | 'logo_url'>,
  ): Promise<DashboardIdentity> {
    const { data, error } = await this.client.rpc('save_dashboard_identity', {
      p_mission: input.mission ?? '',
      p_vision: input.vision ?? '',
      p_values: input.values ?? '',
      p_logo_url: input.logo_url ?? '',
    });
    if (error) throw error;
    return data;
  }
}
