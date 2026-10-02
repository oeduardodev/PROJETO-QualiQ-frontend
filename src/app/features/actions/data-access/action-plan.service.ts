import { inject, Injectable } from '@angular/core';
import { ActionPlanRepository } from './action-plan.repository';
import { nextWorkflowStatus } from '@shared/utils/workflow.utils';
import { ACTION_PLAN_STATUS_SEQUENCE } from './action-plan-workflow.constants';
import type { ActionPlanSuggestion } from '@features/indicators/data-access/indicator-analysis.model';
import type { ActionPlan } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class ActionPlanService {
  private readonly repository = inject(ActionPlanRepository);

  advance(plan: ActionPlan): Promise<ActionPlan> {
    const status = nextWorkflowStatus(plan.status, ACTION_PLAN_STATUS_SEQUENCE);
    return this.repository.updateActionPlan(plan.id, { status });
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

  createActionPlan(
    input: Partial<Omit<ActionPlan, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<ActionPlan> {
    return this.repository.createActionPlan(input);
  }

  updateActionPlan(
    id: string,
    patch: Partial<Omit<ActionPlan, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<ActionPlan> {
    return this.repository.updateActionPlan(id, patch);
  }

  deleteActionPlan(id: string): Promise<void> {
    return this.repository.deleteActionPlan(id);
  }
}
