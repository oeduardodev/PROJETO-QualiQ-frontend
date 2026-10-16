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
  owner_id: string;
  justification: string;
}

export function toRiskPayload(value: RiskFormValue): Partial<Risk> {
  return {
    title: value.title,
    description: value.description || null,
    process_id: value.process_id,
    step_id: value.step_id || null,
    probability: value.probability,
    impact: value.impact,
    risk_type: value.risk_type,
    barriers: value.barriers || null,
    status: value.status,
    owner_id: value.owner_id && value.owner_id !== 'legacy' ? value.owner_id : null,
  };
}
