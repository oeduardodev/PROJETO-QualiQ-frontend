import type { DocumentStatus } from '@core/models/database';

export const DOCUMENTS_LOCKED = false;

export const DOCUMENTS_LOCKED_MESSAGE =
  'A gestão de documentos está temporariamente bloqueada. O recurso será liberado em breve.';

export const WORKFLOW: {
  value: DocumentStatus;
  label: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    value: 'rascunho',
    label: 'Rascunho',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
  },
  {
    value: 'em_revisao',
    label: 'Em Revisão',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    value: 'aprovado',
    label: 'Aprovado',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  {
    value: 'publicado',
    label: 'Publicado',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  {
    value: 'obsoleto',
    label: 'Obsoleto',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
];
