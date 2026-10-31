export interface LearningItem {
  id: string;
  establishment_id: string;
  kind: 'training' | 'track';
  title: string;
  description: string;
  owner_id: string;
  action_plan_id: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface LearningTrackCourse {
  id: string;
  establishment_id: string;
  track_id: string;
  training_id: string;
  position: number;
}

export interface LearningStage {
  id: string;
  establishment_id: string;
  training_id: string;
  position: number;
  title: string;
  resource_kind: 'youtube' | 'audio' | 'pdf' | 'link';
  resource_url: string;
  duration_seconds: number;
  created_at: string;
}

export interface LearningQuiz {
  id: string;
  establishment_id: string;
  stage_id: string;
  title: string;
  cue_seconds: number;
  passing_score: number;
  position: number;
}

export interface LearningQuestion {
  id: string;
  establishment_id: string;
  quiz_id: string;
  position: number;
  prompt: string;
  options: string[];
  correct_index: number;
}

export interface PublicLearningQuestion {
  id: string;
  prompt: string;
  options: string[];
}

export interface LearningStageProgress {
  establishment_id: string;
  stage_id: string;
  user_id: string;
  watched_seconds: number;
  access_seconds: number;
  quiz_passes: string[];
  replay_required: boolean;
  completed_at: string | null;
  last_tick_at: string | null;
  last_access_at: string;
}

export interface LearningQuizAttempt {
  id: string;
  establishment_id: string;
  quiz_id: string;
  user_id: string;
  score: number;
  passed: boolean;
  attempted_at: string;
}

export interface LearningAttendance {
  establishment_id: string;
  item_id: string;
  user_id: string;
  signed_name: string;
  signed_at: string;
}

export interface QuizResult {
  score: number;
  passing_score: number;
  passed: boolean;
}
