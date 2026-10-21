"use client";

import { cn } from "@platform/ui-kit";

/*
 * Invoice rows: label | value | note on desktop. Phones re-flow each <tr> into
 * a two-column grid — label and value on one line, the note under them — so
 * the nowrap label + 150px value + note never push the card sideways.
 */
export const invoiceTrClass =
  "border-b border-dashed border-border max-lg:grid max-lg:grid-cols-[minmax(0,1fr)_auto] max-lg:items-baseline max-lg:gap-x-3 max-lg:py-2";
export const invoiceLabelTdClass = "w-px text-start max-lg:w-auto max-lg:p-0 lg:whitespace-nowrap";
export const invoiceValueTdClass = "w-[150px] pe-0 ps-[18px] text-start max-lg:w-auto max-lg:p-0";
export const invoiceNoteTdClass = "text-start text-[10.5px] text-text-3 max-lg:col-span-2 max-lg:p-0";
/** Small inline number inputs (discount %, rounding) — 44px tall on phones. */
export const invoiceInputClass =
  "ms-2 w-[58px] rounded-md border border-border-md bg-surface p-[5px] text-center text-xs font-bold text-heading max-lg:min-h-11 max-lg:w-20 max-lg:text-[16px]";

/** Invoice line from the interactive-form spec — label | value | note. */
export function OpinionInvoiceRow({
  label,
  note,
  value,
  strong,
  valueClassName,
}: {
  label: string;
  note?: string;
  value: string;
  strong?: boolean;
  valueClassName?: string;
}) {
  return (
    <tr className={invoiceTrClass}>
      <td
        className={cn(
          invoiceLabelTdClass,
          "py-2 text-[12.5px] text-heading",
          strong ? "font-extrabold" : "font-medium",
        )}
      >
        {label}
      </td>
      <td
        dir="ltr"
        className={cn(
          invoiceValueTdClass,
          "py-2 font-bold text-heading",
          strong ? "text-[14px] font-extrabold" : "text-[13.5px]",
          valueClassName,
        )}
      >
        {value}
      </td>
      <td className={cn(invoiceNoteTdClass, "py-2")}>{note}</td>
    </tr>
  );
}
