import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';
import type { ActionPlan, ActionPlanStatusOption, ActionPlanEvidence } from '@core/models/database';
import type { ActionPlanSuggestion } from '@features/indicators/data-access/indicator-analysis.model';

@Injectable({ providedIn: 'root' })
export class ActionPlanRepository {
  private readonly client = inject(SupabaseService).client;

  async save(
    current: ActionPlan | null,
    payload: Record<string, unknown>,
    reason: string,
  ): Promise<ActionPlan> {
    const { data, error } = await this.client
      .rpc('save_operation_plan', {
        p_id: current?.id ?? null,
        p_expected_updated_at: current?.updated_at ?? null,
        p_payload: payload,
        p_reason: reason,
      })
      .single();
    if (error) throw error;
    return data;
  }

  async transition(plan: ActionPlan, action: string, reason: string): Promise<ActionPlan> {
    const { data, error } = await this.client
      .rpc('transition_operation_plan', {
        p_id: plan.id,
        p_expected_updated_at: plan.updated_at,
        p_action: action,
        p_reason: reason,
      })
      .single();
    if (error) throw error;
    return data;
  }

  async task(
    plan: ActionPlan,
    id: string,
    completed: boolean,
    reason: string,
  ): Promise<ActionPlan> {
    const { data, error } = await this.client
      .rpc('update_operation_task', {
        p_id: plan.id,
        p_expected_updated_at: plan.updated_at,
        p_task: id,
        p_completed: completed,
        p_reason: reason,
      })
      .single();
    if (error) throw error;
    return data;
  }

  async activity(id: string) {
    const [comments, evidence, history] = await Promise.all([
      this.client.from('action_plan_comments').select('*').eq('plan_id', id).order('created_at'),
      this.client.from('action_plan_evidence').select('*').eq('plan_id', id).order('created_at'),
      this.client
        .from('action_plan_history')
        .select('*')
        .eq('plan_id', id)
        .order('changed_at', { ascending: false }),
    ]);
    if (comments.error) throw comments.error;
    if (evidence.error) throw evidence.error;
    if (history.error) throw history.error;
    return { comments: comments.data, evidence: evidence.data, history: history.data };
  }

  async comment(id: string, body: string) {
    const { data, error } = await this.client
      .from('action_plan_comments')
      .insert({ plan_id: id, body })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async upload(plan: ActionPlan, file: File): Promise<ActionPlanEvidence> {
    if (
      !['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 10485760
    )
      throw new Error('Use PDF, PNG, JPEG ou WebP de até 10 MB.');
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) throw new Error('Sessão expirada.');
    const path = plan.id + '/' + user.id + '/' + crypto.randomUUID();
    const upload = await this.client.storage
      .from('action-evidence')
      .upload(path, file, { contentType: file.type });
    if (upload.error) throw upload.error;
    const { data, error } = await this.client
      .from('action_plan_evidence')
      .insert({ plan_id: plan.id, name: file.name, storage_path: path, mime_type: file.type })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async evidenceUrl(evidence: ActionPlanEvidence): Promise<string> {
    const { data, error } = await this.client.storage
      .from('action-evidence')
      .createSignedUrl(evidence.storage_path, 60);
    if (error) throw error;
    return data.signedUrl;
  }

  async fetchStatuses(): Promise<ActionPlanStatusOption[]> {
    const { data, error } = await this.client
      .from('action_plan_statuses')
      .select('*')
      .order('order_index')
      .order('key');
    if (error) throw error;
    return data;
  }

  fetchActionPlans(): Promise<ActionPlan[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('action_plans')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  fetchActionPlansByTicket(ticketId: string): Promise<ActionPlan[]> {
    return fetchAllPages((from, to) =>
      this.client
        .from('action_plans')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  fetchActionPlansByProcess(processId: string): Promise<ActionPlan[]> {
    return fetchAllPages<ActionPlan>((from, to) =>
      this.client
        .from('action_plans')
        .select('*')
        .eq('process_id', processId)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    );
  }

  async createFromSuggestions(
    ticketId: string,
    suggestions: ActionPlanSuggestion[],
  ): Promise<ActionPlan[]> {
    const { data, error } = await this.client.rpc('create_action_plans_from_suggestions', {
      p_ticket_id: ticketId,
      p_suggestions: suggestions,
    });
    if (error) throw error;
    return data ?? [];
  }
}
