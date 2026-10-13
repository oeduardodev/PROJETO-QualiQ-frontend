import { inject, Injectable } from '@angular/core';
import { TicketRepository } from './ticket.repository';
import type { Ticket, TicketStatusOption } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly repository = inject(TicketRepository);

  fetchStatuses(): Promise<TicketStatusOption[]> {
    return this.repository.fetchStatuses();
  }

  async advance(ticket: Ticket): Promise<Ticket> {
    const statuses = await this.fetchStatuses();
    const next = statuses.find((option) => option.key === ticket.status)?.next_status_key;
    if (!next || !statuses.some((option) => option.key === next && option.is_active))
      throw new Error('Próxima etapa não configurada ou inativa no Supabase.');
    return this.repository.updateTicket(ticket.id, { status: next });
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
