/** Unknown states restart at the first step, as in the existing workflows. */
export function nextWorkflowStatus<T extends string>(status: T, sequence: readonly [T, ...T[]]): T {
  const nextIndex = Math.min(sequence.indexOf(status) + 1, sequence.length - 1);
  return sequence[nextIndex];
}
