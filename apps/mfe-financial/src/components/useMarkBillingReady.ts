"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { EnfazTrackingRowDto } from "@platform/api-client";
import { markDeedBillingReady } from "@platform/app-shared/app-data/enfaz-billing-api";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { confirmAction, useToast } from "@platform/ui-kit";

/**
 * «تعليم جاهز للفوترة»: the accountant marks a handed-over deed once its financial data appeared on
 * Enfaz. The mark is final for the specialist — a marked deed is no longer taken back from Enfaz —
 * so it is confirmed first.
 *
 * How it works: `mark(row)` asks for confirmation, then calls the mark endpoint for that deed's work
 * order + property, toasts the outcome, and invalidates every `enfaz-billing` query so the stage
 * tables, badges and My Tasks re-read the tracking rows. `markingId` is the property being marked
 * (or null) and drives the button state.
 *
 * Edge cases: a second call while one is running is ignored; a row without a work-order id (an older
 * server that does not send it) shows an error asking to refresh instead of sending a broken request;
 * cancelling the confirmation does nothing; a server refusal (not handed over, wrong role) is shown as
 * its own Arabic text and leaves the row unmarked; `markingId` is cleared in `finally`, so a thrown
 * error cannot leave the buttons disabled.
 */
export function useMarkBillingReady() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [markingId, setMarkingId] = useState<string | null>(null);

  const mark = async (row: EnfazTrackingRowDto) => {
    if (markingId) return;
    if (!row.workOrderId) {
      showToast("تعذّر تحديد أمر العمل — حدّث الصفحة وأعد المحاولة", "error");
      return;
    }
    const ok = await confirmAction({
      title: "تعليم الصك جاهزاً للفوترة",
      message:
        "تأكد أن بياناته المالية ظهرت على منصة إنفاذ. بعد التعليم لا يُسترجع الصك من إنفاذ للتعديل.",
      confirmLabel: "تعليم جاهز للفوترة",
    });
    if (!ok) return;

    setMarkingId(row.propertyId);
    try {
      const result = await markDeedBillingReady(row.workOrderId, row.propertyId);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast("وُسم الصك «جاهز للفوترة»", "success");
      await queryClient.invalidateQueries({
        queryKey: [...appDataKeys.all, "enfaz-billing"],
      });
    } finally {
      setMarkingId(null);
    }
  };

  return { markingId, mark };
}
