import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import type { GEDDocument } from '@core/models/database';
import { ToastService } from '@shared/services/toast.service';
import { DocumentsComponent } from './documents.component';
import { DocumentsStore } from './documents.store';
import { DocumentService } from './data-access/document.service';
import { DocumentRecoveryService } from './data-access/document-recovery.service';
import { normalizeDocument } from './editor/document-schema';

describe('native document autosave', () => {
  let component: DocumentsComponent;
  let service: { saveDocument: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const existing = {
    id: 'doc-1',
    title: 'Manual',
    type_id: 'type-1',
    process_id: 'process-1',
    step_id: 'step-1',
    owner_id: 'user-1',
    approver_ids: ['user-2'],
    status: 'rascunho',
    updated_at: 'first',
    content_origin: 'native',
    content_json: { type: 'doc', content: [{ type: 'paragraph' }] },
  } as GEDDocument;

  beforeEach(async () => {
    vi.useFakeTimers();
    service = { saveDocument: vi.fn() };
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { mode: 'management' }, queryParamMap: convertToParamMap({}) },
          },
        },
        {
          provide: AuthService,
          useValue: {
            isAdmin: () => true,
            canEditPage: () => true,
            user: () => ({ id: 'user-1' }),
          },
        },
        { provide: DocumentService, useValue: service },
        {
          provide: DocumentsStore,
          useValue: { load: () => Promise.resolve(), documents: signal([existing]) },
        },
        { provide: ToastService, useValue: toast },
        {
          provide: DocumentRecoveryService,
          useValue: { read: () => Promise.resolve(undefined), write: () => Promise.resolve() },
        },
      ],
    });
    component = TestBed.runInInjectionContext(() => new DocumentsComponent());
    component.openDocument(existing);
    await Promise.resolve();
    component.documentForm.controls.justification.setValue('Revisão de conteúdo');
  });

  afterEach(() => {
    component.ngOnDestroy();
    vi.useRealTimers();
  });

  it('debounces edits and saves the complete body and its expected revision', async () => {
    service.saveDocument.mockResolvedValue({ ...existing, updated_at: 'second' });
    component.bodyChanged(normalizeDocument('<p>Primeiro</p>'));
    await vi.advanceTimersByTimeAsync(900);
    component.bodyChanged(normalizeDocument('<p>Segundo</p>'));
    await vi.advanceTimersByTimeAsync(900);
    expect(service.saveDocument).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(service.saveDocument).toHaveBeenCalledTimes(1);
    expect(service.saveDocument.mock.calls[0][0].updated_at).toBe('first');
    expect(service.saveDocument.mock.calls[0][1].content_html).toBe('<p>Segundo</p>');
    expect(component.saveStatus()).toBe('Todas as alterações salvas');
  });

  it('serializes overlapping saves and keeps edits made while a request is in flight', async () => {
    let finish!: (document: GEDDocument) => void;
    service.saveDocument.mockReturnValueOnce(
      new Promise<GEDDocument>((resolve) => {
        finish = resolve;
      }),
    );
    component.bodyChanged(normalizeDocument('<p>Antes</p>'));
    const first = component.saveDocument();
    component.bodyChanged(normalizeDocument('<p>Durante</p>'));
    finish({ ...existing, updated_at: 'second' });
    await first;
    service.saveDocument.mockResolvedValue({ ...existing, updated_at: 'third' });
    await component.saveDocument();
    expect(service.saveDocument.mock.calls[1][0].updated_at).toBe('second');
    expect(service.saveDocument.mock.calls[1][1].content_html).toBe('<p>Durante</p>');
  });

  it('retains unsaved content and blocks closing/navigation after a conflict', async () => {
    service.saveDocument.mockRejectedValue(new Error('Documento alterado. Recarregue a página'));
    component.bodyChanged(normalizeDocument('<p>Não perder</p>'));
    await component.closeDocument();
    expect(component.documentOpen()).toBe(true);
    expect(component.editorBody().html).toBe('<p>Não perder</p>');
    expect(await component.leaveEditor()).toBe(false);
    expect(component.formError()).toContain('Documento alterado');
  });

  it('does not create incomplete documents or silently convert an empty legacy link', async () => {
    component.documentForm.controls.title.setValue('');
    expect(await component.saveDocument()).toBe(false);
    component.documentForm.controls.title.setValue('Manual');
    component.editingDocument.set({ ...existing, content_origin: 'legacy_pending' });
    expect(await component.saveDocument()).toBe(false);
    expect(service.saveDocument).not.toHaveBeenCalled();
  });

  it('confirms a manual save with a toast even when there are no pending changes', async () => {
    service.saveDocument.mockResolvedValue({ ...existing, updated_at: 'second' });
    expect(await component.saveDocument(true)).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Documento salvo com sucesso');
  });

  it('alerts with a toast when a manual save fails validation', async () => {
    component.documentForm.controls.title.setValue('');
    expect(await component.saveDocument(true)).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Preencha os campos obrigatórios para salvar.');
  });

  it('toasts a manual save that has to wait for an autosave already in flight', async () => {
    let finish!: (document: GEDDocument) => void;
    service.saveDocument.mockReturnValueOnce(
      new Promise<GEDDocument>((resolve) => {
        finish = resolve;
      }),
    );
    component.bodyChanged(normalizeDocument('<p>Conteúdo</p>'));
    const autosave = component.saveDocument();
    const manual = component.saveDocument(true);
    finish({ ...existing, updated_at: 'second' });
    expect(await autosave).toBe(true);
    expect(await manual).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('Documento salvo com sucesso');
  });
});
