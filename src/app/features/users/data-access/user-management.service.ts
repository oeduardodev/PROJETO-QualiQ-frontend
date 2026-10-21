import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { Profile } from '@core/models/database';

export interface UserManagementPayload {
  action: 'create' | 'update' | 'update_self';
  id?: string;
  name?: string;
  short_name?: string;
  registration_code?: string;
  birth_date?: string | null;
  email?: string;
  role?: string;
  category_id?: string | null;
  process_ids?: string[];
  module_access?: string[];
  is_active?: boolean;
  receive_email_alerts?: boolean;
  is_department_head?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UserManagementService {
  private readonly client = inject(SupabaseService).client;

  async listUsers(): Promise<Profile[]> {
    const { data, error } = await this.client.functions.invoke<{
      users: Profile[];
      error?: string;
    }>('user-management', { body: { action: 'list' } });
    if (error) throw new Error(error.message);
    return data?.users ?? [];
  }

  async save(payload: UserManagementPayload): Promise<void> {
    const { data, error } = await this.client.functions.invoke<{ error?: string }>(
      'user-management',
      { body: payload },
    );
    if (!error) return;
    const context = error.context;
    if (context instanceof Response) {
      try {
        const body = (await context.clone().json()) as { error?: string };
        throw new Error(body.error || error.message);
      } catch (bodyError) {
        if (bodyError instanceof Error && bodyError.message !== error.message) throw bodyError;
      }
    }
    throw new Error(data?.error || error.message);
  }
}
