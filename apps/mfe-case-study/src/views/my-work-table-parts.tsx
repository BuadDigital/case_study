"use client";

/**
 * Cells shared by the «أعمالي» table and the «جميع العقارات» table, which copies its look (Omar
 * 2026-11-15). Moved here from `MyWorkView` when the second table came.
 */
import { cn } from "@platform/ui-kit";
import { formatDateAr } from "@platform/app-shared/format/date";
import type { MyWorkDue } from "../lib/app-data/my-work-model";

/** A value kept whole while it fits its fixed column, broken onto a second line when it is longer. */
export const MY_WORK_LONG_VALUE = "max-w-full [overflow-wrap:anywhere]";

/** The deadline's colour, as «أوامر العمل» colours an urgent one: late red, close amber, else heading. */
const DUE_TEXT_CLASS: Record<MyWorkDue, string> = {
  late: "text-red",
  soon: "text-amber-text",
  ok: "text-heading",
  none: "text-heading",
};

/** An empty cell's «—», muted like every empty cell of the system's tables. */
export function Muted() {
  return <span className="text-[13px] text-text-3">—</span>;
}

/**
 * «تاريخ الاستلام / الاستحقاق»: the PO's receipt date over its deadline, the deadline coloured by how
 * close it is (late red, today/tomorrow gold) with the short state («متأخرة», «تنتهي غدًا») beside it.
 */
export function MyWorkDates({
  item,
}: {
  item: { receivedIso?: string; dueIso?: string; due: MyWorkDue; dueText: string };
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-[13px] tabular-nums">
      {/* bdi: «DD/MM/YYYY» must not be reordered by the RTL row (as `TdLtr` in «أوامر العمل»). */}
      <span className="whitespace-nowrap text-text-2">
        <bdi dir="ltr">{item.receivedIso ? formatDateAr(item.receivedIso) : "—"}</bdi>
      </span>
      {/* The date and its state each stay whole; in a narrow column the state drops under the date. */}
      <span className={cn("text-center font-semibold", DUE_TEXT_CLASS[item.due])}>
        <bdi dir="ltr" className="whitespace-nowrap">
          {item.dueIso ? formatDateAr(item.dueIso) : "—"}
        </bdi>
        {item.due === "late" || item.due === "soon" ? (
          <>
            {" "}
            <span className="ms-1 whitespace-nowrap text-[12px] font-medium">{item.dueText}</span>
          </>
        ) : null}
      </span>
    </div>
  );
}
