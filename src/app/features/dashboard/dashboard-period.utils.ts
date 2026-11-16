import type { IndicatorHistoryEntry } from '@core/models/database';

export function shiftMonth(month: string, offset: number): string {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

export function latestInMonth(
  entries: IndicatorHistoryEntry[],
  month: string,
): IndicatorHistoryEntry | null {
  return (
    entries
      .filter((entry) => (entry.period_date ?? entry.period).startsWith(month))
      .sort(
        (a, b) =>
          (a.period_date ?? a.period).localeCompare(b.period_date ?? b.period) ||
          a.created_at.localeCompare(b.created_at),
      )
      .at(-1) ?? null
  );
}
