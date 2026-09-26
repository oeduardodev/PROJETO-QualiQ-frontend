import type { HelpdeskStatus } from '@core/models/database';

export const HELPDESK_STATUS_SEQUENCE: readonly [HelpdeskStatus, ...HelpdeskStatus[]] = [
  'aberto',
  'em_andamento',
  'resolvido',
  'fechado',
];
