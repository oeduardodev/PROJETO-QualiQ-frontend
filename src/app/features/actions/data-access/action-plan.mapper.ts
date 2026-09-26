import type { ActionPlanStatus, ActionPlan } from '@core/models/database';
import { emptyToNull } from '@shared/utils/string.utils';

export interface ActionPlanFormValue {
  title: string;
  ticket_id: string;
  what: string;
  why: string;
  where: string;
  when: string;
  who: string;
  how: string;
  how_much: string;
  status: ActionPlanStatus;
}

export function toActionPlanPayload(value: ActionPlanFormValue): Partial<ActionPlan> {
  return {
    ...value,
    what: emptyToNull(value.what),
    why: emptyToNull(value.why),
    where: emptyToNull(value.where),
    when: emptyToNull(value.when),
    who: emptyToNull(value.who),
    how: emptyToNull(value.how),
    how_much: emptyToNull(value.how_much),
  };
}
