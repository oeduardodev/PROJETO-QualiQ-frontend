import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type { Process } from '@core/models/database';
import type {
  BuiltForm,
  BuiltFormResponse,
  FormAnswer,
  PublicBuiltForm,
} from './form-builder.models';

export type FormInput = Pick<
  BuiltForm,
  'title' | 'description' | 'process_id' | 'sector' | 'thank_you_message' | 'questions' | 'status'
> & { id?: string };

@Injectable({ providedIn: 'root' })
export class FormBuilderRepository {
  private readonly client = inject(SupabaseService).client;

  listForms(): Promise<BuiltForm[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('built_forms')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  listResponses(): Promise<BuiltFormResponse[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('built_form_responses')
        .select('*')
        .order('submitted_at', { ascending: false })
        .order('id')
        .range(from, to),
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

  async save(input: FormInput): Promise<BuiltForm> {
    const payload = {
      title: input.title.trim(),
      description: input.description.trim(),
      process_id: input.process_id,
      sector: input.sector.trim(),
      thank_you_message: input.thank_you_message.trim(),
      questions: input.questions,
      status: input.status,
    };
    const query = input.id
      ? this.client.from('built_forms').update(payload).eq('id', input.id)
      : this.client.from('built_forms').insert(payload);
    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return data;
  }

  async close(id: string): Promise<void> {
    const { error } = await this.client
      .from('built_forms')
      .update({ status: 'closed' })
      .eq('id', id);
    if (error) throw error;
  }

  async readPublic(token: string): Promise<PublicBuiltForm> {
    const { data, error } = await this.client.rpc('read_public_built_form', { p_token: token });
    if (error) throw error;
    return data;
  }

  async submitPublic(token: string, answers: Record<string, FormAnswer>): Promise<string> {
    const { data, error } = await this.client.rpc('submit_public_built_form', {
      p_token: token,
      p_answers: answers,
    });
    if (error) throw error;
    return data;
  }
}
