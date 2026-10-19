import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from 'docx';
import type { DocumentContent } from '@core/models/document-content';
import { alignment, imageData, textStyle } from './export-utils';

export function exportDocx(content: DocumentContent, title: string): Promise<Blob> {
  let listId = 0;
  const lists: { reference: string; ordered: boolean; start: number }[] = [];

  function inline(node: DocumentContent): ParagraphChild[] {
    if (node.type === 'hardBreak') return [new TextRun({ break: 1 })];
    if (node.type === 'text') {
      const style = textStyle(node);
      const run = new TextRun({
        text: node.text ?? '',
        bold: style.bold || undefined,
        italics: style.italic || undefined,
        underline: style.underline ? {} : undefined,
        strike: style.strike || undefined,
        font: node.marks?.some((m) => m.attrs?.['fontFamily']) ? style.font : undefined,
        size: node.marks?.some((m) => m.attrs?.['fontSize']) ? style.size * 2 : undefined,
        color: style.color.slice(1),
        shading: style.background ? { fill: style.background.slice(1) } : undefined,
      });
      return style.link ? [new ExternalHyperlink({ children: [run], link: style.link })] : [run];
    }
    return (node.content ?? []).flatMap(inline);
  }

  function blocks(
    node: DocumentContent,
    list?: { reference: string; level: number },
  ): (Paragraph | Table)[] {
    switch (node.type) {
      case 'doc':
      case 'blockquote':
        return (node.content ?? []).flatMap((n) => blocks(n, list));
      case 'bulletList':
      case 'orderedList': {
        const reference = `list-${++listId}`;
        lists.push({
          reference,
          ordered: node.type === 'orderedList',
          start: Number(node.attrs?.['start']) || 1,
        });
        return (node.content ?? []).flatMap((n) =>
          blocks(n, { reference, level: Math.min(8, (list?.level ?? -1) + 1) }),
        );
      }
      case 'listItem':
        return (node.content ?? []).flatMap((n, i) =>
          blocks(n, i === 0 || n.type?.endsWith('List') ? list : undefined),
        );
      case 'pageBreak':
        return [new Paragraph({ children: [new PageBreak()] })];
      case 'image': {
        const img = imageData(node);
        return [
          new Paragraph({
            children: [
              new ImageRun({
                type: img.type,
                data: img.data,
                transformation: { width: img.width, height: img.height },
                altText: { name: String(node.attrs?.['alt'] ?? ''), title: '', description: '' },
              }),
            ],
          }),
        ];
      }
      case 'table':
        return [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: (node.content ?? []).map(
              (row) =>
                new TableRow({
                  tableHeader: row.content?.every((cell) => cell.type === 'tableHeader'),
                  children: (row.content ?? []).map(
                    (cell) =>
                      new TableCell({
                        columnSpan: Number(cell.attrs?.['colspan']) || 1,
                        rowSpan: Number(cell.attrs?.['rowspan']) || 1,
                        shading: cell.type === 'tableHeader' ? { fill: 'EEF2F7' } : undefined,
                        children: cell.content?.length
                          ? cell.content.flatMap((n) => blocks(n))
                          : [new Paragraph('')],
                      }),
                  ),
                }),
            ),
          }),
        ];
      case 'horizontalRule':
        return [
          new Paragraph({ border: { bottom: { color: '94A3B8', size: 6, style: 'single' } } }),
        ];
      default:
        return [
          new Paragraph({
            children: inline(node),
            alignment: {
              left: AlignmentType.LEFT,
              center: AlignmentType.CENTER,
              right: AlignmentType.RIGHT,
              justify: AlignmentType.JUSTIFIED,
            }[alignment(node)],
            heading:
              node.type === 'heading'
                ? [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][
                    Number(node.attrs?.['level'] ?? 1) - 1
                  ]
                : undefined,
            numbering: list,
            spacing: { after: 160, line: 300 },
          }),
        ];
    }
  }

  const children = blocks(content);
  return Packer.toBlob(
    new Document({
      title,
      creator: 'Orbis',
      styles: { default: { document: { run: { font: 'Arial', size: 24 } } } },
      numbering: {
        config: lists.map((list) => ({
          reference: list.reference,
          levels: Array.from({ length: 9 }, (_, level) => ({
            level,
            format: list.ordered ? LevelFormat.DECIMAL : LevelFormat.BULLET,
            text: list.ordered ? `%${level + 1}.` : '•',
            start: list.start,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 260 } } },
          })),
        })),
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
            },
          },
          children,
        },
      ],
    }),
  );
}
