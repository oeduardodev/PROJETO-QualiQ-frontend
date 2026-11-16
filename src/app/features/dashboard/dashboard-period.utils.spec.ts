import { describe, expect, it } from 'vitest';
import type { IndicatorHistoryEntry } from '@core/models/database';
import { latestInMonth, shiftMonth } from './dashboard-period.utils';

function result(id: string, period: string, periodDate: string | null): IndicatorHistoryEntry {
  return {
    id,
    indicator_id: 'indicator',
    period,
    period_date: periodDate,
    value: 1,
    goal: 2,
    created_at: `${period}T12:00:00Z`,
    created_by: null,
    late_justification: null,
  };
}

describe('monthly dashboard periods', () => {
  it('crosses a year boundary when comparing with the previous month', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('chooses the latest result within a month and leaves missing months empty', () => {
    const entries = [
      result('old', '2026-10-05', '2026-10-05'),
      result('legacy', '2026-11-12', null),
      result('latest', '2026-11-20', '2026-11-20'),
    ];
    expect(latestInMonth(entries, '2026-11')?.id).toBe('latest');
    expect(latestInMonth(entries, '2026-09')).toBeNull();
  });
});
