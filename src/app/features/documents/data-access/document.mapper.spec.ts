import { describe, expect, it } from 'vitest';
import { toDocumentPayload } from './document.mapper';

const value = {
  title: 'Manual de qualidade',
  type_id: '',
  process_id: '',
  drive_link: 'https://docs.google.com/document/d/example/edit',
  status: 'aprovado' as const,
  print_allowed: false,
};

describe('document payloads', () => {
  it('preserves the selected status while leaving ownership to the database', () => {
    const payload = toDocumentPayload(value);
    expect(payload.status).toBe('aprovado');
    expect(payload).not.toHaveProperty('owner_id');
    expect(payload.type_id).toBeNull();
  });
});
