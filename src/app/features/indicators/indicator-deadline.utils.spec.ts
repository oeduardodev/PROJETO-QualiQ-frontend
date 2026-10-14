import { describe, expect, it } from 'vitest';
import { indicatorDueDate, submissionDueDate } from './indicator-deadline.utils';

describe('indicatorDueDate', () => {
  it('uses the configured interval for daily, weekly and fortnightly results', () => {
    expect(indicatorDueDate('2026-10-14', 'diario')).toBe('2026-10-15');
    expect(indicatorDueDate('2026-10-14', 'semanal')).toBe('2026-10-21');
    expect(indicatorDueDate('2026-10-14', 'quinzenal')).toBe('2026-10-29');
  });

  it('clamps month-end and leap-day deadlines like PostgreSQL intervals', () => {
    expect(indicatorDueDate('2026-01-31', 'mensal')).toBe('2026-02-28');
    expect(indicatorDueDate('2024-02-29', 'anual')).toBe('2025-02-28');
  });

  it('has no fixed deadline for event-based indicators', () => {
    expect(indicatorDueDate('2026-10-14', 'por_evento')).toBeNull();
  });

  it('keeps an overdue gap visible when a new current date is selected', () => {
    expect(submissionDueDate('2026-10-14', 'mensal', '2026-08-01')).toBe('2026-09-01');
  });
});
