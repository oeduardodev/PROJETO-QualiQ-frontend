export interface IntelligentPlanSuggestion {
  source_type: 'indicator' | 'risk' | 'incident' | 'audit';
  source_id: string;
  source_label: string;
  process_id: string | null;
  title: string;
  what: string;
  why: string;
  where: string;
  how: string;
  how_much: string;
}

export interface IntelligentPlanResponse {
  suggestions: IntelligentPlanSuggestion[];
  sources_analyzed: number;
}
