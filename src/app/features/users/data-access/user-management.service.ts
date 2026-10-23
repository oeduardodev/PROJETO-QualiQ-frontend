import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { CustomRole, Profile } from '@core/models/database';

export interface UserManagementPayload {
  action: 'create' | 'update' | 'update_self' | 'create_role' | 'update_role';
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
  edit_access?: string[];
  custom_role_id?: string | null;
  avatar_path?: string | null;
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

  async listRoles(): Promise<CustomRole[]> {
    const { data, error } = await this.client.functions.invoke<{ roles: CustomRole[] }>(
      'user-management',
      { body: { action: 'list_roles' } },
    );
    if (error) throw new Error(error.message);
    return data?.roles ?? [];
  }

  async saveRole(role: Omit<CustomRole, 'id'> & { id?: string }): Promise<string> {
    const result = await this.save({
      action: role.id ? 'update_role' : 'create_role',
      ...role,
    });
    if (!result.id) throw new Error('Não foi possível identificar o cargo salvo.');
    return result.id;
  }

  async uploadAvatar(userId: string, file: File): Promise<string> {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extension = extensions[file.type];
    if (!extension || file.size > 2 * 1024 * 1024 || file.size === 0) {
      throw new Error('Selecione uma imagem JPG, PNG ou WebP de até 2 MB.');
    }
    const path = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await this.client.storage.from('profile-avatars').upload(path, file, {
      contentType: file.type,
    });
    if (error) throw error;
    return path;
  }

  async removeAvatar(path: string): Promise<void> {
    await this.client.storage.from('profile-avatars').remove([path]);
  }

  avatarUrl(path: string | null | undefined): string | null {
    return path
      ? this.client.storage.from('profile-avatars').getPublicUrl(path).data.publicUrl
      : null;
  }

  async save(
    payload: UserManagementPayload & { name?: string; description?: string },
  ): Promise<{ id?: string }> {
    const { data, error } = await this.client.functions.invoke<{ error?: string; id?: string }>(
      'user-management',
      { body: payload },
    );
    if (!error) {
      if (data?.error) throw new Error(data.error);
      return data ?? {};
    }
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
