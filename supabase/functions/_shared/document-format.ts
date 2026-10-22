/** Portable, versioned ProseMirror tree; images are embedded in the application's data. */
export interface DocumentContent {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: DocumentContent[];
}

export interface DocumentBody {
  json: DocumentContent;
  html: string;
}

/** Serializable pdfmake nodes shared by browser downloads and trusted server snapshots. */
interface PdfNode {
  [key: string]: unknown;
}

export function attr(node: DocumentContent, key: string, fallback = ''): string {
  return String(node.attrs?.[key] ?? fallback);
}

export function alignment(node: DocumentContent): 'left' | 'center' | 'right' | 'justify' {
  const value = attr(node, 'textAlign');
  return ['left', 'center', 'right', 'justify'].includes(value)
    ? (value as 'left' | 'center' | 'right' | 'justify')
    : 'left';
}

export function textStyle(node: DocumentContent) {
  const attrs = node.marks?.find((mark) => mark.type === 'textStyle')?.attrs ?? {};
  const size = String(attrs['fontSize'] ?? '12pt');
  return {
    bold: !!node.marks?.some((mark) => mark.type === 'bold'),
    italic: !!node.marks?.some((mark) => mark.type === 'italic'),
    underline: !!node.marks?.some((mark) => mark.type === 'underline'),
    strike: !!node.marks?.some((mark) => mark.type === 'strike'),
    font: String(attrs['fontFamily'] ?? 'Arial'),
    size: Math.max(6, Math.min(72, (parseFloat(size) || 12) * (size.endsWith('px') ? 0.75 : 1))),
    color: colorHex(String(attrs['color'] ?? '#172033')),
    background: attrs['backgroundColor'] ? colorHex(String(attrs['backgroundColor'])) : undefined,
    link: String(node.marks?.find((mark) => mark.type === 'link')?.attrs?.['href'] ?? ''),
  };
}

function colorHex(value: string): string {
  if (/^#[\da-f]{6}$/i.test(value)) return value;
  if (/^#[\da-f]{3}$/i.test(value)) return '#' + [...value.slice(1)].map((c) => c + c).join('');
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb)
    return (
      '#' +
      rgb
        .slice(1, 4)
        .map((c) => Math.min(255, Number(c)).toString(16).padStart(2, '0'))
        .join('')
    );
  return '#172033';
}

export function imageData(node: DocumentContent) {
  const src = attr(node, 'src');
  const type = src.startsWith('data:image/png;') ? ('png' as const) : ('jpg' as const);
  const data = Uint8Array.from(atob(src.split(',')[1] ?? ''), (c) => c.charCodeAt(0));
  let pixelWidth = 500;
  let pixelHeight = 300;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (type === 'png' && data.length >= 24) {
    pixelWidth = view.getUint32(16);
    pixelHeight = view.getUint32(20);
  } else if (type === 'jpg') {
    let offset = 2;
    while (offset + 9 < data.length && data[offset] === 0xff) {
      const marker = data[offset + 1];
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker,
        )
      ) {
        pixelHeight = view.getUint16(offset + 5);
        pixelWidth = view.getUint16(offset + 7);
        break;
      }
      const size = view.getUint16(offset + 2);
      if (size < 2) break;
      offset += size + 2;
    }
  }
  const positive = (value: unknown, fallback: number) =>
    Number.isFinite(Number(value)) && Number(value) > 0 ? Math.min(10000, Number(value)) : fallback;
  const naturalWidth = positive(node.attrs?.['width'], positive(pixelWidth, 500));
  const naturalHeight = positive(
    node.attrs?.['height'],
    (positive(pixelHeight, 300) * naturalWidth) / positive(pixelWidth, 500),
  );
  const scale = Math.min(1, 640 / naturalWidth, 900 / naturalHeight);
  return { src, data, type, width: naturalWidth * scale, height: naturalHeight * scale };
}

/** Expand spans into a rectangular grid for PDF and ODF covered cells. */
export function tableGrid(node: DocumentContent): (DocumentContent | null)[][] {
  const grid: (DocumentContent | null)[][] = [];
  for (const [r, row] of (node.content ?? []).entries()) {
    grid[r] ??= [];
    let c = 0;
    for (const cell of row.content ?? []) {
      while (grid[r][c] !== undefined) c++;
      const cols = Math.max(1, Math.min(50, Number(cell.attrs?.['colspan']) || 1));
      const rows = Math.max(1, Math.min(100, Number(cell.attrs?.['rowspan']) || 1));
      for (let y = 0; y < rows; y++) {
        grid[r + y] ??= [];
        for (let x = 0; x < cols; x++) grid[r + y][c + x] = y === 0 && x === 0 ? cell : null;
      }
      c += cols;
    }
  }
  const width = Math.max(1, ...grid.map((row) => row.length));
  return grid.map((row) => Array.from({ length: width }, (_, c) => row[c] ?? null));
}

function inline(node: DocumentContent): PdfNode[] {
  if (node.type === 'hardBreak') return [{ text: '\n' }];
  if (node.type === 'text') {
    const style = textStyle(node);
    return [
      {
        text: node.text ?? '',
        bold: style.bold || undefined,
        italics: style.italic || undefined,
        fontSize: node.marks?.some((mark) => mark.attrs?.['fontSize']) ? style.size : undefined,
        color: style.color,
        background: style.background,
        link: style.link || undefined,
        decoration: [
          ...(style.underline ? ['underline' as const] : []),
          ...(style.strike ? ['lineThrough' as const] : []),
        ],
      },
    ];
  }
  return (node.content ?? []).flatMap(inline);
}

function block(node: DocumentContent): PdfNode {
  const children = () => (node.content ?? []).map(block);
  switch (node.type) {
    case 'doc':
    case 'listItem':
      return { stack: children() };
    case 'bulletList':
      return { ul: children(), margin: [0, 0, 0, 8] };
    case 'orderedList':
      return { ol: children(), start: Number(node.attrs?.['start']) || 1, margin: [0, 0, 0, 8] };
    case 'blockquote':
      return { stack: children(), margin: [16, 4, 0, 8] };
    case 'image': {
      const img = imageData(node);
      return { image: img.src, fit: [img.width * 0.75, img.height * 0.75], margin: [0, 4, 0, 8] };
    }
    case 'pageBreak':
      return { text: '', pageBreak: 'after' };
    case 'horizontalRule':
      return {
        canvas: [{ type: 'line', x1: 0, y1: 4, x2: 480, y2: 4, lineWidth: 1 }],
        margin: [0, 4, 0, 8],
      };
    case 'table': {
      const grid = tableGrid(node);
      const body: PdfNode[][] = grid.map((row) =>
        row.map((cell): PdfNode =>
          cell
            ? {
                stack: (cell.content ?? []).map(block),
                colSpan: Number(cell.attrs?.['colspan']) || 1,
                rowSpan: Number(cell.attrs?.['rowspan']) || 1,
                fillColor: cell.type === 'tableHeader' ? '#eef2f7' : undefined,
                bold: cell.type === 'tableHeader',
                margin: [4, 4, 4, 4],
              }
            : {},
        ),
      );
      if (!body.length) return { text: '' };
      return {
        table: {
          headerRows: node.content?.[0]?.content?.every((c) => c.type === 'tableHeader') ? 1 : 0,
          widths: grid[0].map(() => '*'),
          body,
        },
        margin: [0, 8, 0, 12],
      };
    }
    default:
      return {
        text: inline(node),
        alignment: alignment(node),
        margin: [0, node.type === 'heading' ? 10 : 0, 0, 8],
        ...(node.type === 'heading'
          ? { bold: true, fontSize: [24, 18, 14][Number(node.attrs?.['level'] ?? 1) - 1] ?? 14 }
          : {}),
      };
  }
}

export function pdfDefinition(content: DocumentContent, title: string) {
  return {
    info: { title, creator: 'QualiQ' },
    pageSize: 'A4',
    pageMargins: [56.7, 56.7, 56.7, 56.7],
    defaultStyle: { font: 'Roboto', fontSize: 12, lineHeight: 1.2, color: '#172033' },
    content: block(content),
  };
}
