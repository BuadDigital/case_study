"use client";

import { cn, OpsIcon } from "@platform/ui-kit";

/**
 * A square icon button of the property header — the deed and the two output reports. Its label is
 * its tooltip and its accessible name; a disabled button is greyed out and says why in that label.
 */
export function HeroIconButton({
  iconPath,
  label,
  ready,
  compact,
  onClick,
  testId,
}: {
  /** An OpsIcon path (24×24, stroked). */
  iconPath: string;
  label: string;
  ready: boolean;
  /** The collapsed (sticky) header: a smaller button. */
  compact: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={!ready}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "grid shrink-0 place-items-center rounded-md border border-border bg-surface p-0 text-heading transition-colors",
        compact ? "size-6" : "size-[30px]",
        ready ? "cursor-pointer hover:bg-row-hover" : "cursor-not-allowed text-text-3 opacity-60",
      )}
    >
      <OpsIcon path={iconPath} size={compact ? 13 : 16} />
    </button>
  );
}
