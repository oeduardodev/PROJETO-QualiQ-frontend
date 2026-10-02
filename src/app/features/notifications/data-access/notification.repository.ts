import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type { NotificationClassification, NotificationType } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class NotificationRepository {
  private readonly client = inject(SupabaseService).client;

  fetchNotificationClassifications(): Promise<NotificationClassification[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('notification_classifications')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  async createNotificationClassification(
    input: Partial<Omit<NotificationClassification, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<NotificationClassification> {
    const { data, error } = await this.client
      .from('notification_classifications')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async updateNotificationClassification(
    id: string,
    patch: Partial<Omit<NotificationClassification, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<NotificationClassification> {
    const { data, error } = await this.client
      .from('notification_classifications')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteNotificationClassification(id: string): Promise<void> {
    const { error } = await this.client.from('notification_classifications').delete().eq('id', id);
    if (error) throw error;
  }

  fetchNotificationTypes(): Promise<NotificationType[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('notification_types')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  async createNotificationType(
    input: Partial<Omit<NotificationType, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<NotificationType> {
    const { data, error } = await this.client
      .from('notification_types')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async updateNotificationType(
    id: string,
    patch: Partial<Omit<NotificationType, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<NotificationType> {
    const { data, error } = await this.client
      .from('notification_types')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async deleteNotificationType(id: string): Promise<void> {
    const { error } = await this.client.from('notification_types').delete().eq('id', id);
    if (error) throw error;
  }
}
