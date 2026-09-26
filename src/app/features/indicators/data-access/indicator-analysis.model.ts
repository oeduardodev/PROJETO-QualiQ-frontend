export interface ActionPlanSuggestion {
  title: string;
  what: string;
  why: string;
  who: string;
  how: string;
  how_much: string;
}

export interface IndicatorAnalysis {
  diagnostic: string;
  suggestions: ActionPlanSuggestion[];
}
