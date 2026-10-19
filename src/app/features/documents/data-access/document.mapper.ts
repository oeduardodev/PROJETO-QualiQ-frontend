import type { GEDDocument } from '@core/models/database';
import type { DocumentBody } from '@core/models/document-content';

export interface DocumentFormValue {
  title: string;
  type_id: string;
  process_id: string;
  step_id: string;
  owner_id: string;
  approver_ids: string[];
  justification: string;
}

export type DocumentSavePayload = Pick<
  GEDDocument,
  'title' | 'type_id' | 'process_id' | 'step_id' | 'owner_id' | 'approver_ids'
> & { justification: string; content_json?: GEDDocument['content_json']; content_html?: string };

export function toDocumentPayload(
  value: DocumentFormValue,
  body?: DocumentBody,
): DocumentSavePayload {
  return {
    title: value.title,
    type_id: value.type_id || null,
    process_id: value.process_id || null,
    step_id: value.step_id || null,
    owner_id: value.owner_id || null,
    approver_ids: value.approver_ids,
    justification: value.justification,
    ...(body ? { content_json: body.json, content_html: body.html } : {}),
  };
}
