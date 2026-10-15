import { inject, Injectable } from '@angular/core';
import { SlaRepository } from './sla.repository';
import type { SLA, SlaHistory, SlaStatusOption } from '@core/models/database';

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

  createSla(input: Partial<Omit<SLA, 'id' | 'created_at' | 'updated_at'>>): Promise<SLA> {
    return this.repository.createSla(input);
  }

  updateSla(
    id: string,
    patch: Partial<Omit<SLA, 'id' | 'created_at' | 'updated_at'>>,
    justification: string,
  ): Promise<SLA> {
    return this.repository.updateSla(id, patch, justification);
  }

  fetchSlaHistory(id: string): Promise<SlaHistory[]> {
    return this.repository.fetchSlaHistory(id);
  }
}
