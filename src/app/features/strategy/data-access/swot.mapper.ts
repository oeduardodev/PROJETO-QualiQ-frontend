import type { SwotAnalysis, SwotItem, SwotQuadrant, SwotStatus } from '@core/models/database';

export interface SwotAnalysisFormValue {
  title: string;
  period: string;
  description: string;
  status: SwotStatus;
  order_index: number;
}

export interface SwotItemFormValue {
  analysis_id: string;
  quadrant: SwotQuadrant;
  title: string;
  description: string;
  order_index: number;
}

export function toSwotAnalysisPayload(value: SwotAnalysisFormValue): Partial<SwotAnalysis> {
  return {
    title: value.title.trim(),
    period: value.period.trim() || null,
    description: value.description.trim() || null,
    status: value.status,
    order_index: value.order_index,
  };
}

export function toSwotItemPayload(value: SwotItemFormValue): Partial<SwotItem> {
  return {
    analysis_id: value.analysis_id,
    quadrant: value.quadrant,
    title: value.title.trim(),
    description: value.description.trim() || null,
    order_index: value.order_index,
  };
}
