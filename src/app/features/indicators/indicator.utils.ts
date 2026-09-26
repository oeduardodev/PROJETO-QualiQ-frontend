import type { IndicatorStatus } from '@core/models/database';

const WARNING_GOAL_RATIO = 0.8;

export function indicatorStatus(value: number, goal: number): IndicatorStatus {
  if (value >= goal) return 'no_alvo';

  if (value >= goal * WARNING_GOAL_RATIO) return 'atencao';

  return 'critico';
}
