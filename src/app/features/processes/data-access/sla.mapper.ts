import type { SlaCriticality, SlaStatus, SLA } from '@core/models/database';

export interface SlaFormValue {
  title: string;
  supplier_process_id: string;
  client_process_id: string;
  sipoc_input_id: string;
  lead_time_hours: number;
  quality_criteria: string;
  criticality: SlaCriticality | '';
  status: SlaStatus;
}

export function toSlaPayload(value: SlaFormValue): Partial<SLA> {
  return {
    title: value.title,
    supplier_process_id: value.supplier_process_id || null,
    client_process_id: value.client_process_id || null,
    sipoc_input_id: value.sipoc_input_id || null,
    lead_time_hours: value.lead_time_hours,
    quality_criteria: value.quality_criteria || null,
    criticality: value.criticality || null,
    status: value.status,
  };
}
