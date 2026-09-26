import type { TicketStatus, TicketSeverity, Ticket, NotificationType } from '@core/models/database';

export interface NotificationTicketFormValue {
  title: string;
  description: string;
  process_id: string;
  step_id: string;
  status: TicketStatus;
  severity: TicketSeverity;
  incident_datetime: string;
  risk_id: string;
  sla_id: string;
  notification_type_id: string;
}

export function toNotificationTicketPayload(
  value: NotificationTicketFormValue,
  notificationType: NotificationType | undefined,
  customFields: Record<string, unknown>,
  classificationName: string | null,
  existingTicket?: Ticket,
): Partial<Ticket> {
  return {
    ...value,
    description: value.description || null,
    step_id: value.step_id || null,
    risk_id: value.risk_id || notificationType?.risk_id || null,
    sla_id: value.sla_id || notificationType?.sla_id || null,
    notification_type_id: value.notification_type_id || null,
    incident_datetime: value.incident_datetime || null,
    classification_flag: notificationType ? classificationName : null,
    incident_type: notificationType?.name ?? null,
    free_description: value.description || null,
    analysis_completed: existingTicket?.analysis_completed ?? false,
    custom_fields: customFields,
  };
}
