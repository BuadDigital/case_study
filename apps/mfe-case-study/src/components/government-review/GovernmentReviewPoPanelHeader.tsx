"use client";

import { Button } from "@platform/design-system";
import { PoNumber } from "../ui/PoNumber";
import type { GovernmentReviewPoRow } from "../../lib/prototype/government-review-po";

export function GovernmentReviewPoPanelHeader({
  row,
  onClose,
}: {
  row: GovernmentReviewPoRow;
  onClose: () => void;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-surface px-4 py-3.5">
      <div className="min-w-0 space-y-1.5">
        <h2 className="m-0 text-base font-semibold leading-tight text-text">
          <PoNumber value={row.poNumber} />
        </h2>
        <p className="m-0 flex flex-wrap gap-x-2 gap-y-1 text-xs leading-relaxed text-text-2">
          <span>{row.assignmentType}</span>
          <span className="text-text-3" aria-hidden>
            ·
          </span>
          <span>{row.propertyCount} عقار</span>
          <span className="text-text-3" aria-hidden>
            ·
          </span>
          <span>{row.openCount} مهمة مفتوحة</span>
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="default"
        className="shrink-0"
        onClick={onClose}
      >
        إغلاق
      </Button>
    </div>
  );
}
