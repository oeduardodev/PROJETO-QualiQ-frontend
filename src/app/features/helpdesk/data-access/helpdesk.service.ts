import { inject, Injectable } from '@angular/core';
import { HelpdeskRepository } from './helpdesk.repository';
import type {
  HelpdeskCategoryOption,
  HelpdeskPriorityOption,
  HelpdeskStatusOption,
  HelpdeskTicket,
} from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class HelpdeskService {
  private readonly repository = inject(HelpdeskRepository);

  fetchStatuses(): Promise<HelpdeskStatusOption[]> {
    return this.repository.fetchStatuses();
  }

  fetchCategories(): Promise<HelpdeskCategoryOption[]> {
    return this.repository.fetchCategories();
  }

  fetchPriorities(): Promise<HelpdeskPriorityOption[]> {
    return this.repository.fetchPriorities();
  }

  async advance(ticket: HelpdeskTicket): Promise<HelpdeskTicket> {
    const statuses = await this.fetchStatuses();
    const next = statuses.find((option) => option.key === ticket.status)?.next_status_key;
    if (!next || !statuses.some((option) => option.key === next && option.is_active))
      throw new Error('Próxima etapa não configurada ou inativa no Supabase.');
    return this.repository.updateHelpdeskTicket(ticket.id, { status: next });
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
