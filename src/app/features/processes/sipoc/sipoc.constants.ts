import type { NodeType } from '@core/models/database';

export const COLUMNS: {
  type: NodeType;
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    type: 'S',
    label: 'Fornecedores',
    icon: 'Users',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    type: 'I',
    label: 'Entradas',
    icon: 'ArrowDownToLine',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
  },
  {
    type: 'P',
    label: 'Processo',
    icon: 'Cog',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
  },
  {
    type: 'O',
    label: 'Saídas',
    icon: 'ArrowUpFromLine',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  {
    type: 'C',
    label: 'Clientes',
    icon: 'UserCheck',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
];

export const LABELS: Record<NodeType, string> = {
  S: 'Fornecedor',
  I: 'Entrada',
  P: 'Processo',
  O: 'Saída',
  C: 'Cliente',
};
