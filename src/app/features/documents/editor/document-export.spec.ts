import { unzipSync, strFromU8 } from 'fflate';
import { Editor } from '@tiptap/core';
import type { DocumentContent } from '@core/models/document-content';
import { documentExtensions, normalizeDocument } from './document-schema';
import { exportDocx } from './export-docx';
import { exportOdt } from './export-odt';
import { pdfDefinition, exportPdf } from './export-pdf';

const image =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const paragraph = (text: string): DocumentContent => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});
const fixture: DocumentContent = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Revisão & qualidade' }],
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [
        {
          type: 'text',
          text: 'Texto formatado',
          marks: [
            { type: 'bold' },
            { type: 'italic' },
            { type: 'underline' },
            {
              type: 'textStyle',
              attrs: { color: '#e11d48', fontFamily: 'Georgia', fontSize: '18pt' },
            },
          ],
        },
        {
          type: 'text',
          text: ' referência',
          marks: [{ type: 'link', attrs: { href: 'https://example.org/a?b=1&c=2' } }],
        },
      ],
    },
    {
      type: 'orderedList',
      attrs: { start: 3 },
      content: [
        {
          type: 'listItem',
          content: [
            paragraph('Primeiro item'),
            {
              type: 'bulletList',
              content: [{ type: 'listItem', content: [paragraph('Item interno')] }],
            },
          ],
        },
      ],
    },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', attrs: { colspan: 2 }, content: [paragraph('Cabeçalho')] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [paragraph('Célula A')] },
            { type: 'tableCell', content: [paragraph('Célula B')] },
          ],
        },
      ],
    },
    { type: 'image', attrs: { src: image, width: 80, height: 80, alt: 'Exemplo' } },
    { type: 'pageBreak' },
    paragraph('Página seguinte'),
  ],
};

async function bytes(blob: Blob): Promise<Uint8Array> {
  if (blob.arrayBuffer) return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

describe('native document format interoperability', () => {
  it('round trips rich content and drops unsafe/external elements', () => {
    const normalized = normalizeDocument(fixture);
    const roundTrip = normalizeDocument(normalized.html);
    expect(roundTrip.html).toContain('data-page-break');
    expect(roundTrip.html).toContain('colspan="2"');
    expect(roundTrip.html).toContain('font-family: Georgia');
    expect(roundTrip.html).toContain('text-align: center');
    expect(roundTrip.html).toContain('data:image/png');
    const unsafe = normalizeDocument(
      '<script>alert(1)</script><p onclick="alert(1)">Safe<a href="javascript:alert(1)">link</a><img src="https://tracker.invalid/x.png"><iframe src="https://example.org"></iframe></p>',
    );
    expect(unsafe.html).not.toMatch(/script|onclick|javascript:|iframe|tracker/);
    expect(unsafe.html).toContain('Safe');
  });

  it('supports undo and redo of native page breaks and tables', () => {
    const editor = new Editor({ extensions: documentExtensions(), content: '<p>Início</p>' });
    try {
      editor.commands.insertContent({ type: 'pageBreak' });
      expect(editor.getHTML()).toContain('data-page-break');
      editor.commands.undo();
      expect(editor.getHTML()).not.toContain('data-page-break');
      editor.commands.redo();
      expect(editor.getHTML()).toContain('data-page-break');
      editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true });
      expect(editor.getHTML()).toContain('<table');
    } finally {
      editor.destroy();
    }
  });

  it('creates a real OOXML package with images, styles, links, tables and page breaks', async () => {
    const zip = unzipSync(await bytes(await exportDocx(fixture, 'Documento')));
    const xml = strFromU8(zip['word/document.xml']);
    expect(xml).toContain('Revisão &amp; qualidade');
    expect(xml).toContain('w:val="Heading1"');
    expect(xml).toContain('w:val="center"');
    expect(xml).toContain('w:ascii="Georgia"');
    expect(xml).toContain('w:type="page"');
    expect(xml).toContain('w:gridSpan w:val="2"');
    expect(xml).toContain('w:hyperlink');
    expect(
      Object.keys(zip).some((key) => key.startsWith('word/media/') && key.endsWith('.png')),
    ).toBe(true);
    expect(strFromU8(zip['word/numbering.xml'])).toContain('w:start w:val="3"');
  });

  it('creates an ODF package with an uncompressed first mimetype entry and valid XML', async () => {
    const data = await bytes(exportOdt(fixture, 'Revisão & teste'));
    // ZIP local file header: compression method at offset 8.
    expect(data[8]).toBe(0);
    expect(data[9]).toBe(0);
    expect(strFromU8(data.slice(30, 38))).toBe('mimetype');
    const zip = unzipSync(data);
    expect(strFromU8(zip['mimetype'])).toBe('application/vnd.oasis.opendocument.text');
    for (const key of ['content.xml', 'styles.xml', 'meta.xml', 'META-INF/manifest.xml']) {
      expect(
        new DOMParser()
          .parseFromString(strFromU8(zip[key]), 'text/xml')
          .querySelector('parsererror'),
      ).toBeNull();
    }
    const xml = strFromU8(zip['content.xml']);
    expect(xml).toContain('fo:break-after="page"');
    expect(xml).toContain('table:covered-table-cell');
    expect(xml).toContain('fo:font-family="Georgia"');
    expect(xml).toContain('text:start-value="3"');
    expect(Object.keys(zip).some((key) => key.startsWith('Pictures/'))).toBe(true);
    expect(strFromU8(zip['styles.xml'])).toContain('fo:page-width="21cm"');
  });

  it('generates a PDF containing the supported layout without remote assets', async () => {
    const definition = JSON.stringify(pdfDefinition(fixture, 'Documento'));
    expect(definition).toContain('"pageSize":"A4"');
    expect(definition).toContain('"pageBreak":"after"');
    expect(definition).toContain('"colSpan":2');
    expect(definition).toContain('"alignment":"center"');
    const data = await bytes(await exportPdf(fixture, 'Documento'));
    expect(strFromU8(data.slice(0, 5))).toBe('%PDF-');
    expect(data.length).toBeGreaterThan(5000);
  }, 30000);
});
