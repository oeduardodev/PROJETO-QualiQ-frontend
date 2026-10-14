const CODE_WITH_TAG = /^([A-Za-z]{3})-\d+$/;
const BARE_TAG = /^[A-Za-z]{3}$/;

export const PROCESS_TAG_INPUT_PATTERN = /^(?:\s*|(?:\s*[A-Za-z]){3}\s*)$/;

export function processTag(code: string | null): string {
  if (!code) return '';
  const tag = CODE_WITH_TAG.exec(code)?.[1] ?? (BARE_TAG.test(code) ? code : '');
  return tag.toUpperCase();
}

export function normalizeProcessTag(tag: string): string | null {
  return tag.replace(/\s+/g, '').toUpperCase() || null;
}

export function processCodeError(error: unknown): string | null {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
    ? 'Esta sigla já está em uso por outro processo.'
    : null;
}
