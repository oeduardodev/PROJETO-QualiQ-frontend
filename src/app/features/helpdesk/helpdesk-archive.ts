import type { HelpdeskTicket } from '@core/models/database';

const ARCHIVE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isArchivedHelpdeskTicket(ticket: HelpdeskTicket, now: number): boolean {
  if (ticket.status !== 'resolvido' && ticket.status !== 'fechado') return false;
  const changedAt = Date.parse(ticket.status_changed_at);
  return Number.isFinite(changedAt) && now - changedAt >= ARCHIVE_AGE_MS;
}
