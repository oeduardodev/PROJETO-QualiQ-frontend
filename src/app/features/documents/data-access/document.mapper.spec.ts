import { describe, expect, it } from 'vitest';
import { toDocumentPayload } from './document.mapper';

describe('document payloads', () => {
  it('sends ownership and approvers without client-controlled workflow state', () => {
    const payload = toDocumentPayload({
      title: 'Manual de qualidade',
      type_id: 'type-1',
      process_id: 'process-1',
      step_id: 'step-1',
      owner_id: 'owner-1',
      approver_ids: ['approver-1'],
      justification: 'Criação',
      drive_link: 'https://docs.google.com/document/d/example/edit',
    });
    expect(payload).toMatchObject({
      owner_id: 'owner-1',
      approver_ids: ['approver-1'],
      step_id: 'step-1',
    });
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('print_allowed');
  });
});
