import type {
  NotificationSeverity,
  AnalysisTool,
  NotificationClassification,
} from '@core/models/database';

export interface NotificationClassificationFormValue {
  name: string;
  code: string;
  default_severity: NotificationSeverity;
  sla_hours: number | null;
  analysis_tool: AnalysisTool;
  requires_root_cause: boolean;
  active: boolean;
}

export function toNotificationClassificationPayload(
  value: NotificationClassificationFormValue,
): Partial<NotificationClassification> {
  return { ...value, code: value.code || null };
}
