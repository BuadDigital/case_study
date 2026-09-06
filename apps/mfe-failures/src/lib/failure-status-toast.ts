/**
 * The user-facing toast for a rejected or failed failure-status action.
 *
 * The screen's own copy («تعذّر اعتماد التعذر — حاول مرة أخرى») always leads:
 * it names the action the user just tried. The transport detail
 * (`apiErrorMessage`, a thrown `Error`) is appended in parentheses when it
 * adds something — never shown on its own, so the handled `{ ok: false }`
 * path and the thrown path read the same.
 */
export function failureStatusErrorToast(
  errorToast: string,
  detail?: unknown,
): string {
  const base = errorToast.trim();
  const text =
    typeof detail === "string"
      ? detail
      : detail instanceof Error
        ? detail.message
        : "";
  const extra = text.trim();
  if (!extra || extra === base || base.includes(extra)) return base;
  return `${base} (${extra})`;
}
