import type { Indicator, IndicatorHistoryEntry } from '@core/models/database';

export function periodDate(entry: IndicatorHistoryEntry): string | null {
  if (entry.period_date) return entry.period_date;
  return /^\d{4}-\d{2}-\d{2}$/.test(entry.period) ? entry.period : null;
}

export function sortedHistory(entries: IndicatorHistoryEntry[]): IndicatorHistoryEntry[] {
  return [...entries].sort(
    (a, b) =>
      (periodDate(a) ?? '').localeCompare(periodDate(b) ?? '') ||
      a.created_at.localeCompare(b.created_at) ||
      a.id.localeCompare(b.id),
  );
}

export function isOnTarget(
  value: number,
  goal: number,
  direction: Indicator['goal_direction'],
): boolean {
  return direction === 'lower' ? value <= goal : value >= goal;
}

export function achievement(
  value: number,
  goal: number,
  direction: Indicator['goal_direction'],
): number {
  if (direction === 'lower') {
    if (goal === 0) return value <= 0 ? 100 : 0;
    if (value === 0) return goal > 0 ? 200 : 0;
    return Math.max(0, (goal / value) * 100);
  }
  if (goal === 0) return value >= 0 ? 100 : 0;
  return Math.max(0, (value / goal) * 100);
}

export function displayPeriod(period: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) return period;
  const [year, month, day] = period.split('-');
  return `${day}/${month}/${year}`;
}
