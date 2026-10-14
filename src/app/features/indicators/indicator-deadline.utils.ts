import type { IndicatorFrequency } from '@core/models/database';

export function indicatorDueDate(period: string, frequency: IndicatorFrequency): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period) || frequency === 'por_evento') return null;
  const date = new Date(`${period}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== period) return null;
  const days: Partial<Record<IndicatorFrequency, number>> = {
    diario: 1,
    semanal: 7,
    quinzenal: 15,
  };
  if (days[frequency]) date.setUTCDate(date.getUTCDate() + days[frequency]);
  else {
    const months: Partial<Record<IndicatorFrequency, number>> = {
      mensal: 1,
      bimestral: 2,
      trimestral: 3,
      semestral: 6,
      anual: 12,
    };
    const count = months[frequency];
    if (!count) return null;
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + count);
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  return date.toISOString().slice(0, 10);
}

export function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function submissionDueDate(
  period: string,
  frequency: IndicatorFrequency,
  previousPeriod: string,
): string | null {
  const selectedDue = indicatorDueDate(period, frequency);
  const previousDue = indicatorDueDate(previousPeriod, frequency);
  return [selectedDue, previousDue].filter((due): due is string => due !== null).sort()[0] ?? null;
}
