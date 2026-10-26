import type {
  HelpdeskCategory,
  HelpdeskStatus,
  HelpdeskPriority,
  HelpdeskTicket,
} from '@core/models/database';

export interface HelpdeskTicketFormValue {
  title: string;
  description: string;
  category: HelpdeskCategory;
  status: HelpdeskStatus;
  priority: HelpdeskPriority;
  requester_id: string;
  requester_name: string | null;
  assigned_to: string;
  process_id: string;
}

export function toHelpdeskTicketPayload(value: HelpdeskTicketFormValue): Partial<HelpdeskTicket> {
  return {
    ...value,
    description: value.description || null,
    requester_id: value.requester_id || null,
    requester_name: value.requester_name || null,
    assigned_to: value.assigned_to || null,
    process_id: value.process_id || null,
    custom_fields: null,
  };
}
