"use client";

import { cn } from "@platform/ui-kit";

/**
 * Operational return-for-correction alert.
 * Uses warning (amber) tokens — gold is reserved for brand / active stepper,
 * so a gold wash here looked like chrome, not a specialist return.
 */
export function ReturnedForCorrectionNote({
  note,
  className,
}: {
  note?: string | null;
  className?: string;
}) {
  const reason = note?.trim();
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-[10px] border border-[color-mix(in_srgb,var(--amber)_35%,var(--border))] border-s-[3px] border-s-amber bg-amber-light px-3.5 py-3",
        className,
      )}
    >
      <span
        className="mt-px grid size-8 shrink-0 place-items-center rounded-[8px] bg-surface text-amber-text shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--amber)_28%,transparent)]"
        aria-hidden
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 9-9" />
          <path d="M3 3v6h6" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[13px] font-bold leading-snug text-heading">
          معادة للتصحيح
        </p>
        {reason ? (
          <div className="mt-2 rounded-[8px] border border-[color-mix(in_srgb,var(--amber)_22%,var(--border))] bg-surface px-3 py-2">
            <p className="m-0 text-[10.5px] font-bold tracking-wide text-amber-text">
              سبب الإعادة
            </p>
            <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-heading">
              {reason}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
