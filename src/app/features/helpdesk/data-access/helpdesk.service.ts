import { inject, Injectable } from '@angular/core';
import { HelpdeskRepository } from './helpdesk.repository';
import { nextWorkflowStatus } from '@shared/utils/workflow.utils';
import { HELPDESK_STATUS_SEQUENCE } from './helpdesk-workflow.constants';
import type { HelpdeskTicket } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class HelpdeskService {
  private readonly repository = inject(HelpdeskRepository);

  advance(ticket: HelpdeskTicket): Promise<HelpdeskTicket> {
    const status = nextWorkflowStatus(ticket.status, HELPDESK_STATUS_SEQUENCE);
    return this.repository.updateHelpdeskTicket(ticket.id, { status });
  }

  fetchHelpdeskTickets(): Promise<HelpdeskTicket[]> {
    return this.repository.fetchHelpdeskTickets();
  }

  createHelpdeskTicket(
    input: Partial<Omit<HelpdeskTicket, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<HelpdeskTicket> {
    return this.repository.createHelpdeskTicket(input);
  }

  updateHelpdeskTicket(
    id: string,
    patch: Partial<Omit<HelpdeskTicket, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<HelpdeskTicket> {
    return this.repository.updateHelpdeskTicket(id, patch);
  }

  deleteHelpdeskTicket(id: string): Promise<void> {
    return this.repository.deleteHelpdeskTicket(id);
  }
}
