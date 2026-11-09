"use client";

import { cn } from "../lib/cn";

/** The fixed suffix of a linked property's number: PR-26-00123-L (ruling 2026-11-08). */
export const LINKED_PROPERTY_SUFFIX = "-L";

/**
 * Whether a number is a linked property's number («رقم العقار المرتبط»).
 *
 * How it works: trims the value and checks the `-L` suffix. Edge cases: blank / null is not linked;
 * a deed's own number (PR-26-00123) never ends with the suffix.
 */
export function isLinkedPropertyNumber(value: string | null | undefined): boolean {
  return (value ?? "").trim().endsWith(LINKED_PROPERTY_SUFFIX);
}

/**
 * The number beside a deed: «رقم المعاملة» (the deed's own PR-…), or «رقم العقار المرتبط» (PR-…-L)
 * where a screen shows the linked property. Renders nothing when there is no number yet (the slot is
 * still waiting for its initial data).
 *
 * How it works: trims `number`, prints it left-to-right with tabular digits, and adds «N صكوك» when
 * `deedCount` is more than one. The tooltip names which number it is from the `-L` suffix.
 *
 * Edge cases: every deed is numbered at the first full save of its initial data and the number never
 * changes, so there is no temporary state to flag (the TMP number was retired 2026-11-08); a missing
 * `deedCount` counts as one.
 */
export function TransactionNumberBadge({
  number,
  deedCount,
  className,
}: {
  /** PR-… (a deed) or PR-…-L (a linked property); empty / null hides the badge. */
  number: string | null | undefined;
  /** Deeds in the property; more than one adds «N صكوك». */
  deedCount?: number | null;
  className?: string;
}) {
  const value = (number ?? "").trim();
  if (!value) return null;
  const multi = (deedCount ?? 1) > 1;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 text-[10.5px] font-semibold text-text-3 no-underline",
        className,
      )}
      title={isLinkedPropertyNumber(value) ? "رقم العقار المرتبط" : "رقم المعاملة"}
    >
      <bdi dir="ltr" className="inline [direction:ltr] [unicode-bidi:isolate] tabular-nums">
        {value}
      </bdi>
      {multi ? (
        <span className="rounded px-1 py-px text-[9px] font-bold bg-info-bg text-primary">
          {deedCount} صكوك
        </span>
      ) : null}
    </span>
  );
}
