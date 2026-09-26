import type { NotificationType, Ticket } from '@core/models/database';
import { toNotificationTicketPayload } from './notification-ticket.mapper';

describe('toNotificationTicketPayload', () => {
  const form = {
    title: 'Ocorrência',
    description: '',
    process_id: 'process-1',
    step_id: '',
    status: 'aberto' as const,
    severity: 'media' as const,
    incident_datetime: '',
    risk_id: '',
    sla_id: '',
    notification_type_id: 'type-1',
  };
  const notificationType = {
    id: 'type-1',
    name: 'Incidente',
    risk_id: 'risk-default',
    sla_id: 'sla-default',
  } as NotificationType;

  it('applies the notification type defaults and nullable fields', () => {
    expect(toNotificationTicketPayload(form, notificationType, {}, 'Incidentes')).toMatchObject({
      description: null,
      step_id: null,
      risk_id: 'risk-default',
      sla_id: 'sla-default',
      notification_type_id: 'type-1',
      incident_datetime: null,
      classification_flag: 'Incidentes',
      incident_type: 'Incidente',
      free_description: null,
      analysis_completed: false,
      custom_fields: {},
    });
  });

  it('keeps explicit selections and dynamic field values', () => {
    expect(
      toNotificationTicketPayload(
        { ...form, risk_id: 'risk-selected', sla_id: 'sla-selected' },
        notificationType,
        { origem: 'Portal' },
        'Incidentes',
      ),
    ).toMatchObject({
      risk_id: 'risk-selected',
      sla_id: 'sla-selected',
      custom_fields: { origem: 'Portal' },
    });
  });

  it('preserves an existing analysis when editing a ticket', () => {
    const existing = { analysis_completed: true } as Ticket;
    expect(
      toNotificationTicketPayload(form, notificationType, {}, 'Incidentes', existing),
    ).toMatchObject({ analysis_completed: true, custom_fields: {} });
  });
});
