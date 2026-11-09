/**
 * Shared 24×24 stroke paths for icons drawn in more than one place — feed them to `OpsIcon` (`path=`) or to
 * a hand-drawn `<path d=… />`, instead of re-typing the path string in each app (Omar 2026-11-09).
 *
 * How it works: plain strings, no React, so data files (the nav catalogue) can use them too.
 * Edge cases: a path used once stays where it is used; add one here only when a second place needs it.
 */
export const ICON_PATHS = {
  /** «+» — add / new. */
  plus: "M12 5v14M5 12h14",
  /** Four squares — the comparable bank (its nav item and its page header). */
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
} as const;
