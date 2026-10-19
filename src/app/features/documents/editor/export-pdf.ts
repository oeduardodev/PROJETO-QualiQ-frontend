import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { DocumentContent } from '@core/models/document-content';
import { pdfDefinition } from '../../../../../supabase/functions/_shared/document-format';
export { pdfDefinition } from '../../../../../supabase/functions/_shared/document-format';

export async function exportPdf(content: DocumentContent, title: string): Promise<Blob> {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  return pdfMake
    .createPdf(pdfDefinition(content, title) as unknown as TDocumentDefinitions)
    .getBlob();
}
