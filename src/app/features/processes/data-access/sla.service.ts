import { inject, Injectable } from '@angular/core';
import { SlaRepository } from './sla.repository';
import type { SLA, SlaApproval, SlaHistory, SlaStatusOption } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class SlaService {
  private readonly repository = inject(SlaRepository);

  fetchStatuses(): Promise<SlaStatusOption[]> {
    return this.repository.fetchStatuses();
  }

  fetchSlas(): Promise<SLA[]> {
    return this.repository.fetchSlas();
  }

  fetchSlasByProcess(processId: string): Promise<SLA[]> {
    return this.repository.fetchSlasByProcess(processId);
  }

  createSla(input: Record<string, unknown>): Promise<SLA> {
    return this.repository.createSla(input);
  }

  updateSla(id: string, patch: Record<string, unknown>, justification: string): Promise<SLA> {
    return this.repository.updateSla(id, patch, justification);
  }

  fetchSlaHistory(id: string): Promise<SlaHistory[]> {
    return this.repository.fetchSlaHistory(id);
  }

  fetchApprovals(): Promise<SlaApproval[]> {
    return this.repository.fetchApprovals();
  }

  activateSla(id: string): Promise<SLA> {
    return this.repository.activateSla(id);
  }

  decideApproval(id: string, approve: boolean, reason: string): Promise<SLA> {
    return this.repository.decideApproval(id, approve, reason);
  }

  deactivate(id: string, reason: string): Promise<SLA> {
    return this.repository.deactivate(id, reason);
  }
}
