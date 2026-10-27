"use client";

import { cn } from "../lib/cn";

/** Temporary transaction numbers carry the TMP prefix. */
export const TEMPORARY_TRANSACTION_PREFIX = "TMP-";

/**
 * Whether a transaction number is still the temporary one.
 *
 * How it works: trims the value and checks the `TMP-` prefix (TMP replaced the
 * old `D` prefix, and a migration renamed the existing drafts and their counter, so no `D-`
 * number is left to recognise). Blank / null is not temporary.
 */
export function isTemporaryTransactionNumber(value: string | null | undefined): boolean {
  return (value ?? "").trim().startsWith(TEMPORARY_TRANSACTION_PREFIX);
}

/**
 * The transaction number (المعاملة) beside a deed: PR-… once the official reference exists,
 * else the TMP- temporary number — the prefix itself says so, no badge. Renders nothing when
 * there is no number at all.
 *
 * How it works: trims `number`, prints it left-to-right with
 * tabular digits, and adds «N صكوك» when `deedCount` is more than one. The tooltip says
 * «رقم مؤقت — يُثبَّت الرقم الرسمي PR عند اعتماد أول تقرير» for a TMP- number, else «رقم المعاملة».
 *
 * Edge cases: the official PR is drawn once at the first approved report and never reused, so
 * a number shown as PR here stays PR even after a reopen; a missing `deedCount` counts as one.
 */
export function TransactionNumberBadge({
  number,
  deedCount,
  className,
}: {
  /** PR-… or TMP-…; empty / null hides the badge. */
  number: string | null | undefined;
  /** Deeds in the transaction; more than one adds «N صكوك». */
  deedCount?: number | null;
  className?: string;
}) {
  const value = (number ?? "").trim();
  if (!value) return null;
  const temporary = isTemporaryTransactionNumber(value);
  const multi = (deedCount ?? 1) > 1;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 text-[10.5px] font-semibold text-text-3 no-underline",
        className,
      )}
      title={
        temporary
          ? "رقم مؤقت — يُثبَّت الرقم الرسمي PR عند اعتماد أول تقرير"
          : "رقم المعاملة"
      }
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
