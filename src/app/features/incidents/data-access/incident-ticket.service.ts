import { inject, Injectable } from '@angular/core';
import { IncidentTicketRepository } from './incident-ticket.repository';
import type { Ticket, TicketStatusOption } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class IncidentTicketService {
  private readonly repository = inject(IncidentTicketRepository);

  save(current: Ticket | null, payload: Record<string, unknown>, reason: string) {
    return this.repository.save(current, payload, reason);
  }

  transition(ticket: Ticket, action: string, manager: string | null, reason: string) {
    return this.repository.transition(ticket, action, manager, reason);
  }

  publicLink(classification: string, process: string) {
    return this.repository.publicLink(classification, process);
  }

  publicForm(token: string) {
    return this.repository.publicForm(token);
  }

  submitPublic(token: string, payload: Record<string, unknown>) {
    return this.repository.submitPublic(token, payload);
  }

  fetchStatuses(): Promise<TicketStatusOption[]> {
    return this.repository.fetchStatuses();
  }

  fetchTickets(): Promise<Ticket[]> {
    return this.repository.fetchTickets();
  }

  fetchTicketsByProcess(processId: string): Promise<Ticket[]> {
    return this.repository.fetchTicketsByProcess(processId);
  }

  fetchTicketsByStep(stepId: string): Promise<Ticket[]> {
    return this.repository.fetchTicketsByStep(stepId);
  }
}
