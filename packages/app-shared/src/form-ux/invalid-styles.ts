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

/**
 * The same brief pulse in gold — for a place the user is led to that is not an error yet (the
 * appraiser's hand-over readiness list, Omar 2026-11-11: guidance instead of red). Pass it as
 * `scrollToFormField`'s `pulseClass`.
 */
export const guidePulseRingClass =
  "outline outline-2 outline-offset-2 outline-[var(--gold)] ring-2 ring-[color-mix(in_srgb,var(--gold)_35%,transparent)]";
