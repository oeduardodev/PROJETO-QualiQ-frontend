import { strToU8, zipSync, type Zippable } from 'fflate';
import type { DocumentContent } from '@core/models/document-content';
import { alignment, attr, imageData, tableGrid, textStyle } from './export-utils';

const MIME = 'application/vnd.oasis.opendocument.text';
const NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"';
const XML = '<?xml version="1.0" encoding="UTF-8"?>';
const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
const text = (s: string) =>
  esc(s)
    .replace(/ {2,}/g, (spaces) => `<text:s text:c="${spaces.length}"/>`)
    .replace(/\t/g, '<text:tab/>')
    .replace(/\n/g, '<text:line-break/>');

export function exportOdt(content: DocumentContent, title: string): Blob {
  const files: Zippable = { mimetype: [strToU8(MIME), { level: 0 }] };
  const automatic: string[] = [];
  const manifest: string[] = [];
  let counter = 0;

  function style(family: string, properties: string): string {
    const name = `S${++counter}`;
    automatic.push(
      `<style:style style:name="${name}" style:family="${family}">${properties}</style:style>`,
    );
    return name;
  }

  function inline(node: DocumentContent): string {
    if (node.type === 'hardBreak') return '<text:line-break/>';
    if (node.type !== 'text') return (node.content ?? []).map(inline).join('');
    const s = textStyle(node);
    const name = style(
      'text',
      `<style:text-properties fo:font-family="${esc(s.font)}"${node.marks?.some((m) => m.attrs?.['fontSize']) ? ` fo:font-size="${s.size}pt"` : ''} fo:color="${s.color}"${s.background ? ` fo:background-color="${s.background}"` : ''}${s.bold ? ' fo:font-weight="bold"' : ''}${s.italic ? ' fo:font-style="italic"' : ''}${s.underline ? ' style:text-underline-style="solid" style:text-underline-width="auto"' : ''}${s.strike ? ' style:text-line-through-style="solid"' : ''}/>`,
    );
    const span = `<text:span text:style-name="${name}">${text(node.text ?? '')}</text:span>`;
    return s.link
      ? `<text:a xlink:type="simple" xlink:href="${esc(s.link)}">${span}</text:a>`
      : span;
  }

  function block(node: DocumentContent): string {
    const children = () => (node.content ?? []).map(block).join('');
    switch (node.type) {
      case 'doc':
      case 'blockquote':
        return children();
      case 'listItem':
        return `<text:list-item>${children()}</text:list-item>`;
      case 'bulletList':
      case 'orderedList': {
        const name = `L${++counter}`;
        const ordered = node.type === 'orderedList';
        automatic.push(
          `<text:list-style style:name="${name}">${Array.from({ length: 10 }, (_, i) =>
            ordered
              ? `<text:list-level-style-number text:level="${i + 1}" style:num-format="1" style:num-suffix="." text:start-value="${Number(node.attrs?.['start']) || 1}"><style:list-level-properties text:space-before="${0.6 * (i + 1)}cm" text:min-label-width="0.5cm"/></text:list-level-style-number>`
              : `<text:list-level-style-bullet text:level="${i + 1}" text:bullet-char="•"><style:list-level-properties text:space-before="${0.6 * (i + 1)}cm" text:min-label-width="0.5cm"/></text:list-level-style-bullet>`,
          ).join('')}</text:list-style>`,
        );
        return `<text:list text:style-name="${name}">${children()}</text:list>`;
      }
      case 'pageBreak': {
        const name = style('paragraph', '<style:paragraph-properties fo:break-after="page"/>');
        return `<text:p text:style-name="${name}"/>`;
      }
      case 'image': {
        const img = imageData(node);
        const path = `Pictures/image${++counter}.${img.type}`;
        files[path] = img.data;
        manifest.push(
          `<manifest:file-entry manifest:full-path="${path}" manifest:media-type="image/${img.type === 'jpg' ? 'jpeg' : 'png'}"/>`,
        );
        return `<text:p><draw:frame draw:name="Image${counter}" text:anchor-type="as-char" svg:width="${(img.width / 96) * 2.54}cm" svg:height="${(img.height / 96) * 2.54}cm"><draw:image xlink:href="${path}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/><svg:title>${esc(attr(node, 'alt'))}</svg:title></draw:frame></text:p>`;
      }
      case 'table': {
        const grid = tableGrid(node);
        const name = style(
          'table',
          '<style:table-properties style:width="17cm" table:align="margins"/>',
        );
        const column = style(
          'table-column',
          `<style:table-column-properties style:column-width="${17 / (grid[0]?.length || 1)}cm"/>`,
        );
        return `<table:table table:name="Table${++counter}" table:style-name="${name}"><table:table-column table:style-name="${column}" table:number-columns-repeated="${grid[0]?.length || 1}"/>${grid
          .map(
            (row) =>
              `<table:table-row>${row
                .map((cell) => {
                  if (!cell) return '<table:covered-table-cell/>';
                  const cellStyle = style(
                    'table-cell',
                    `<style:table-cell-properties fo:border="0.5pt solid #94a3b8" fo:padding="0.12cm"${cell.type === 'tableHeader' ? ' fo:background-color="#eef2f7"' : ''}/>`,
                  );
                  return `<table:table-cell table:style-name="${cellStyle}" table:number-columns-spanned="${Number(cell.attrs?.['colspan']) || 1}" table:number-rows-spanned="${Number(cell.attrs?.['rowspan']) || 1}">${(cell.content ?? []).map(block).join('') || '<text:p/>'}</table:table-cell>`;
                })
                .join('')}</table:table-row>`,
          )
          .join('')}</table:table>`;
      }
      default: {
        const heading = node.type === 'heading';
        const level = Number(node.attrs?.['level']) || 1;
        const name = style(
          'paragraph',
          `<style:paragraph-properties fo:text-align="${alignment(node) === 'justify' ? 'justify' : alignment(node) === 'left' ? 'start' : alignment(node) === 'right' ? 'end' : 'center'}" fo:margin-bottom="0.28cm"/>${heading ? `<style:text-properties fo:font-weight="bold" fo:font-size="${[24, 18, 14][level - 1] || 14}pt"/>` : ''}`,
        );
        const tag = heading ? 'text:h' : 'text:p';
        return `<${tag} text:style-name="${name}"${heading ? ` text:outline-level="${level}"` : ''}>${inline(node)}</${tag}>`;
      }
    }
  }

  const body = block(content);
  files['content.xml'] = strToU8(
    `${XML}<office:document-content ${NS} office:version="1.3"><office:automatic-styles>${automatic.join('')}</office:automatic-styles><office:body><office:text>${body}</office:text></office:body></office:document-content>`,
  );
  files['styles.xml'] = strToU8(
    `${XML}<office:document-styles ${NS} office:version="1.3"><office:styles><style:default-style style:family="paragraph"><style:paragraph-properties fo:line-height="150%"/><style:text-properties fo:font-family="Arial" fo:font-size="12pt"/></style:default-style></office:styles><office:automatic-styles><style:page-layout style:name="A4"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:margin="2cm" style:print-orientation="portrait"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Standard" style:page-layout-name="A4"/></office:master-styles></office:document-styles>`,
  );
  files['meta.xml'] = strToU8(
    `${XML}<office:document-meta ${NS} xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.3"><office:meta><dc:title>${esc(title)}</dc:title></office:meta></office:document-meta>`,
  );
  files['META-INF/manifest.xml'] = strToU8(
    `${XML}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="${MIME}" manifest:version="1.3"/>${['content.xml', 'styles.xml', 'meta.xml'].map((path) => `<manifest:file-entry manifest:full-path="${path}" manifest:media-type="text/xml"/>`).join('')}${manifest.join('')}</manifest:manifest>`,
  );
  return new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], { type: MIME });
}
