import type { TicketStatus, TicketSeverity } from '@core/models/database';

export const TICKET_COLUMNS: {
  value: TicketStatus;
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
    value: 'analise',
    label: 'Em Análise',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  {
    value: 'plano',
    label: 'Plano de Ação',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
  },
  {
    value: 'concluido',
    label: 'Concluído',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
];

export const SEVERITIES: TicketSeverity[] = ['baixa', 'media', 'alta', 'critica'];
