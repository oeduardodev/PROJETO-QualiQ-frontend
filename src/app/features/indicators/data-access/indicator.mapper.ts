import type {
  IndicatorFrequency,
  IndicatorStatus,
  IndicatorUnitType,
  Indicator,
} from '@core/models/database';

export interface IndicatorFormValue {
  title: string;
  process_id: string;
  step_id: string;
  goal_value: number;
  unit: IndicatorUnitType;
  current_value: number;
  frequency: IndicatorFrequency;
  status: IndicatorStatus;
  requires_critical_analysis: boolean;
  indicator_type: string;
  goal_direction: 'higher' | 'lower';
}

export function toIndicatorPayload(value: IndicatorFormValue): Partial<Indicator> {
  return {
    ...value,
    step_id: value.step_id || null,
    indicator_type: value.indicator_type.trim() || 'Não informado',
  };
}
