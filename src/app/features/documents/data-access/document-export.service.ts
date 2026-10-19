import { Injectable } from '@angular/core';
import type { GEDDocument } from '@core/models/database';
import type { DocumentContent } from '@core/models/document-content';
import { normalizeDocument } from '../editor/document-schema';

export type DocumentFormat = 'docx' | 'pdf' | 'odt';

@Injectable({ providedIn: 'root' })
export class DocumentExportService {
  async create(content: DocumentContent, title: string, format: DocumentFormat): Promise<Blob> {
    const normalized = normalizeDocument(content).json;
    switch (format) {
      case 'docx':
        return (await import('../editor/export-docx')).exportDocx(normalized, title);
      case 'pdf':
        return (await import('../editor/export-pdf')).exportPdf(normalized, title);
      case 'odt':
        return (await import('../editor/export-odt')).exportOdt(normalized, title);
    }
  }

  async download(document: GEDDocument, format: DocumentFormat): Promise<void> {
    if (!document.content_json && !document.content_html)
      throw new Error('Este documento ainda não tem conteúdo armazenado.');
    const content = document.content_json ?? normalizeDocument(document.content_html!).json;
    const blob = await this.create(content, document.title, format);
    this.saveBlob(blob, `${document.code ? document.code + ' - ' : ''}${document.title}.${format}`);
  }

  saveBlob(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const extension = name.match(/\.(docx|pdf|odt)$/)?.[0] ?? '';
    link.download = name.replace(/[<>:"/\\|?*\p{Cc}]/gu, '_').slice(0, name.length - extension.length).slice(0, 180) + extension;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
