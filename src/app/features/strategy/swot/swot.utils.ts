import type {
  SwotAnalysis,
  SwotItem,
  SwotQuadrant,
  SwotStatus,
  SwotStrategy,
} from '@core/models/database';
import { QUADRANTS, STRATEGIES } from './swot.constants';

/** Strategies an item takes part in, derived from the quadrant it was filed under. */
export function swotStrategies(quadrant: SwotQuadrant): SwotStrategy[] {
  return STRATEGIES.filter((strategy) => strategy.sources.includes(quadrant)).map(
    (strategy) => strategy.key,
  );
}

export function swotItemsByQuadrant(items: SwotItem[], quadrant: SwotQuadrant): SwotItem[] {
  return items.filter((item) => item.quadrant === quadrant);
}

export function swotItemsByStrategy(items: SwotItem[], strategy: SwotStrategy): SwotItem[] {
  const sources = STRATEGIES.find((entry) => entry.key === strategy)?.sources ?? [];
  return items.filter((item) => sources.includes(item.quadrant));
}

export function swotStatusLabel(status: SwotStatus): string {
  return (
    {
      em_construcao: 'Em construção',
      em_revisao: 'Em revisão',
      concluida: 'Concluída',
    } as Record<SwotStatus, string>
  )[status];
}

export function swotStatusClass(status: SwotStatus): string {
  return (
    {
      em_construcao: 'bg-amber-100 text-amber-700',
      em_revisao: 'bg-blue-100 text-blue-700',
      concluida: 'bg-emerald-100 text-emerald-700',
    } as Record<SwotStatus, string>
  )[status];
}

export function swotQuadrantLabel(quadrant: SwotQuadrant): string {
  return QUADRANTS.find((entry) => entry.key === quadrant)?.label ?? quadrant;
}

function csvCell(value: string | null): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  return `"${text.replace(/"/g, '""')}"`;
}

export function swotCsv(analysis: SwotAnalysis, items: SwotItem[]): string {
  const header = ['Análise', 'Período', 'Quadrante', 'Fator', 'Descrição', 'Estratégias FOFA'];
  const rows = QUADRANTS.flatMap((quadrant) =>
    swotItemsByQuadrant(items, quadrant.key)
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((item) => [
        csvCell(analysis.title),
        csvCell(analysis.period),
        csvCell(quadrant.label),
        csvCell(item.title),
        csvCell(item.description),
        csvCell(swotStrategies(item.quadrant).join(' / ')),
      ]),
  );
  return [header.map(csvCell).join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');
}

/** Filesystem-safe slug used to name the generated .csv file. */
export function swotFileName(analysis: SwotAnalysis): string {
  const base = `${analysis.title}-${analysis.period ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `swot-${base || 'analise'}.csv`;
}
