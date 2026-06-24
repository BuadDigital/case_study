"use client";

import { Note } from "@platform/design-system";
import type { GovernmentReviewPoRow } from "../../lib/prototype/government-review-po";
import { GovernmentReviewSectionCard } from "./GovernmentReviewSectionCard";

export function GovernmentReviewWorkOrderSummaryCard({
  row,
}: {
  row: GovernmentReviewPoRow;
}) {
  return (
    <GovernmentReviewSectionCard title="ملخص أمر العمل">
      <Note tone="info" className="mb-0 text-[13px]">
        {row.primaryDataLabel}
      </Note>
      {row.courts.length > 0 ? (
        <p className="m-0 text-[13px] leading-relaxed text-text-2">
          <span className="font-medium text-text">المحاكم:</span>{" "}
          {row.courts.join(" · ")}
        </p>
      ) : (
        <p className="m-0 text-[13px] leading-relaxed text-text-3">
          لا توجد محاكم مسجّلة بعد في بيانات العقارات.
        </p>
      )}
    </GovernmentReviewSectionCard>
  );
}
