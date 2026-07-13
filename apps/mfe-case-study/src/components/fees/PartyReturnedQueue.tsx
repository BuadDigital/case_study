"use client";

import { useMemo } from "react";
import { EmptyState } from "@platform/design-system";
import type { InspectorFeeRowDto } from "@platform/api-client";
import { PartyFeeWorkflowTable } from "./PartyFeeWorkflowTable";

export function PartyReturnedQueue({ rows }: { rows: InspectorFeeRowDto[] }) {
  const returned = useMemo(
    () =>
      rows.filter(
        (r) =>
          (r.billingStatus === "returned" && r.returnTo === "office") ||
          (r.billingStatus === "inquiry" && r.returnTo === "office"),
      ),
    [rows],
  );

  if (returned.length === 0) {
    return (
      <EmptyState
        line="لا شيء مُعاد إليك أو بانتظار رد على استفسار."
        hint="إن أعادت المالية المعاملة للمشرف فستظهر عنده في «المُعاد من المالية»، وليس هنا."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-text-3">
        معاملات أعادتها أو استفسرت عنها المالية. عالجها ثم أعد رفعها للمشرف.
      </p>
      <PartyFeeWorkflowTable rows={returned} role="office" />
    </div>
  );
}
