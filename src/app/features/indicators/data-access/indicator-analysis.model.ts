import type { IndicatorActionPlanSuggestion } from '@core/models/database';

export type ActionPlanSuggestion = IndicatorActionPlanSuggestion;

export interface IndicatorAnalysis {
  diagnostic: string;
  suggestions: ActionPlanSuggestion[];
}

export interface IndicatorObservationContext {
  period: string;
  on_target: boolean;
  related_indicators: {
    title: string;
    period: string;
    value: number;
    goal: number;
    unit: string;
  }[];
}
