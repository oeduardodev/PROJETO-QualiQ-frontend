import pdfMake from 'npm:pdfmake@0.3.11/build/pdfmake.js';
import fonts from 'npm:pdfmake@0.3.11/build/vfs_fonts.js';
import { pdfDefinition, imageData } from './document-format.ts';

Deno.test('trusted PDF renderer runs in Deno with embedded fonts and A4 page breaks', async () => {
  pdfMake.addVirtualFileSystem(fonts);
  const definition = pdfDefinition({ type: 'doc', content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Revisão de qualidade' }] },
    { type: 'pageBreak' },
    { type: 'paragraph', content: [{ type: 'text', text: 'Edição preservada: ação, aprovação e cópia.' }] },
  ] }, 'Teste nativo');
  const pdf = await pdfMake.createPdf(definition as unknown as Parameters<typeof pdfMake.createPdf>[0]).getBuffer();
  if (new TextDecoder().decode(pdf.subarray(0, 5)) !== '%PDF-' || pdf.byteLength < 5000) throw new Error('Invalid PDF output');
});

Deno.test('embedded PNG dimensions preserve aspect ratio without a browser', () => {
  const src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const image = imageData({ type: 'image', attrs: { src, width: 120 } });
  if (image.width !== 120 || image.height !== 120) throw new Error('Image aspect ratio lost');
});
