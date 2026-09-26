import type { HelpdeskStatus } from '@core/models/database';

export const COLUMNS: {
  value: HelpdeskStatus;
  label: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    value: 'aberto',
    label: 'Aberto',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    value: 'em_andamento',
    label: 'Em Andamento',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  {
    value: 'resolvido',
    label: 'Resolvido',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  {
    value: 'fechado',
    label: 'Fechado',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
  },
];
