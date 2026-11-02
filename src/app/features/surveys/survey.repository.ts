import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type { Process } from '@core/models/database';
import type {
  PublicSurvey,
  Survey,
  SurveyCriterion,
  SurveyLink,
  SurveyQuestion,
  SurveyResponse,
  SurveySentiment,
} from './survey.models';

@Injectable({ providedIn: 'root' })
export class SurveyRepository {
  private readonly client = inject(SupabaseService).client;

  listSurveys(): Promise<Survey[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  listCriteria(): Promise<SurveyCriterion[]> {
    return fetchAllPages((from, to) =>
      this.client.from('survey_criteria').select('*').order('sector').order('name').range(from, to),
    );
  }

  listProcesses(): Promise<Process[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('processes')
        .select('*')
        .eq('obsolete', false)
        .order('title')
        .order('id')
        .range(from, to),
    );
  }

  listLinks(): Promise<SurveyLink[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('survey_links')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  listResponses(): Promise<SurveyResponse[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('survey_responses')
        .select('*')
        .order('submitted_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  async createCriterion(sector: string, name: string): Promise<SurveyCriterion> {
    const { data, error } = await this.client
      .from('survey_criteria')
      .insert({ sector: sector.trim(), name: name.trim() })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async saveSurvey(input: {
    id?: string;
    title: string;
    description: string;
    process_id: string | null;
    questions: SurveyQuestion[];
    status: Survey['status'];
  }): Promise<Survey> {
    const payload = {
      title: input.title.trim(),
      description: input.description.trim(),
      process_id: input.process_id,
      questions: input.questions,
      status: input.status,
    };
    const query = input.id
      ? this.client.from('surveys').update(payload).eq('id', input.id)
      : this.client.from('surveys').insert(payload);
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return data;
  }

  async createLink(surveyId: string, processId: string | null): Promise<SurveyLink> {
    const { data, error } = await this.client
      .from('survey_links')
      .insert({
        survey_id: surveyId,
        process_id: processId,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async setLinkActive(id: string, active: boolean): Promise<void> {
    const { error } = await this.client.from('survey_links').update({ active }).eq('id', id);
    if (error) throw error;
  }

  async readPublic(token: string): Promise<PublicSurvey> {
    const { data, error } = await this.client.rpc('read_public_survey', { p_token: token });
    if (error) throw error;
    return data;
  }

  async submitPublic(token: string, answers: Record<string, string | number>): Promise<string> {
    const { data, error } = await this.client.rpc('submit_public_survey', {
      p_token: token,
      p_answers: answers,
    });
    if (error) throw error;
    return data;
  }

  async review(id: string, analysis: string, action: string): Promise<SurveyResponse> {
    const { data, error } = await this.client.rpc('review_survey_response', {
      p_id: id,
      p_analysis: analysis,
      p_action: action,
    });
    if (error) throw error;
    return data;
  }

  async analyze(id: string): Promise<SurveySentiment> {
    const { data, error } = await this.client.functions.invoke<SurveySentiment>(
      'survey-sentiment',
      {
        body: { response_id: id },
      },
    );
    if (error) {
      const context = (error as { context?: unknown }).context;
      if (context instanceof Response) {
        const body = (await context
          .clone()
          .json()
          .catch(() => null)) as { error?: unknown } | null;
        if (typeof body?.error === 'string') throw new Error(body.error);
      }
      throw error;
    }
    if (!data) throw new Error('A IA não retornou uma análise.');
    return data;
  }
}
