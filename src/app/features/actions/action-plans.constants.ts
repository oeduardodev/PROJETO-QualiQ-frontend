import type { ActionPlanStatus } from '@core/models/database';

export const COLUMNS: {
  value: ActionPlanStatus;
  label: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    value: 'pendente',
    label: 'Pendente',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
  },
  {
    value: 'andamento',
    label: 'Em Andamento',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    value: 'atrasado',
    label: 'Atrasado',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
  {
    value: 'concluido',
    label: 'Concluído',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
];
