import { Component, inject, input, signal } from '@angular/core';
import type { GEDDocument } from '@core/models/database';
import { DocumentEditorComponent } from './editor/document-editor.component';
import { DocumentExportService, type DocumentFormat } from './data-access/document-export.service';
import { errorMessage } from '@shared/utils/error.utils';

@Component({
  selector: 'app-document-viewer',
  imports: [DocumentEditorComponent],
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p class="text-xs text-slate-500">{{ document().code }} · Versão {{ document().version }}</p>
      @if (printAllowed() && (document().content_json || document().content_html)) {
        <div class="flex gap-2">
          @for (format of formats; track format) {
            <button class="ui-button-secondary" [disabled]="busy()" (click)="download(format)">
              Baixar .{{ format }}
            </button>
          }
        </div>
      }
    </div>
    @if (error()) {
      <p class="mb-3 text-sm text-rose-600" role="alert">{{ error() }}</p>
    }
    <div
      [class.document-protected]="!printAllowed()"
      (copy)="protect($event)"
      (cut)="protect($event)"
      (contextmenu)="protect($event)"
      (dragstart)="protect($event)"
    >
      @if (document().content_json || document().content_html) {
        @for (
          version of [document()];
          track version.id + ':' + version.version + ':' + version.updated_at
        ) {
          <app-document-editor
            [initialContent]="version.content_json ?? version.content_html!"
            [readonly]="true"
          />
        }
      } @else {
        <p class="text-sm text-slate-500">
          Conteúdo ainda não armazenado. O responsável pode importar um arquivo DOCX ou HTML no
          editor.
        </p>
      }
    </div>
  `,
  styles: `
    .document-protected {
      user-select: none;
      -webkit-user-select: none;
    }
    @media print {
      .document-protected {
        display: none !important;
      }
    }
  `,
})
export class DocumentViewerComponent {
  readonly document = input.required<GEDDocument>();
  readonly printAllowed = input(false);
  readonly formats: DocumentFormat[] = ['docx', 'pdf', 'odt'];
  readonly busy = signal(false);
  readonly error = signal('');
  private readonly exporter = inject(DocumentExportService);

  protect(event: Event): void {
    if (!this.printAllowed()) event.preventDefault();
  }

  async download(format: DocumentFormat): Promise<void> {
    if (!this.printAllowed() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.exporter.download(this.document(), format);
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível exportar.'));
    } finally {
      this.busy.set(false);
    }
  }
}
