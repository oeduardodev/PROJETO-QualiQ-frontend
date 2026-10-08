import type { Process } from '@core/models/database';
import { normalizeProcessTag, processTag } from './process-code.utils';

export interface ProcessFormValue {
  title: string;
  tag: string;
  category_id: string;
  owner: string;
  impact_score: number;
  complexity_score: number;
  maturity_level: number;
}

export function toProcessPayload(
  value: ProcessFormValue,
  current?: Pick<Process, 'code'> | null,
): Partial<Process> {
  const tag = normalizeProcessTag(value.tag);
  const code = !tag && current?.code && !processTag(current.code) ? current.code : tag;
  return {
    title: value.title.trim(),
    code,
    category_id: value.category_id,
    owner: value.owner.trim() || null,
    impact_score: value.impact_score,
    complexity_score: value.complexity_score,
    maturity_level: value.maturity_level,
  };
}
