import type { ActionPlanStatus } from '@core/models/database';

export const ACTION_PLAN_STATUS_SEQUENCE: readonly [ActionPlanStatus, ...ActionPlanStatus[]] = [
  'pendente',
  'andamento',
  'concluido',
];
