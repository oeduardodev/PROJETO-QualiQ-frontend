import { Editor, Node, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import type { DocumentBody, DocumentContent } from '@core/models/document-content';

export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
export const EMPTY_DOCUMENT: DocumentContent = { type: 'doc', content: [{ type: 'paragraph' }] };
export const FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Courier New'];
export const FONT_SIZES = ['10', '11', '12', '14', '16', '18', '24', '32', '48'];

export function safeImage(src: unknown): src is string {
  return typeof src === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\s]+$/.test(src);
}

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  parseHTML: () => [{ tag: 'div[data-page-break]' }],
  renderHTML: () => ['div', { 'data-page-break': '', class: 'document-page-break' }],
});

const EmbeddedImage = Image.extend({
  parseHTML: () => [
    {
      tag: 'img[src]',
      getAttrs: (element) => (safeImage(element.getAttribute('src')) ? {} : false),
    },
  ],
});

export function documentExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        protocols: ['https', 'http', 'mailto'],
        defaultProtocol: 'https',
      },
    }),
    TextStyleKit,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TableKit.configure({ table: { resizable: false } }),
    EmbeddedImage.configure({
      allowBase64: true,
      resize: { enabled: true, alwaysPreserveAspectRatio: true },
    }),
    PageBreak,
  ];
}

/** A schema round trip drops unsupported markup. No arbitrary HTML is rendered as trusted HTML. */
export function normalizeDocument(content: DocumentContent | string): DocumentBody {
  const safe = typeof content === 'string' ? content : structuredClone(content);
  if (typeof safe !== 'string') sanitizeTree(safe);
  const editor = new Editor({ extensions: documentExtensions(), content: safe as JSONContent });
  try {
    const json = editor.getJSON();
    sanitizeTree(json);
    editor.commands.setContent(json, { emitUpdate: false });
    return { json: editor.getJSON(), html: editor.getHTML() };
  } finally {
    editor.destroy();
  }
}

export function sanitizeTree(node: DocumentContent): void {
  if (node.attrs) {
    const attrs = node.attrs;
    if (
      attrs['textAlign'] &&
      !['left', 'center', 'right', 'justify'].includes(String(attrs['textAlign']))
    )
      delete attrs['textAlign'];
  }
  node.marks = node.marks?.filter((mark) => {
    if (mark.type === 'link')
      return /^(https?:\/\/|mailto:)/i.test(String(mark.attrs?.['href'] ?? ''));
    if (mark.type === 'textStyle' && mark.attrs) {
      for (const key of ['color', 'backgroundColor']) {
        const value = String(mark.attrs[key] ?? '');
        if (!/^(#[\da-f]{3,8}|rgba?\([\d\s,.%]+\)|[a-z]+)$/i.test(value)) delete mark.attrs[key];
      }
      if (!FONTS.includes(String(mark.attrs['fontFamily']))) delete mark.attrs['fontFamily'];
      if (!/^\d{1,2}(px|pt)$/.test(String(mark.attrs['fontSize']))) delete mark.attrs['fontSize'];
    }
    return true;
  });
  node.content = node.content?.filter(
    (child) => child.type !== 'image' || safeImage(child.attrs?.['src']),
  );
  node.content?.forEach(sanitizeTree);
}
