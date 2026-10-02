import type { DocumentStatus, GEDDocument } from '@core/models/database';

export interface DocumentFormValue {
  title: string;
  type_id: string;
  process_id: string;
  drive_link: string;
  status: DocumentStatus;
  print_allowed: boolean;
}

export type DocumentSavePayload = Pick<
  GEDDocument,
  'title' | 'type_id' | 'process_id' | 'drive_link' | 'status' | 'print_allowed'
>;

export function toDocumentPayload(value: DocumentFormValue): DocumentSavePayload {
  return {
    ...value,
    type_id: value.type_id || null,
    process_id: value.process_id || null,
    drive_link: value.drive_link || null,
  };
}
