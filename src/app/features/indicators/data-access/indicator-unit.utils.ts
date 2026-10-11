import type { IndicatorUnitType } from '@core/models/database';

export const INDICATOR_UNITS: { value: IndicatorUnitType; label: string }[] = [
  { value: 'numero_absoluto', label: 'Unidade (un)' },
  { value: 'percentual', label: 'Percentual (%)' },
  { value: 'monetario', label: 'Monetário (R$)' },
];

export function indicatorUnitSymbol(unit: IndicatorUnitType): string {
  switch (unit) {
    case 'numero_absoluto':
      return 'un';
    case 'percentual':
      return '%';
    case 'monetario':
      return 'R$';
  }
}

export function formatIndicatorValue(value: number, unit: IndicatorUnitType): string {
  const formatted = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  switch (unit) {
    case 'percentual':
      return `${formatted}%`;
    case 'monetario':
      return `R$ ${formatted}`;
    case 'numero_absoluto':
      return `${formatted} un`;
  }
}
