/**
 * Shared invalid-field styles (design tokens).
 * Use on inputs/selects when `errors[key]` is set.
 */

/** Persistent invalid look while the field error is shown. */
export const invalidControlClass =
  "border-danger bg-danger-bg/40 text-danger-text ring-2 ring-[color-mix(in_srgb,var(--danger)_28%,transparent)]";

/**
 * Brief pulse classes applied by `scrollToFormField` (stripped after timeout).
 * Prefer letting the helper manage these rather than wiring them in JSX.
 */
export const invalidPulseRingClass =
  "outline outline-2 outline-offset-2 outline-[var(--danger)] ring-2 ring-[color-mix(in_srgb,var(--danger)_35%,transparent)]";
