import type { SwotAnalysis, SwotItem } from '@core/models/database';
import {
  swotCsv,
  swotFileName,
  swotItemsByQuadrant,
  swotItemsByStrategy,
  swotStrategies,
} from './swot.utils';

describe('swot.utils', () => {
  const analysis: SwotAnalysis = {
    id: 'swot-1',
    title: 'Planejamento 2026',
    period: '1º Semestre',
    description: 'Oficina da diretoria',
    status: 'em_construcao',
    order_index: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const sampleItems: SwotItem[] = [
    {
      id: 'item-1',
      analysis_id: 'swot-1',
      quadrant: 'forcas',
      title: 'Equipe qualificada',
      description: 'Certificações ativas',
      order_index: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'item-2',
      analysis_id: 'swot-1',
      quadrant: 'oportunidades',
      title: 'Expansão de mercado',
      description: null,
      order_index: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'item-3',
      analysis_id: 'swot-1',
      quadrant: 'fraquezas',
      title: 'Sistemas legados',
      description: 'Processamento manual',
      order_index: 2,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'item-4',
      analysis_id: 'swot-1',
      quadrant: 'ameacas',
      title: 'Novos concorrentes',
      description: 'Guerra de preços',
      order_index: 3,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  it('correctly maps quadrants to FOFA strategies', () => {
    expect(swotStrategies('forcas')).toEqual(['FO', 'FA']);
    expect(swotStrategies('fraquezas')).toEqual(['OA', 'AF']);
    expect(swotStrategies('oportunidades')).toEqual(['FO', 'OA']);
    expect(swotStrategies('ameacas')).toEqual(['FA', 'AF']);
  });

  it('filters items by quadrant', () => {
    expect(swotItemsByQuadrant(sampleItems, 'forcas')).toHaveLength(1);
    expect(swotItemsByQuadrant(sampleItems, 'forcas')[0]?.id).toBe('item-1');
  });

  it('filters items participating in FOFA strategies', () => {
    // FO includes 'forcas' and 'oportunidades'
    const foItems = swotItemsByStrategy(sampleItems, 'FO');
    expect(foItems.map((item) => item.id)).toEqual(['item-1', 'item-2']);

    // FA includes 'forcas' and 'ameacas'
    const faItems = swotItemsByStrategy(sampleItems, 'FA');
    expect(faItems.map((item) => item.id)).toEqual(['item-1', 'item-4']);
  });

  it('generates valid CSV export', () => {
    const csv = swotCsv(analysis, sampleItems);
    expect(csv).toContain('Planejamento 2026');
    expect(csv).toContain('Equipe qualificada');
    expect(csv).toContain('FO / FA');
  });

  it('generates clean filename for export', () => {
    expect(swotFileName(analysis)).toBe('swot-planejamento-2026-1-semestre.csv');
  });
});
