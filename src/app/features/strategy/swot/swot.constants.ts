import type { SwotQuadrant, SwotStatus, SwotStrategy } from '@core/models/database';

export interface QuadrantMeta {
  key: SwotQuadrant;
  label: string;
  scope: string;
  icon: string;
  panel: string;
  title: string;
  accent: string;
  badge: string;
  placeholder: string;
}

export interface StrategyMeta {
  key: SwotStrategy;
  label: string;
  question: string;
  sources: readonly SwotQuadrant[];
  panel: string;
  accent: string;
}

/**
 * Classic 2x2 layout: internal factors on the left, external factors on the right,
 * helpful on top and harmful below.
 */
export const QUADRANTS: readonly QuadrantMeta[] = [
  {
    key: 'forcas',
    label: 'Forças',
    scope: 'Interno · Positivo',
    icon: 'ShieldCheck',
    panel: 'border-emerald-200 bg-emerald-50/50',
    title: 'bg-emerald-500/10 text-emerald-800',
    accent: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700',
    placeholder: 'Ex: equipe certificada em ISO 9001 e prazo de entrega reduzido.',
  },
  {
    key: 'fraquezas',
    label: 'Fraquezas',
    scope: 'Interno · Negativo',
    icon: 'CircleAlert',
    panel: 'border-orange-200 bg-orange-50/50',
    title: 'bg-orange-500/10 text-orange-800',
    accent: 'text-orange-600',
    badge: 'bg-orange-100 text-orange-700',
    placeholder: 'Ex: registro de não conformidades ainda lançado manualmente.',
  },
  {
    key: 'oportunidades',
    label: 'Oportunidades',
    scope: 'Externo · Positivo',
    icon: 'TrendingUp',
    panel: 'border-blue-200 bg-blue-50/50',
    title: 'bg-blue-500/10 text-blue-800',
    accent: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700',
    placeholder: 'Ex: novo programa de financiamento para indústria 4.0.',
  },
  {
    key: 'ameacas',
    label: 'Ameaças',
    scope: 'Externo · Negativo',
    icon: 'TriangleAlert',
    panel: 'border-rose-200 bg-rose-50/50',
    title: 'bg-rose-500/10 text-rose-800',
    accent: 'text-rose-600',
    badge: 'bg-rose-100 text-rose-700',
    placeholder: 'Ex: concorrente com preço reduzido e nova certificação no mercado.',
  },
];

/** FOFA crossing: every quadrant feeds the two strategies it takes part in. */
export const STRATEGIES: readonly StrategyMeta[] = [
  {
    key: 'FO',
    label: 'Forças x Oportunidades',
    question: 'Usar as forças para aproveitar as oportunidades',
    sources: ['forcas', 'oportunidades'],
    panel: 'border-emerald-200',
    accent: 'text-emerald-600',
  },
  {
    key: 'FA',
    label: 'Forças x Ameaças',
    question: 'Usar as forças para enfrentar as ameaças',
    sources: ['forcas', 'ameacas'],
    panel: 'border-teal-200',
    accent: 'text-teal-600',
  },
  {
    key: 'OA',
    label: 'Oportunidades x Fraquezas',
    question: 'Usar as oportunidades para superar as fraquezas',
    sources: ['oportunidades', 'fraquezas'],
    panel: 'border-blue-200',
    accent: 'text-blue-600',
  },
  {
    key: 'AF',
    label: 'Ameaças x Fraquezas',
    question: 'Reduzir as fraquezas expostas às ameaças',
    sources: ['ameacas', 'fraquezas'],
    panel: 'border-orange-200',
    accent: 'text-orange-600',
  },
];

export const STATUSES: readonly SwotStatus[] = ['em_construcao', 'em_revisao', 'concluida'];
