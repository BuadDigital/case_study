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
