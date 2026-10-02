import { TestBed } from '@angular/core/testing';
import type { GEDDocument } from '@core/models/database';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';

describe('DocumentService', () => {
  it('advances the document and its history through one database operation', async () => {
    const document = { id: 'document-1', status: 'rascunho' } as GEDDocument;
    const savedDocument = { ...document, status: 'em_revisao' } as GEDDocument;
    const repository = {
      advanceDocument: vi.fn(() => Promise.resolve(savedDocument)),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: DocumentRepository, useValue: repository }],
    });

    const result = await TestBed.inject(DocumentService).advanceDocument(document);

    expect(result).toEqual({ savedDocument, nextStatus: 'em_revisao' });
    expect(repository.advanceDocument).toHaveBeenCalledWith('document-1', 'rascunho', 'em_revisao');
  });

  it('lets the database assign the requester, dates and initial copy state', async () => {
    const copy = { id: 'copy-1', document_id: 'document-1' };
    const repository = { createControlledCopy: vi.fn(() => Promise.resolve(copy)) };
    TestBed.configureTestingModule({
      providers: [{ provide: DocumentRepository, useValue: repository }],
    });

    await TestBed.inject(DocumentService).requestCopy('document-1');
    expect(repository.createControlledCopy).toHaveBeenCalledWith({ document_id: 'document-1' });
  });

  it('passes a chosen status through the audited save operation', async () => {
    const current = { id: 'document-1', status: 'rascunho' } as GEDDocument;
    const saved = { ...current, status: 'publicado' } as GEDDocument;
    const payload = {
      title: 'Manual',
      type_id: null,
      process_id: null,
      drive_link: null,
      status: 'publicado' as const,
      print_allowed: false,
    };
    const repository = { saveDocument: vi.fn(() => Promise.resolve(saved)) };
    TestBed.configureTestingModule({
      providers: [{ provide: DocumentRepository, useValue: repository }],
    });

    expect(await TestBed.inject(DocumentService).saveDocument(current, payload)).toEqual(saved);
    expect(repository.saveDocument).toHaveBeenCalledWith(current, payload);
  });
});
