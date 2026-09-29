import type { Process } from '@core/models/database';

export interface ProcessFormValue {
  title: string;
  code: string;
  category_id: string;
  owner: string;
  impact_score: number;
  complexity_score: number;
  maturity_level: number;
}

export function toProcessPayload(value: ProcessFormValue): Partial<Process> {
  return {
    ...value,
    title: value.title.trim(),
    code: value.code.trim() || null,
    owner: value.owner.trim() || null,
  };
}
