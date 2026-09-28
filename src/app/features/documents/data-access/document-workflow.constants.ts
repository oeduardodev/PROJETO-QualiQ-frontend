import type { DocumentStatus } from '@core/models/database';

export const DOCUMENT_STATUS_SEQUENCE: readonly [DocumentStatus, ...DocumentStatus[]] = [
  'rascunho',
  'em_revisao',
  'aprovado',
  'publicado',
  'obsoleto',
];
