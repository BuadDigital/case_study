"use client";

/**
 * Toolbar/section icons shared by `ComparablePropertiesView` and its intake
 * form — one inline SVG driven by a path constant.
 */

export const PLUS_ICON = "M12 5v14M5 12h14";
export const BANK_ICON = "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z";

export function OpsIcon({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}
