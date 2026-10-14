import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { Profile } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class ProfileRepository {
  private readonly client = inject(SupabaseService).client;

  async findById(id: string): Promise<Profile | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return error ? null : (data as Profile | null);
  }

  async findAll(): Promise<Profile[]> {
    const { data } = await this.client.from('profiles').select('*').order('name');
    // Existing consumers tolerate a profiles query error and display fallback names.
    return (data as Profile[]) ?? [];
  }

  async findAssignableUsers(): Promise<Profile[]> {
    const { data, error } = await this.client.from('profiles').select('*').order('name');
    if (error) throw error;
    return data as Profile[];
  }
}
