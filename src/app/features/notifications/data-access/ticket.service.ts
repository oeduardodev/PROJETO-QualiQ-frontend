import { inject, Injectable } from '@angular/core';
import { TicketRepository } from './ticket.repository';
import { nextWorkflowStatus } from '@shared/utils/workflow.utils';
import { TICKET_STATUS_SEQUENCE } from './ticket-workflow.constants';
import type { Ticket } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly repository = inject(TicketRepository);

  advance(ticket: Ticket): Promise<Ticket> {
    const status = nextWorkflowStatus(ticket.status, TICKET_STATUS_SEQUENCE);
    return this.repository.updateTicket(ticket.id, { status });
  }

  fetchTickets(): Promise<Ticket[]> {
    return this.repository.fetchTickets();
  }

  createTicket(input: Partial<Omit<Ticket, 'id' | 'created_at' | 'updated_at'>>): Promise<Ticket> {
    return this.repository.createTicket(input);
  }

  updateTicket(
    id: string,
    patch: Partial<Omit<Ticket, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<Ticket> {
    return this.repository.updateTicket(id, patch);
  }

  deleteTicket(id: string): Promise<void> {
    return this.repository.deleteTicket(id);
  }

  fetchTicketsByProcess(processId: string): Promise<Ticket[]> {
    return this.repository.fetchTicketsByProcess(processId);
  }

  fetchTicketsByStep(stepId: string): Promise<Ticket[]> {
    return this.repository.fetchTicketsByStep(stepId);
  }
}
