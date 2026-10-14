import type { Process } from '@core/models/database';
import { normalizeProcessTag } from './process-code.utils';

export interface ProcessFormValue {
  title: string;
  tag: string;
  category_id: string;
  owner: string;
  impact_score: number;
  complexity_score: number;
  maturity_level: number;
}

export function toProcessPayload(value: ProcessFormValue): Partial<Process> {
  return {
    title: value.title.trim(),
    code: normalizeProcessTag(value.tag) ?? '',
    category_id: value.category_id,
    owner: value.owner.trim() || null,
    impact_score: value.impact_score,
    complexity_score: value.complexity_score,
    maturity_level: value.maturity_level,
  };
}
