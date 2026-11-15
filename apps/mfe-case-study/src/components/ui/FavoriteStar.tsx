/**
 * The gold star of a favoured row: an outline while off, filled while on.
 * Drawn by the property hero's «المفضلة» button and by the pin at the start of an «أعمالي» row.
 */
export function FavoriteStar({ on, size = 19 }: { on: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={on ? "var(--gold)" : "none"}
      stroke="var(--gold)"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.8l6.5-.9z" />
    </svg>
  );
}
