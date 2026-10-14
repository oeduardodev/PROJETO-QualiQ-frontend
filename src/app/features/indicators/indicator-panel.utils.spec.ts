import { achievement, isOnTarget, periodDate, sortedHistory } from './indicator-panel.utils';
import type { IndicatorHistoryEntry } from '@core/models/database';

describe('indicator observations', () => {
  it('sorts retroactive measurements by their period', () => {
    const entry = (id: string, period: string, created_at: string): IndicatorHistoryEntry => ({
      id,
      indicator_id: 'i',
      period,
      period_date: period,
      value: 1,
      goal: 2,
      created_at,
      created_by: null,
      late_justification: null,
    });
    expect(
      sortedHistory([
        entry('later', '2026-10-01', '2026-01-01'),
        entry('earlier', '2026-01-01', '2026-10-01'),
      ]).map((item) => item.id),
    ).toEqual(['earlier', 'later']);
  });

  it('keeps an undated legacy period out of year and month filters', () => {
    expect(periodDate({ period: 'Abr', period_date: null } as IndicatorHistoryEntry)).toBeNull();
  });

  it('handles goals where less is better and zero is the target', () => {
    expect(isOnTarget(3, 2, 'lower')).toBe(false);
    expect(isOnTarget(1, 2, 'lower')).toBe(true);
    expect(achievement(4, 2, 'lower')).toBe(50);
    expect(achievement(0, 0, 'lower')).toBe(100);
    expect(achievement(1, 2, 'lower')).toBe(200);
  });
});
