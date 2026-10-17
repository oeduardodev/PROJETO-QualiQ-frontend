import type { IncidentSeverity, AnalysisTool, IncidentClassification } from '@core/models/database';

export interface IncidentClassificationFormValue {
  name: string;
  code: string;
  default_severity: IncidentSeverity;
  sla_hours: number | null;
  analysis_tool: AnalysisTool;
  requires_root_cause: boolean;
  active: boolean;
}

export function toIncidentClassificationPayload(
  value: IncidentClassificationFormValue,
): Partial<IncidentClassification> {
  return { ...value, code: value.code || null };
}
