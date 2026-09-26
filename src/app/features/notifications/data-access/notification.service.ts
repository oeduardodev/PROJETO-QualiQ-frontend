import { inject, Injectable } from '@angular/core';
import { NotificationRepository } from './notification.repository';
import type { NotificationClassification, NotificationType } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly repository = inject(NotificationRepository);

  fetchNotificationClassifications(): Promise<NotificationClassification[]> {
    return this.repository.fetchNotificationClassifications();
  }

  createNotificationClassification(
    input: Partial<Omit<NotificationClassification, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<NotificationClassification> {
    return this.repository.createNotificationClassification(input);
  }

  updateNotificationClassification(
    id: string,
    patch: Partial<Omit<NotificationClassification, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<NotificationClassification> {
    return this.repository.updateNotificationClassification(id, patch);
  }

  deleteNotificationClassification(id: string): Promise<void> {
    return this.repository.deleteNotificationClassification(id);
  }

  fetchNotificationTypes(): Promise<NotificationType[]> {
    return this.repository.fetchNotificationTypes();
  }

  createNotificationType(
    input: Partial<Omit<NotificationType, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<NotificationType> {
    return this.repository.createNotificationType(input);
  }

  updateNotificationType(
    id: string,
    patch: Partial<Omit<NotificationType, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<NotificationType> {
    return this.repository.updateNotificationType(id, patch);
  }

  deleteNotificationType(id: string): Promise<void> {
    return this.repository.deleteNotificationType(id);
  }
}
