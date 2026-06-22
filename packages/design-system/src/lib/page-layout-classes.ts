/** Shared layout rhythm — matches active-transaction queue pages. */
export const pageGutterClassName = "px-4";

export const pageBodyClassName =
  "min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:py-5";

export const pageShellHeaderClassName =
  "grid items-center gap-1 border-b border-border bg-gradient-to-br from-surface-2 to-surface px-4 py-2.5";

export const pageToolbarClassName =
  "flex flex-wrap items-center gap-2 border-b border-border bg-surface-2/50 px-4 py-2.5";

export const emptyStateClassName = "px-4 py-8 text-center";

/** KPI-style canvas — light gray page background, flush edge-to-edge content. */
export const operationalPageBodyClassName =
  "flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto bg-bg";

/** White content panel on the operational canvas (tables, toolbars, forms). */
export const operationalPanelClassName =
  "flex min-w-0 flex-col overflow-hidden rounded-none border-0 border-b border-border bg-surface shadow-none";

/** Stats row flush with queue tables — full width, shared dividers. */
export const statGridFlushClassName =
  "mb-0 gap-0 divide-x divide-y divide-border sm:divide-y-0";

export const statCardFlushClassName =
  "rounded-none border-0 border-b-0 border-t-[3px] shadow-none";

/** Interactive queue / PO table rows (active transactions, bourse, government review). */
export const queueTableRowClassName =
  "cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--info-bg)_40%,var(--surface))]";

export const queueTableRowActiveClassName =
  "bg-[color-mix(in_srgb,var(--warning-bg)_45%,var(--surface))]";

export const queueTableWrapClassName = "w-full min-w-0 overflow-x-auto";

export const queueTableHintClassName =
  "m-0 px-4 py-2 pb-3 text-[11px] text-text-3";

/** Sticky side panel max height below topbar (queue / bourse / government review). */
export const workspaceStickyPanelMaxHClassName =
  "max-h-[calc(100dvh-var(--topbar-h)-2.25rem)]";
