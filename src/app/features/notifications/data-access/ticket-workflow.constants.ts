import type { TicketStatus } from '@core/models/database';

export const TICKET_STATUS_SEQUENCE: readonly [TicketStatus, ...TicketStatus[]] = [
  'aberto',
  'analise',
  'plano',
  'concluido',
];
