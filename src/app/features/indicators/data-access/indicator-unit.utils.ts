import type { IndicatorUnitType } from '@core/models/database';

export function indicatorUnitSymbol(unit: IndicatorUnitType): string {
  switch (unit) {
    case 'numero_absoluto':
      return 'un';
    case 'percentual':
      return '%';
    case 'moeda_reais':
      return 'R$';
    case 'taxa_indice':
      return 'índice';
    case 'tempo_minutos':
      return 'min';
    case 'tempo_horas':
      return 'h';
    case 'tempo_dias':
      return 'dias';
    case 'moeda_outras':
      return 'moeda';
    case 'escala_score':
      return 'pts';
    case 'peso_massa':
      return 'kg';
    case 'volume_capacidade':
      return 'L';
    case 'comprimento_area':
    case 'binario_booleano':
    case 'outro':
      return '';
  }
  return String(unit).replaceAll('_', ' ');
}

export function formatIndicatorValue(
  value: number,
  unit: IndicatorUnitType,
  decimalPlaces?: number,
): string {
  const formatted =
    decimalPlaces === undefined
      ? value % 1 === 0
        ? value.toFixed(0)
        : value.toFixed(1)
      : value.toFixed(decimalPlaces);
  switch (unit) {
    case 'percentual':
      return `${formatted}%`;
    case 'moeda_reais':
      return `R$ ${formatted}`;
    case 'numero_absoluto':
      return `${formatted} un`;
    case 'taxa_indice':
      return `${formatted} índice`;
    case 'tempo_minutos':
      return `${formatted} min`;
    case 'tempo_horas':
      return `${formatted} h`;
    case 'tempo_dias':
      return `${formatted} dias`;
    case 'moeda_outras':
      return `${formatted} moeda`;
    case 'escala_score':
      return `${formatted} pts`;
    case 'peso_massa':
      return `${formatted} kg`;
    case 'volume_capacidade':
      return `${formatted} L`;
    case 'comprimento_area':
    case 'outro':
      return formatted;
    case 'binario_booleano':
      return value === 0 ? 'Não' : 'Sim';
  }
  return `${formatted} ${String(unit).replaceAll('_', ' ')}`;
}
