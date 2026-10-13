import { inject, Injectable } from '@angular/core';
import { ActionPlanRepository } from './action-plan.repository';
import type { ActionPlanSuggestion } from '@features/indicators/data-access/indicator-analysis.model';
import type { ActionPlan, ActionPlanStatusOption } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class ActionPlanService {
  private readonly repository = inject(ActionPlanRepository);

  fetchStatuses(): Promise<ActionPlanStatusOption[]> {
    return this.repository.fetchStatuses();
  }

  async advance(plan: ActionPlan): Promise<ActionPlan> {
    const statuses = await this.fetchStatuses();
    const next = statuses.find((option) => option.key === plan.status)?.next_status_key;
    if (!next || !statuses.some((option) => option.key === next && option.is_active))
      throw new Error('Próxima etapa não configurada ou inativa no Supabase.');
    return this.repository.updateActionPlan(plan.id, { status: next });
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
