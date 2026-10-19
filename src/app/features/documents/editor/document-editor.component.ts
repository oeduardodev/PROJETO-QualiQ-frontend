import {
  AfterViewInit,
  Component,
  ElementRef,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import type { DocumentBody, DocumentContent } from '@core/models/document-content';
import {
  documentExtensions,
  EMPTY_DOCUMENT,
  FONTS,
  FONT_SIZES,
  MAX_DOCUMENT_BYTES,
  normalizeDocument,
  safeImage,
} from './document-schema';

@Component({
  selector: 'app-document-editor',
  templateUrl: './document-editor.component.html',
  styleUrl: './document-editor.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class DocumentEditorComponent implements AfterViewInit, OnDestroy {
  readonly initialContent = input<DocumentContent | string>(EMPTY_DOCUMENT);
  readonly readonly = input(false);
  readonly bodyChange = output<DocumentBody>();
  readonly surface = viewChild.required<ElementRef<HTMLDivElement>>('surface');
  readonly fonts = FONTS;
  readonly sizes = FONT_SIZES;
  readonly error = signal('');
  readonly importing = signal(false);
  readonly revision = signal(0);
  editor?: Editor;

  ngAfterViewInit(): void {
    const body = normalizeDocument(this.initialContent());
    this.editor = new Editor({
      element: this.surface().nativeElement,
      extensions: documentExtensions(),
      content: body.json,
      editable: !this.readonly(),
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-label': 'Conteúdo do documento',
          'aria-multiline': 'true',
          class: 'document-paper',
        },
        handlePaste: (_view, event) => {
          const files = [...(event.clipboardData?.files ?? [])];
          if (files.length) {
            void this.insertImage(files[0]);
            return true;
          }
          return false;
        },
        handleDrop: (_view, event) => {
          const file = event.dataTransfer?.files[0];
          if (file) {
            void this.insertImage(file);
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor }) =>
        this.bodyChange.emit({ json: editor.getJSON(), html: editor.getHTML() }),
      onTransaction: () => this.revision.update((value) => value + 1),
    });
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }

  active(name: string, attrs?: Record<string, unknown>): boolean {
    this.revision();
    return this.editor?.isActive(name, attrs) ?? false;
  }

  command(name: string): void {
    const chain = this.editor?.chain().focus();
    if (!chain) return;
    switch (name) {
      case 'bold':
        chain.toggleBold().run();
        break;
      case 'italic':
        chain.toggleItalic().run();
        break;
      case 'underline':
        chain.toggleUnderline().run();
        break;
      case 'strike':
        chain.toggleStrike().run();
        break;
      case 'undo':
        chain.undo().run();
        break;
      case 'redo':
        chain.redo().run();
        break;
      case 'bulletList':
        chain.toggleBulletList().run();
        break;
      case 'orderedList':
        chain.toggleOrderedList().run();
        break;
      case 'table':
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        break;
      case 'row':
        chain.addRowAfter().run();
        break;
      case 'column':
        chain.addColumnAfter().run();
        break;
      case 'deleteRow':
        chain.deleteRow().run();
        break;
      case 'deleteColumn':
        chain.deleteColumn().run();
        break;
      case 'deleteTable':
        chain.deleteTable().run();
        break;
      case 'pageBreak':
        if (this.editor?.isActive('table') || this.editor?.isActive('listItem')) {
          chain.insertContentAt(this.editor.state.selection.$from.after(1), [{ type: 'pageBreak' }, { type: 'paragraph' }]).run();
        } else chain.insertContent({ type: 'pageBreak' }).run();
        break;
      case 'clear':
        chain.unsetAllMarks().clearNodes().run();
        break;
    }
  }

  heading(value: string): void {
    if (value === '0') this.editor?.chain().focus().setParagraph().run();
    else
      this.editor
        ?.chain()
        .focus()
        .toggleHeading({ level: Number(value) as 1 | 2 | 3 })
        .run();
  }

  link(): void {
    const href = window.prompt(
      'Endereço do link (https:// ou mailto:)',
      this.editor?.getAttributes('link')['href'] ?? 'https://',
    );
    if (href === null) return;
    if (!href.trim()) {
      this.editor?.chain().focus().unsetLink().run();
      return;
    }
    if (!/^(https?:\/\/|mailto:)/i.test(href)) {
      this.error.set('Informe um endereço https://, http:// ou mailto:.');
      return;
    }
    this.editor?.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  async imageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) await this.insertImage(input.files[0]);
    input.value = '';
  }

  async insertImage(file: File): Promise<void> {
    if (this.readonly()) return;
    this.error.set('');
    try {
      if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024)
        throw new Error('Use uma imagem PNG ou JPEG de até 2 MB.');
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      if (!safeImage(src)) throw new Error('Imagem inválida.');
      const bitmap = await createImageBitmap(file);
      const width = Math.min(bitmap.width, 600);
      const height = Math.round((bitmap.height * width) / bitmap.width);
      bitmap.close();
      this.editor
        ?.chain()
        .focus()
        .insertContent({ type: 'image', attrs: { src, alt: file.name, width, height } })
        .run();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Não foi possível inserir a imagem.');
    }
  }

  async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.editor) return;
    this.importing.set(true);
    this.error.set('');
    try {
      if (file.size > MAX_DOCUMENT_BYTES) throw new Error('O arquivo deve ter até 8 MB.');
      let html: string;
      if (/\.docx$/i.test(file.name)) {
        const mammoth = await import('mammoth');
        const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
        html = result.value;
      } else if (/\.html?$/i.test(file.name)) html = await file.text();
      else throw new Error('Selecione um arquivo DOCX ou HTML.');
      const body = normalizeDocument(html);
      if (new Blob([JSON.stringify(body.json)]).size > MAX_DOCUMENT_BYTES)
        throw new Error('O conteúdo importado excede 8 MB.');
      this.editor.commands.setContent(body.json);
      this.error.set(
        'Importação concluída. Revise a formatação. Imagens externas não são importadas; use PNG/JPEG incorporados. Desfazer restaura o conteúdo anterior.',
      );
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Não foi possível importar o arquivo.',
      );
    } finally {
      this.importing.set(false);
      input.value = '';
    }
  }
}
