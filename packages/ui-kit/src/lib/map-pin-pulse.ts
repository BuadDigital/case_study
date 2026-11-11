/**
 * The pulsing ring around an emphasised map pin (Omar 2026-11-11: the subject property must stand
 * out among the comparables — a circle that blinks, with an edge of another colour). Pure.
 */

/** One full pulse, in milliseconds. */
export const MAP_PIN_PULSE_MS = 1600;
/** The dot of an emphasised pin, in the map symbol's scale units (an ordinary pin is 8). */
export const MAP_PIN_EMPHASIS_SCALE = 11;
const RING_MAX_SCALE = 26;
const RING_START_OPACITY = 0.55;

export type MapPinPulseFrame = { scale: number; opacity: number };

/**
 * The ring at a moment of its pulse: it grows out of the dot and fades as it grows.
 *
 * How it works: the elapsed time is taken modulo one pulse; the ring eases out from the dot's size
 * to its widest while its opacity falls to zero, then starts again.
 * Edge cases: a negative or non-finite time is the start of the pulse.
 */
export function mapPinPulseFrame(elapsedMs: number): MapPinPulseFrame {
  const t = Number.isFinite(elapsedMs) && elapsedMs > 0 ? (elapsedMs % MAP_PIN_PULSE_MS) / MAP_PIN_PULSE_MS : 0;
  const eased = 1 - (1 - t) * (1 - t);
  return {
    scale: MAP_PIN_EMPHASIS_SCALE + (RING_MAX_SCALE - MAP_PIN_EMPHASIS_SCALE) * eased,
    opacity: RING_START_OPACITY * (1 - t),
  };
}

/** The ring when the device asks for reduced motion: still, half-way out, faint. */
export const MAP_PIN_STILL_RING: MapPinPulseFrame = {
  scale: (MAP_PIN_EMPHASIS_SCALE + RING_MAX_SCALE) / 2,
  opacity: 0.3,
};
