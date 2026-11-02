export type SurveyQuestionType = 'likert' | 'nps' | 'text';

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  prompt: string;
  required: boolean;
  criterion_id: string | null;
  low_label?: string;
  high_label?: string;
}

export interface SurveyCriterion {
  id: string;
  establishment_id: string;
  sector: string;
  name: string;
  created_at: string;
}

export interface Survey {
  id: string;
  establishment_id: string;
  title: string;
  description: string;
  process_id: string | null;
  status: 'draft' | 'published' | 'closed';
  questions: SurveyQuestion[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SurveyLink {
  id: string;
  establishment_id: string;
  survey_id: string;
  process_id: string | null;
  token: string;
  active: boolean;
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  establishment_id: string;
  survey_id: string;
  link_id: string;
  process_id: string | null;
  answers: Record<string, string | number>;
  submitted_at: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
  sentiment_summary: string | null;
  sentiment_alignment: 'aligned' | 'divergent' | 'inconclusive' | null;
  sentiment_analyzed_at: string | null;
  review_status: 'pending' | 'reviewed';
  critical_analysis: string | null;
  action_taken: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface PublicSurvey {
  title: string;
  description: string;
  process: string | null;
  questions: SurveyQuestion[];
}

export interface SurveySentiment {
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  summary: string;
  alignment: 'aligned' | 'divergent' | 'inconclusive';
}
