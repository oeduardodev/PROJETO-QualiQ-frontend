export type FormQuestionType = 'short' | 'long' | 'single' | 'multiple' | 'rating' | 'date';

export interface FormQuestion {
  id: string;
  type: FormQuestionType;
  title: string;
  description: string;
  required: boolean;
  options: string[];
}

export type FormAnswer = string | number | string[];

export interface BuiltForm {
  id: string;
  establishment_id: string;
  title: string;
  description: string;
  process_id: string | null;
  sector: string;
  thank_you_message: string;
  status: 'draft' | 'published' | 'closed';
  questions: FormQuestion[];
  token: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BuiltFormResponse {
  id: string;
  establishment_id: string;
  form_id: string;
  answers: Record<string, FormAnswer>;
  submitted_at: string;
}

export type PublicBuiltForm = Pick<
  BuiltForm,
  'title' | 'description' | 'sector' | 'thank_you_message' | 'questions'
> & { process: string | null };
