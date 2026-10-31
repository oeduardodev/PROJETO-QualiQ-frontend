import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type {
  LearningItem,
  LearningTrackCourse,
  LearningStage,
  LearningQuiz,
  LearningQuestion,
  LearningStageProgress,
  LearningAttendance,
  PublicLearningQuestion,
  QuizResult,
} from '../education.models';

@Injectable({ providedIn: 'root' })
export class EducationService {
  private readonly client = inject(SupabaseService).client;

  async load() {
    const [items, courses, stages, quizzes, progress, attendance, attempts] = await Promise.all([
      fetchAllPages((from, to) =>
        this.client
          .from('learning_items')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id')
          .range(from, to),
      ),
      fetchAllPages((from, to) =>
        this.client
          .from('learning_track_courses')
          .select('*')
          .order('position')
          .order('id')
          .range(from, to),
      ),
      fetchAllPages((from, to) =>
        this.client
          .from('learning_stages')
          .select('*')
          .order('position')
          .order('id')
          .range(from, to),
      ),
      fetchAllPages((from, to) =>
        this.client
          .from('learning_quizzes')
          .select('*')
          .order('position')
          .order('id')
          .range(from, to),
      ),
      fetchAllPages((from, to) =>
        this.client
          .from('learning_stage_progress')
          .select('*')
          .order('stage_id')
          .order('user_id')
          .range(from, to),
      ),
      fetchAllPages((from, to) =>
        this.client
          .from('learning_attendance')
          .select('*')
          .order('signed_at', { ascending: false })
          .order('item_id')
          .range(from, to),
      ),
      fetchAllPages((from, to) =>
        this.client
          .from('learning_quiz_attempts')
          .select('*')
          .order('attempted_at', { ascending: false })
          .order('id')
          .range(from, to),
      ),
    ]);
    return { items, courses, stages, quizzes, progress, attendance, attempts };
  }

  async questions(quizId: string): Promise<PublicLearningQuestion[]> {
    const { data, error } = await this.client.rpc('learning_public_questions', { p_quiz: quizId });
    if (error) throw error;
    return data ?? [];
  }

  async authorQuestions(quizId: string): Promise<LearningQuestion[]> {
    const { data, error } = await this.client
      .from('learning_questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('position');
    if (error) throw error;
    return data;
  }

  async findByPlan(planId: string): Promise<LearningItem[]> {
    const { data, error } = await this.client
      .from('learning_items')
      .select('*')
      .eq('action_plan_id', planId)
      .order('title');
    if (error) throw error;
    return data;
  }

  async saveItem(
    id: string | null,
    payload: Partial<Omit<LearningItem, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<LearningItem> {
    const query = id
      ? this.client.from('learning_items').update(payload).eq('id', id)
      : this.client.from('learning_items').insert(payload);
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return data;
  }

  async deleteItem(id: string): Promise<void> {
    const { error } = await this.client.from('learning_items').delete().eq('id', id);
    if (error) throw error;
  }

  async saveStage(
    id: string | null,
    payload: Partial<Omit<LearningStage, 'id' | 'created_at'>>,
  ): Promise<LearningStage> {
    const query = id
      ? this.client.from('learning_stages').update(payload).eq('id', id)
      : this.client.from('learning_stages').insert(payload);
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return data;
  }

  async deleteStage(id: string): Promise<void> {
    const { error } = await this.client.from('learning_stages').delete().eq('id', id);
    if (error) throw error;
  }

  async addCourse(
    trackId: string,
    trainingId: string,
    position: number,
  ): Promise<LearningTrackCourse> {
    const { data, error } = await this.client
      .from('learning_track_courses')
      .insert({ track_id: trackId, training_id: trainingId, position })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async removeCourse(id: string): Promise<void> {
    const { error } = await this.client.from('learning_track_courses').delete().eq('id', id);
    if (error) throw error;
  }

  async saveQuiz(
    id: string | null,
    payload: Partial<Omit<LearningQuiz, 'id'>>,
  ): Promise<LearningQuiz> {
    const query = id
      ? this.client.from('learning_quizzes').update(payload).eq('id', id)
      : this.client.from('learning_quizzes').insert(payload);
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return data;
  }

  async deleteQuiz(id: string): Promise<void> {
    const { error } = await this.client.from('learning_quizzes').delete().eq('id', id);
    if (error) throw error;
  }

  async saveQuestion(
    id: string | null,
    payload: Partial<Omit<LearningQuestion, 'id'>>,
  ): Promise<LearningQuestion> {
    const query = id
      ? this.client.from('learning_questions').update(payload).eq('id', id)
      : this.client.from('learning_questions').insert(payload);
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return data;
  }

  async deleteQuestion(id: string): Promise<void> {
    const { error } = await this.client.from('learning_questions').delete().eq('id', id);
    if (error) throw error;
  }

  async tick(stageId: string, seconds: number): Promise<LearningStageProgress> {
    const { data, error } = await this.client.rpc('learning_record_access', {
      p_stage: stageId,
      p_seconds: seconds,
    });
    if (error) throw error;
    return data;
  }

  async submit(quizId: string, answers: number[]): Promise<QuizResult> {
    const { data, error } = await this.client.rpc('learning_submit_quiz', {
      p_quiz: quizId,
      p_answers: answers,
    });
    if (error) throw error;
    return data;
  }

  async complete(stageId: string): Promise<LearningStageProgress> {
    const { data, error } = await this.client.rpc('learning_complete_stage', { p_stage: stageId });
    if (error) throw error;
    return data;
  }

  async sign(itemId: string, name: string): Promise<LearningAttendance> {
    const { data, error } = await this.client.rpc('learning_sign_attendance', {
      p_item: itemId,
      p_name: name,
    });
    if (error) throw error;
    return data;
  }
}
