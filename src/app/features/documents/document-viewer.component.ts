import { Component, input } from '@angular/core';
import type { GEDDocument } from '@core/models/database';

@Component({
  selector: 'app-document-viewer',
  template: `
    @if (printAllowed() && document().content_html) {
      <button class="ui-button-secondary mb-4 print:hidden" (click)="print()">Imprimir</button>
    }
    <div
      class="document-viewer"
      [class.document-protected]="!printAllowed()"
      (copy)="protect($event)"
      (cut)="protect($event)"
      (contextmenu)="protect($event)"
      (dragstart)="protect($event)"
    >
      <p class="mb-4 text-xs text-slate-500">
        {{ document().code }} · Versão {{ document().version }}
      </p>
      @if (document().content_html) {
        <div class="document-content" [innerHTML]="document().content_html"></div>
      } @else {
        <p class="text-sm text-slate-500">
          Conteúdo ainda não sincronizado. O responsável deve sincronizar o documento no
          gerenciamento.
        </p>
      }
    </div>
  `,
  styles: `
    .document-protected {
      user-select: none;
      -webkit-user-select: none;
    }
    .document-content {
      overflow-wrap: anywhere;
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

  protect(event: Event): void {
    if (!this.printAllowed()) event.preventDefault();
  }

  print(): void {
    if (this.printAllowed()) window.print();
  }
}
