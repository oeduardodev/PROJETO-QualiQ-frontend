/** Matches form serialization: only an empty string becomes null; whitespace is preserved. */
export function emptyToNull(value: string): string | null {
  return value || null;
}
