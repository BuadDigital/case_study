"use client";

import { cn, OpsIcon } from "@platform/ui-kit";

/**
 * Where an output stands, as its header icon shows it (Omar 2026-11-18):
 * - `none`: nothing to open yet — greyed out and disabled;
 * - `draft`: opens the newest version, shaded with a dashed border («مسودة — لم تُعتمد»);
 * - `approved`: full colour.
 */
export type HeroIconState = "none" | "draft" | "approved";

/**
 * A square icon button of the property header — the deed and the two output reports. Its label is
 * its tooltip and its accessible name; a disabled button is greyed out and says why in that label.
 * `badge` (a report's version) shows as a small neutral number in the corner when above 1.
 */
export function HeroIconButton({
  iconPath,
  label,
  ready,
  state,
  badge,
  compact,
  onClick,
  testId,
}: {
  /** An OpsIcon path (24×24, stroked). */
  iconPath: string;
  label: string;
  /** The deed's button: ready or not (the reports pass `state`). */
  ready?: boolean;
  state?: HeroIconState;
  /** The version shown in the corner; 1 or none shows nothing. */
  badge?: number;
  /** The collapsed (sticky) header: a smaller button. */
  compact: boolean;
  onClick: () => void;
  testId?: string;
}) {
  const shown: HeroIconState = state ?? (ready ? "approved" : "none");
  const enabled = shown !== "none";
  return (
    <button
      type="button"
      title={label}
      aria-label={badge && badge > 1 ? `${label} — النسخة ${badge}` : label}
      disabled={!enabled}
      data-testid={testId}
      data-state={shown}
      onClick={onClick}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-md border bg-surface p-0 transition-colors",
        compact ? "size-6" : "size-[30px]",
        shown === "approved" && "cursor-pointer border-border text-heading hover:bg-row-hover",
        shown === "draft" && "cursor-pointer border-dashed border-border-md text-text-3 hover:bg-row-hover",
        shown === "none" && "cursor-not-allowed border-border text-text-3 opacity-60",
      )}
    >
      <OpsIcon path={iconPath} size={compact ? 13 : 16} />
      {badge && badge > 1 ? (
        <span
          aria-hidden
          className="absolute -end-1.5 -top-1.5 grid h-[15px] min-w-[15px] place-items-center rounded-full border border-border bg-surface-2 px-[3px] text-[9.5px] font-bold leading-none tabular-nums text-text-2"
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
