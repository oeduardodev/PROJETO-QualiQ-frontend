import type { RiskStatus, RiskType, Risk } from '@core/models/database';

export interface RiskFormValue {
  title: string;
  description: string;
  process_id: string;
  step_id: string;
  probability: number;
  impact: number;
  risk_type: RiskType;
  barriers: string;
  status: RiskStatus;
  owner: string;
}

export function toRiskPayload(value: RiskFormValue): Partial<Risk> {
  return {
    ...value,
    description: value.description || null,
    step_id: value.step_id || null,
    barriers: value.barriers || null,
    owner: value.owner || null,
  };
}
