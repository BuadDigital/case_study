"use client";

import { cn } from "@platform/ui-kit";
import { ltrValueClass } from "../po-intake/PropertyDetailFields";

/** Temporary transaction numbers carry the TMP prefix (decision 2026-10-20). */
export const TEMPORARY_TRANSACTION_PREFIX = "TMP-";

export function isTemporaryTransactionNumber(value: string | null | undefined): boolean {
  return (value ?? "").trim().startsWith(TEMPORARY_TRANSACTION_PREFIX);
}

/**
 * The transaction number (المعاملة) beside a deed: PR-… once the official reference exists,
 * else the TMP- temporary number — the prefix itself says so, no badge. Renders nothing when
 * there is no number at all.
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
      <bdi dir="ltr" className={cn(ltrValueClass, "tabular-nums")}>
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

export { transactionNumberOf } from "../../lib/app-data/transaction-number";
