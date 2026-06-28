"use client";

import { Badge, cn } from "@platform/design-system";

export function FinanceStatusSummary({
  readyToDisburse,
  waitingOffice,
  needsAttention,
  className,
}: {
  readyToDisburse: number;
  waitingOffice: number;
  needsAttention: number;
  className?: string;
}) {
  if (readyToDisburse + waitingOffice + needsAttention === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {readyToDisburse > 0 ? (
        <Badge tone="success" className="px-2.5 py-1 text-[11px]">
          جاهز للصرف الآن: {readyToDisburse}
        </Badge>
      ) : null}
      {waitingOffice > 0 ? (
        <Badge tone="info" className="px-2.5 py-1 text-[11px]">
          بانتظار أمر صرف من المكتب: {waitingOffice}
        </Badge>
      ) : null}
      {needsAttention > 0 ? (
        <Badge tone="danger" className="px-2.5 py-1 text-[11px]">
          مُعاد / استفسار: {needsAttention}
        </Badge>
      ) : null}
    </div>
  );
}

export function FinanceSectionTitle({
  title,
  count,
  hint,
}: {
  title: string;
  count: number;
  hint?: string;
}) {
  return (
    <div className="mb-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[13px] font-semibold text-text">{title}</h3>
        <Badge tone="default" className="text-[10px] font-normal">
          {count}
        </Badge>
      </div>
      {hint ? (
        <p className="mt-1 text-[11px] leading-relaxed text-text-3">{hint}</p>
      ) : null}
    </div>
  );
}
