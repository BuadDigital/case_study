"use client";

import Link from "next/link";
import { useMemo } from "react";
import { cn } from "@platform/design-system";
import { useOperationsTasksQuery } from "../../query/operations-tasks-queries";
import {
  operationsTaskStatusLabel,
  operationsTaskTypeLabel,
} from "../../lib/prototype/operations-task-display";
import { isActiveOperationsTask } from "../../lib/prototype/operations-tasks-storage";
import {
  formatPropertyDeedDisplay,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import type { InspectorFeeRowDto } from "@platform/api-client";
import { operationsTaskPath } from "../../lib/my-task-routes";

type GlanceTabId = "keys" | "finance" | "failures" | "linked";

export function PropertyDetailMobileGlance({
  poNumber,
  property,
  keysStatus,
  keysHasData,
  feeRows,
  failureCount,
  onOpenTab,
  allowedTabs,
}: {
  poNumber: string;
  property: PoPropertyIntake;
  keysStatus: string;
  keysHasData: boolean;
  feeRows: InspectorFeeRowDto[];
  failureCount: number;
  onOpenTab: (tab: GlanceTabId) => void;
  /** When set, only show glance chips for these tab ids. */
  allowedTabs?: readonly string[];
}) {
  const canOpen = (tab: GlanceTabId) =>
    !allowedTabs || allowedTabs.includes(tab);
  const { data: opsTasks = [] } = useOperationsTasksQuery({ live: true });
  const deedNumber = property.deedNumber.trim();
  const deedDisplay = formatPropertyDeedDisplay(property) || deedNumber;

  const propertyOpsTasks = useMemo(() => {
    return opsTasks.filter((t) => {
      if (t.poNumber?.trim() === poNumber) {
        if (t.scope === "work_order" || t.scope === "multi") return true;
        if (t.scope === "transaction") {
          return t.deeds.some(
            (d) =>
              d === deedDisplay || d === deedNumber || d.includes(deedNumber),
          );
        }
      }
      return t.deeds.some(
        (d) =>
          d === deedDisplay ||
          d === deedNumber ||
          (deedNumber && d.includes(deedNumber)),
      );
    });
  }, [opsTasks, poNumber, deedDisplay, deedNumber]);

  const activeOps = propertyOpsTasks.filter(isActiveOperationsTask);
  const primaryOps = activeOps[0] ?? propertyOpsTasks[0] ?? null;

  const pendingFees = feeRows.filter(
    (r) =>
      r.billingStatus === "draft" ||
      r.billingStatus === "returned" ||
      r.billingStatus === "inquiry" ||
      r.billingStatus === "sup-review" ||
      r.billingStatus === "office-review",
  ).length;

  const feeLabel =
    feeRows.length === 0
      ? "لا أتعاب"
      : pendingFees > 0
        ? `${pendingFees} بانتظار`
        : `${feeRows.length} سجل`;

  const keysLabel = keysHasData
    ? keysStatus.trim() || "مفاتيح"
    : "مفاتيح —";

  return (
    <div
      className="lg:hidden shrink-0 border-b border-border/60 bg-surface-2/80 px-4 py-3"
      aria-label="ملخص سريع للمراجع"
    >
      <div
        className={cn(
          "grid gap-2",
          canOpen("finance") || canOpen("failures")
            ? "grid-cols-3"
            : "grid-cols-1",
        )}
      >
        {canOpen("keys") ? (
          <GlanceChip
            label="المفاتيح"
            value={keysLabel}
            tone={keysHasData ? "teal" : "gray"}
            onClick={() => onOpenTab("keys")}
          />
        ) : null}
        {canOpen("finance") ? (
          <GlanceChip
            label="الأتعاب"
            value={feeLabel}
            tone={pendingFees > 0 ? "amber" : feeRows.length > 0 ? "teal" : "gray"}
            onClick={() => onOpenTab("finance")}
          />
        ) : null}
        {canOpen("failures") ? (
          <GlanceChip
            label="التعذرات"
            value={
              failureCount > 0
                ? `${failureCount} مسجّل`
                : "لا تعذرات"
            }
            tone={failureCount > 0 ? "amber" : "gray"}
            onClick={() => onOpenTab("failures")}
          />
        ) : null}
      </div>

      {canOpen("linked") || primaryOps ? (
      <div className="mt-2.5">
        {primaryOps ? (
          <Link
            href={operationsTaskPath(primaryOps.id)}
            className="flex min-h-11 items-center justify-between gap-2 rounded-[10px] border border-border bg-surface px-3 py-2.5 no-underline transition-colors active:bg-row-hover"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-text-3">
                مهمة تشغيلية
                {propertyOpsTasks.length > 1
                  ? ` · ${propertyOpsTasks.length}`
                  : ""}
              </div>
              <div className="truncate text-[13px] font-semibold text-heading">
                {primaryOps.title}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-text-3">
                {operationsTaskTypeLabel(primaryOps.type)} ·{" "}
                {operationsTaskStatusLabel(primaryOps.status)}
              </div>
            </div>
            <span className="shrink-0 text-[12px] font-semibold text-primary">
              فتح
            </span>
          </Link>
        ) : canOpen("linked") ? (
          <button
            type="button"
            onClick={() => onOpenTab("linked")}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[10px] border border-dashed border-border-md bg-surface px-3 py-2.5 text-start font-[inherit] transition-colors active:bg-row-hover"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-text-3">
                مهمة تشغيلية
              </div>
              <div className="text-[13px] font-medium text-text-2">
                لا مهام مرتبطة — عرض الارتباطات
              </div>
            </div>
            <span className="shrink-0 text-[12px] font-semibold text-primary">
              عرض
            </span>
          </button>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}

function GlanceChip({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  tone: "teal" | "amber" | "gray";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[4.25rem] flex-col items-stretch justify-center rounded-[10px] border border-border bg-surface px-2.5 py-2 text-start font-[inherit] transition-colors active:bg-row-hover",
        tone === "teal" && "border-success/35",
        tone === "amber" && "border-warning/40",
      )}
    >
      <span className="text-[10px] font-medium text-text-3">{label}</span>
      <span
        className={cn(
          "mt-1 line-clamp-2 text-[12px] font-semibold leading-snug text-heading",
          tone === "teal" && "text-success-text",
          tone === "amber" && "text-warning",
        )}
      >
        {value}
      </span>
    </button>
  );
}
