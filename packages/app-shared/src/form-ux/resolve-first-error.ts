/**
 * Resolve DOM targets and user-facing messages from a sparse error map.
 * Domain code owns validation; this only walks an ordered key list.
 */

export type FormErrorTarget = {
  /** Key present on the field-errors object when that field is invalid. */
  key: string;
  /** Element `id` to scroll/focus. */
  targetId: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** First target id whose error key is a non-empty string message. */
export function resolveFirstErrorTarget(
  errors: Record<string, unknown>,
  order: readonly FormErrorTarget[],
): string | null {
  for (const { key, targetId } of order) {
    if (isNonEmptyString(errors[key])) return targetId;
  }
  return null;
}

/**
 * First non-empty string message in `orderedKeys` order, then any remaining
 * string values on the map (skips arrays/objects used as metadata).
 */
export function resolveFirstErrorMessage(
  errors: Record<string, unknown>,
  orderedKeys: readonly string[],
): string | null {
  for (const key of orderedKeys) {
    const value = errors[key];
    if (isNonEmptyString(value)) return value.trim();
  }
  for (const value of Object.values(errors)) {
    if (isNonEmptyString(value)) return value.trim();
  }
  return null;
}

/** Non-empty string messages in `orderedKeys` order (deduped). */
export function resolveAllErrorMessages(
  errors: Record<string, unknown>,
  orderedKeys: readonly string[],
): string[] {
  const list: string[] = [];
  for (const key of orderedKeys) {
    const value = errors[key];
    if (isNonEmptyString(value) && !list.includes(value.trim())) {
      list.push(value.trim());
    }
  }
  return list;
}

/** True when any ordered key has a non-empty string error. */
export function hasOrderedFieldErrors(
  errors: Record<string, unknown>,
  orderedKeys: readonly string[],
): boolean {
  return orderedKeys.some((key) => isNonEmptyString(errors[key]));
}
