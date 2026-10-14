import type { IndicatorActionPlanSuggestion } from '@core/models/database';

export type ActionPlanSuggestion = IndicatorActionPlanSuggestion;

export interface IndicatorAnalysis {
  diagnostic: string;
  suggestions: ActionPlanSuggestion[];
}

export interface IndicatorObservationContext {
  period: string;
  on_target: boolean;
  history: {
    period: string;
    value: number;
    goal: number;
  }[];
}
