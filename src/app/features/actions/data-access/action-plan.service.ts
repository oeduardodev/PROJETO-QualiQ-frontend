import { inject, Injectable } from '@angular/core';
import { ActionPlanRepository } from './action-plan.repository';
import type { ActionPlanSuggestion } from '@features/indicators/data-access/indicator-analysis.model';
import type { ActionPlan, ActionPlanStatusOption, ActionPlanEvidence } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class ActionPlanService {
  private readonly repository = inject(ActionPlanRepository);

  save(current: ActionPlan | null, payload: Record<string, unknown>, reason: string) {
    return this.repository.save(current, payload, reason);
  }

  transition(plan: ActionPlan, action: string, reason: string) {
    return this.repository.transition(plan, action, reason);
  }

  task(plan: ActionPlan, id: string, completed: boolean, reason: string) {
    return this.repository.task(plan, id, completed, reason);
  }

  activity(id: string) {
    return this.repository.activity(id);
  }

  comment(id: string, body: string) {
    return this.repository.comment(id, body);
  }

  upload(plan: ActionPlan, file: File) {
    return this.repository.upload(plan, file);
  }

  evidenceUrl(evidence: ActionPlanEvidence) {
    return this.repository.evidenceUrl(evidence);
  }

  fetchStatuses(): Promise<ActionPlanStatusOption[]> {
    return this.repository.fetchStatuses();
  }

  createFromSuggestions(
    ticketId: string,
    suggestions: ActionPlanSuggestion[],
  ): Promise<ActionPlan[]> {
    return this.repository.createFromSuggestions(ticketId, suggestions);
  }

  fetchActionPlans(): Promise<ActionPlan[]> {
    return this.repository.fetchActionPlans();
  }

  fetchActionPlansByTicket(ticketId: string): Promise<ActionPlan[]> {
    return this.repository.fetchActionPlansByTicket(ticketId);
  }

  fetchActionPlansByProcess(processId: string): Promise<ActionPlan[]> {
    return this.repository.fetchActionPlansByProcess(processId);
  }
}
