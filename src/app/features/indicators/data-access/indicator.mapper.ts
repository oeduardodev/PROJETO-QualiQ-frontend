import type { IndicatorFrequency, IndicatorStatus, Indicator } from '@core/models/database';

export interface IndicatorFormValue {
  title: string;
  process_id: string;
  step_id: string;
  goal_value: number;
  unit: string;
  current_value: number;
  frequency: IndicatorFrequency;
  status: IndicatorStatus;
  requires_critical_analysis: boolean;
}

export function toIndicatorPayload(value: IndicatorFormValue): Partial<Indicator> {
  return { ...value, step_id: value.step_id || null };
}
