import { inject, Injectable } from '@angular/core';
import { SupabaseService } from '@core/supabase/supabase.service';
import type { EditHistory } from '@core/models/database';
import { fetchAllPages } from '@core/data-access/fetch-all-pages';

export type AuditedEntity =
  | 'value_chain_categories'
  | 'dimensions'
  | 'sipoc_nodes'
  | 'helpdesk_tickets'
  | 'notification_classifications'
  | 'notification_types'
  | 'document_levels'
  | 'tickets';

@Injectable({ providedIn: 'root' })
export class EditHistoryService {
  private readonly client = inject(SupabaseService).client;

  fetch(entity: AuditedEntity, id: string): Promise<EditHistory[]> {
    if (entity === 'tickets') {
      return fetchAllPages((from, to) =>
        this.client
          .from('ticket_history')
          .select('*')
          .eq('ticket_id', id)
          .order('changed_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to),
      ).then((rows) =>
        rows.map((row) => ({
          id: row.id,
          entity_name: 'tickets',
          record_id: row.ticket_id,
          action: row.action,
          justification: row.reason,
          before_data: row.before_data,
          after_data: row.after_data,
          changed_by: row.changed_by,
          changed_at: row.changed_at,
        })),
      );
    }
    return fetchAllPages((from, to) =>
      this.client
        .from('edit_history')
        .select('*')
        .eq('entity_name', entity)
        .eq('record_id', id)
        .order('changed_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to),
    );
  }
}
