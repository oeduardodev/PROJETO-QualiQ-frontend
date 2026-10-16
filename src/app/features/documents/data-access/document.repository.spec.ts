import { TestBed } from '@angular/core/testing';
import type { DocumentType, GEDDocument } from '@core/models/database';
import { SupabaseService } from '@core/supabase/supabase.service';
import { DocumentRepository } from './document.repository';

describe('DocumentRepository', () => {
  it('keeps the selected initial status when creating a document', async () => {
    const saved = { id: 'document-2', status: 'aprovado' } as GEDDocument;
    const single = vi.fn(() => Promise.resolve({ data: saved, error: null }));
    const rpc = vi.fn(() => ({ single }));
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { rpc } } }],
    });

    const result = await TestBed.inject(DocumentRepository).saveDocument(null, {
      title: 'Política',
      type_id: null,
      process_id: null,
      drive_link: null,
      status: 'aprovado',
      print_allowed: true,
    });

    expect(result).toBe(saved);
    expect(rpc).toHaveBeenCalledWith('save_document', {
      p_document_id: null,
      p_expected_status: null,
      p_status: 'aprovado',
      p_title: 'Política',
      p_type_id: null,
      p_process_id: null,
      p_drive_link: null,
      p_print_allowed: true,
    });
  });

  it('sends details and chosen status in a single audited RPC', async () => {
    const current = { id: 'document-1', status: 'rascunho' } as GEDDocument;
    const saved = { ...current, status: 'publicado' } as GEDDocument;
    const single = vi.fn(() => Promise.resolve({ data: saved, error: null }));
    const rpc = vi.fn(() => ({ single }));
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { rpc } } }],
    });

    const result = await TestBed.inject(DocumentRepository).saveDocument(current, {
      title: 'Manual',
      type_id: null,
      process_id: null,
      drive_link: null,
      status: 'publicado',
      print_allowed: false,
    });

    expect(result).toBe(saved);
    expect(rpc).toHaveBeenCalledWith('save_document', {
      p_document_id: 'document-1',
      p_expected_status: 'rascunho',
      p_status: 'publicado',
      p_title: 'Manual',
      p_type_id: null,
      p_process_id: null,
      p_drive_link: null,
      p_print_allowed: false,
    });
  });

  it('saves a document type and its required reason through the audited RPC', async () => {
    const saved = { id: 'type-1', name: 'Procedimento', active: false } as DocumentType;
    const single = vi.fn(() => Promise.resolve({ data: saved, error: null }));
    const rpc = vi.fn(() => ({ single }));
    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client: { rpc } } }],
    });

    const result = await TestBed.inject(DocumentRepository).saveDocumentType(
      'type-1',
      {
        name: 'Procedimento',
        acronym: 'POP',
        hierarchy_level: 3,
        validity_days: 365,
        sla_review_days: 10,
        sla_approval_days: 5,
        sla_publication_days: 2,
        print_allowed: true,
        public_panel: false,
        active: false,
      },
      'Substituído por outro tipo',
    );

    expect(result).toBe(saved);
    expect(rpc).toHaveBeenCalledWith('save_document_type', {
      p_type_id: 'type-1',
      p_name: 'Procedimento',
      p_acronym: 'POP',
      p_level: 3,
      p_validity_days: 365,
      p_review_days: 10,
      p_approval_days: 5,
      p_publication_days: 2,
      p_print_allowed: true,
      p_public_panel: false,
      p_active: false,
      p_justification: 'Substituído por outro tipo',
    });
  });
});
