"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { cn } from "@platform/ui-kit";
import type { TransactionDeedDto } from "@platform/api-client";
import { poPropertyPath } from "@platform/app-shared/domain/po-routes";
import { formatPoDisplay } from "../../lib/app-data/po-intake-data";

/**
 * A deed's label wherever the transaction's deeds are listed (switcher, merge dialog, linked tab,
 * case-study deed picker).
 *
 * How it works: a deed identified by its real-estate registry (`identifierType ===
 * "real_estate_reg"`) with a registry number shows that number; otherwise the deed number.
 *
 * Edge cases: a blank deed number falls back to the registry number, then to «—», so a
 * half-entered deed never renders an empty label.
 */
export function transactionDeedLabel(deed: Pick<TransactionDeedDto, "deedNumber" | "realEstateRegNumber" | "identifierType">): string {
  const registry = deed.realEstateRegNumber?.trim();
  if (deed.identifierType === "real_estate_reg" && registry) return registry;
  return deed.deedNumber.trim() || registry || "—";
}

/**
 * The «صكوك المعاملة» select in the property page header.
 *
 * How it works (decision 2026-10-19): a transaction with several deeds shows one page per deed
 * under one header; this switcher jumps between them. Each option is the deed's label and its
 * PO; choosing one pushes `poPropertyPath(deed.poNumber, deed.propertyId)` — each deed keeps
 * its own work order, so the link carries that deed's PO.
 *
 * Edge cases: removed deeds are left out except the one being viewed (marked «(محذوف)»), so
 * the select still shows the current value; fewer than two listed deeds renders nothing;
 * picking the current deed does not navigate.
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
  // A removed deed is listed only on its own page, so the select can still show the current value.
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
