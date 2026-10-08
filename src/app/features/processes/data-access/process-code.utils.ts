import type { Process } from '@core/models/database';

const CODE_WITH_TAG = /^([A-Za-z]{3})-\d+$/;
const BARE_TAG = /^[A-Za-z]{3}$/;

export const PROCESS_TAG_INPUT_PATTERN = /^(?:\s*|(?:\s*[A-Za-z]){3}\s*)$/;

export function processTag(code: string | null): string {
  if (!code) return '';
  const tag = CODE_WITH_TAG.exec(code)?.[1] ?? (BARE_TAG.test(code) ? code : '');
  return tag.toUpperCase();
}

export function processTagSuggestions(processes: Pick<Process, 'code'>[]): string[] {
  return [...new Set(processes.map((process) => processTag(process.code)).filter(Boolean))].sort();
}

export function normalizeProcessTag(tag: string): string | null {
  return tag.replace(/\s+/g, '').toUpperCase() || null;
}
