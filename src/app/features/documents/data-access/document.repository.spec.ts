import { TestBed } from '@angular/core/testing';
import type { GEDDocument } from '@core/models/database';
import { SupabaseService } from '@core/supabase/supabase.service';
import { DocumentRepository } from './document.repository';

describe('DocumentRepository', () => {
  it('saves document metadata with a reason and optimistic concurrency token', async () => {
    const current = { id: 'document-1', updated_at: '2026-10-16T12:00:00Z' } as GEDDocument;
    const saved = { ...current, title: 'Manual revisado' } as GEDDocument;
    const rpc = vi.fn(() => ({
      single: vi.fn(() => Promise.resolve({ data: saved, error: null })),
    }));
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { rpc } } }],
    });

    const payload = {
      title: 'Manual revisado',
      type_id: 'type-1',
      process_id: 'process-1',
      step_id: 'step-1',
      owner_id: 'owner-1',
      approver_ids: ['approver-1'],
      justification: 'Nova edição',
    };
    expect(await TestBed.inject(DocumentRepository).saveDocument(current, payload)).toBe(saved);
    expect(rpc).toHaveBeenCalledWith('save_operation_document', {
      p_id: current.id,
      p_expected_updated_at: current.updated_at,
      p_payload: payload,
      p_reason: 'Nova edição',
    });
  });

  it('transitions through the audited workflow RPC', async () => {
    const current = { id: 'document-1', updated_at: '2026-10-16T12:00:00Z' } as GEDDocument;
    const rpc = vi.fn(() => ({
      single: vi.fn(() => Promise.resolve({ data: current, error: null })),
    }));
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { rpc } } }],
    });
    await TestBed.inject(DocumentRepository).transition(current, 'submit', 'Validar');
    expect(rpc).toHaveBeenCalledWith('transition_operation_document', {
      p_id: current.id,
      p_expected_updated_at: current.updated_at,
      p_action: 'submit',
      p_reason: 'Validar',
    });
  });
});
