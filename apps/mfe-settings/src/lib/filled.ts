/** `value` when it has non-blank text, otherwise `fallback`. */
export function filled(value: string | null | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}
