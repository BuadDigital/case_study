"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { cn } from "@platform/ui-kit";
import type { TransactionDeedDto } from "@platform/api-client";
import { poPropertyPath } from "@platform/app-shared/domain/po-routes";
import { formatPoDisplay } from "../../lib/app-data/po-intake-data";

/** A deed's label in the switcher: registry number when identified by one, else the deed number. */
export function transactionDeedLabel(deed: Pick<TransactionDeedDto, "deedNumber" | "realEstateRegNumber" | "identifierType">): string {
  const registry = deed.realEstateRegNumber?.trim();
  if (deed.identifierType === "real_estate_reg" && registry) return registry;
  return deed.deedNumber.trim() || registry || "—";
}

/**
 * Decision 2026-10-19: a transaction with several deeds shows one page per deed under one
 * header; this switcher jumps between them. Each deed keeps its own work order, so the link
 * carries that deed's PO.
 */
export function TransactionDeedSwitcher({
  deeds,
  currentPropertyId,
  compact = false,
}: {
  deeds: TransactionDeedDto[];
  currentPropertyId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const listed = deeds.filter((d) => !d.isRemoved || d.propertyId === currentPropertyId);
  if (listed.length < 2) return null;
  return (
    <label
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-text-2",
        compact && "py-0.5 text-[10px]",
      )}
      htmlFor={id}
    >
      <span className="font-semibold">صكوك المعاملة</span>
      <select
        id={id}
        className="max-w-[260px] cursor-pointer border-0 bg-transparent text-[11.5px] font-bold tabular-nums text-heading outline-none"
        value={currentPropertyId}
        aria-label="التنقل بين صكوك المعاملة"
        onChange={(e) => {
          const next = listed.find((d) => d.propertyId === e.target.value);
          if (!next || next.propertyId === currentPropertyId) return;
          router.push(poPropertyPath(next.poNumber, next.propertyId));
        }}
      >
        {listed.map((deed) => (
          <option key={deed.propertyId} value={deed.propertyId}>
            {transactionDeedLabel(deed)} · {formatPoDisplay(deed.poNumber)}
            {deed.isRemoved ? " (محذوف)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
