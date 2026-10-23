import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { Profile } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class ProfileRepository {
  private readonly client = inject(SupabaseService).client;

  async findById(id: string): Promise<Profile | null> {
    // These columns exist before and after the user-management migration.
    // Login must remain available while the Edge Function is being deployed.
    const { data: basicProfile, error } = await this.client
      .from('profiles')
      .select('id,name,role,category_id,created_at')
      .eq('id', id)
      .maybeSingle();
    if (error || !basicProfile) return null;

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, 2500);
    });
    try {
      const result = await Promise.race([
        this.client.functions.invoke<Profile>('user-management', {
          body: { action: 'get_self' },
          signal: controller.signal,
        }),
        timeout,
      ]);
      return result && !result.error && result.data
        ? result.data
        : this.restrictedFallback(basicProfile as Profile);
    } catch {
      return this.restrictedFallback(basicProfile as Profile);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private restrictedFallback(profile: Profile): Profile {
    return {
      ...profile,
      custom_role_id: 'profile-unavailable',
      module_access: [],
      edit_access: [],
    };
  }

  async findAll(): Promise<Profile[]> {
    const { data, error } = await this.client
      .from('profiles')
      .select('id,name,short_name,role,category_id,created_at,is_active')
      .eq('is_active', true)
      .order('name');
    if (error) {
      const { data: legacyData } = await this.client
        .from('profiles')
        .select('id,name,role,category_id,created_at')
        .order('name');
      return (legacyData as Profile[]) ?? [];
    }
    // Existing consumers tolerate a profiles query error and display fallback names.
    return (data as Profile[]) ?? [];
  }

  async findAssignableUsers(): Promise<Profile[]> {
    const { data, error } = await this.client
      .from('profiles')
      .select('id,name,short_name,role,category_id,created_at,is_active')
      .eq('is_active', true)
      .order('name');
    if (error) {
      const { data: legacyData, error: legacyError } = await this.client
        .from('profiles')
        .select('id,name,role,category_id,created_at')
        .order('name');
      if (legacyError) throw legacyError;
      return legacyData as Profile[];
    }
    return data as Profile[];
  }
}
