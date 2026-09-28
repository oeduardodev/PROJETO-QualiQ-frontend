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
});
