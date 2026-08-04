/** Join class names, dropping anything falsy. */
export function cx(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(' ')
}
