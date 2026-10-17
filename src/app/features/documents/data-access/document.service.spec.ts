import { TestBed } from '@angular/core/testing';
import type { GEDDocument } from '@core/models/database';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';

describe('DocumentService', () => {
  it('requires a reason for an audited transition', async () => {
    const document = { id: 'document-1', status: 'rascunho' } as GEDDocument;
    const repository = { transition: vi.fn(() => Promise.resolve(document)) };
    TestBed.configureTestingModule({
      providers: [{ provide: DocumentRepository, useValue: repository }],
    });
    const service = TestBed.inject(DocumentService);

    expect(() => service.transition(document, 'submit', ' ')).toThrow('Informe a justificativa.');
    expect(repository.transition).not.toHaveBeenCalled();
    await service.transition(document, 'submit', ' Revisado ');
    expect(repository.transition).toHaveBeenCalledWith(document, 'submit', 'Revisado');
  });

  it('passes reason and due date to the controlled-copy request', async () => {
    const repository = { requestCopy: vi.fn(() => Promise.resolve({ id: 'copy-1' })) };
    TestBed.configureTestingModule({
      providers: [{ provide: DocumentRepository, useValue: repository }],
    });
    await TestBed.inject(DocumentService).requestControlledCopy(
      'document-1',
      'Uso externo',
      '2030-01-01',
    );
    expect(repository.requestCopy).toHaveBeenCalledWith('document-1', 'Uso externo', '2030-01-01');
  });
});
