/** Preserve the existing UI fallback for SDK errors that are not Error instances. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
