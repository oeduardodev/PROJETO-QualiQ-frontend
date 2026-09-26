export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '—';
}
