import type { SlaCriticality } from '@core/models/database';

export interface SlaFormValue {
  title: string;
  supplier_process_id: string;
  client_process_id: string;
  sipoc_input_id: string;
  description: string;
  business_rules: string;
  criticality: SlaCriticality | '';
  notification_type_ids: string[];
}

export function toSlaPayload(value: SlaFormValue): Record<string, unknown> {
  return {
    title: value.title.trim(),
    description: value.description.trim(),
    business_rules: value.business_rules.trim(),
    supplier_process_id: value.supplier_process_id,
    client_process_id: value.client_process_id,
    sipoc_input_id: value.sipoc_input_id || null,
    criticality: value.criticality,
    notification_type_ids: value.notification_type_ids,
  };
}
