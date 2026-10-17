import type { GEDDocument } from '@core/models/database';

export interface DocumentFormValue {
  title: string;
  type_id: string;
  process_id: string;
  drive_link: string;
  step_id: string;
  owner_id: string;
  approver_ids: string[];
  justification: string;
}

export type DocumentSavePayload = Pick<
  GEDDocument,
  'title' | 'type_id' | 'process_id' | 'drive_link' | 'step_id' | 'owner_id' | 'approver_ids'
> & { justification: string };

export function toDocumentPayload(value: DocumentFormValue): DocumentSavePayload {
  return {
    title: value.title,
    type_id: value.type_id || null,
    process_id: value.process_id || null,
    step_id: value.step_id || null,
    owner_id: value.owner_id || null,
    approver_ids: value.approver_ids,
    justification: value.justification,
    drive_link: value.drive_link || null,
  };
}
