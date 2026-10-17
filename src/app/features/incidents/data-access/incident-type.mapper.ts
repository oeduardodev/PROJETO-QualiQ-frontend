import type { IncidentSeverity, IncidentClassification, IncidentType } from '@core/models/database';

export interface IncidentTypeFormValue {
  name: string;
  code: string;
  classification_id: string;
  default_severity: IncidentSeverity;
  sla_hours: number | null;
  sla_id: string;
  risk_id: string;
  active: boolean;
}

export function toIncidentTypePayload(
  value: IncidentTypeFormValue,
  classification: IncidentClassification | undefined,
): Partial<IncidentType> {
  return {
    ...value,
    code: value.code || null,
    classification_id: value.classification_id || null,
    sla_id: value.sla_id || null,
    risk_id: value.risk_id || null,
    requires_root_cause: classification?.requires_root_cause ?? false,
    analysis_tool: classification?.analysis_tool,
  };
}
