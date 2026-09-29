import type { SlaStatus, SLA } from '@core/models/database';

export interface SlaFormValue {
  title: string;
  supplier_process_id: string;
  client_process_id: string;
  sipoc_input_id: string;
  lead_time_hours: number;
  quality_criteria: string;
  status: SlaStatus;
}

export function toSlaPayload(value: SlaFormValue): Partial<SLA> {
  return {
    ...value,
    supplier_process_id: value.supplier_process_id || null,
    client_process_id: value.client_process_id || null,
    sipoc_input_id: value.sipoc_input_id || null,
    quality_criteria: value.quality_criteria || null,
  };
}
