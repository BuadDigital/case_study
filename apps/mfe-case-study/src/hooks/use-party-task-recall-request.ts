"use client";

import { useCallback, useEffect } from "react";
import { useToast } from "@platform/design-system";
import {
  getPartyTaskRecall,
  hydratePartyTaskRecallForTask,
  requestPartyTaskRecall,
} from "@platform/app-shared/prototype/party-task-recall-storage";

export function usePartyTaskRecallRequest(options: {
  taskId: string;
  poNumber: string;
  propertyId: string;
  isSubmitted: boolean;
  notSubmittedMessage?: string;
}) {
  const { showToast } = useToast();

  useEffect(() => {
    if (!options.taskId) return;
    void hydratePartyTaskRecallForTask(options.taskId);
  }, [options.taskId]);

  return useCallback(() => {
    if (!options.isSubmitted) {
      showToast(
        options.notSubmittedMessage ??
          "لا يمكن طلب الاسترجاع قبل إرسال العمل للأخصائي",
        "error",
      );
      return;
    }

    const recall = getPartyTaskRecall(options.taskId);
    if (recall?.status === "pending") {
      showToast("طلبك بانتظار موافقة الأخصائي", "info");
      return;
    }

    const reason = window.prompt("سبب طلب الاسترجاع (اختياري):", "");
    if (reason === null) return;

    void requestPartyTaskRecall({
      taskId: options.taskId,
      poNumber: options.poNumber,
      propertyId: options.propertyId,
      reason,
    }).then((result) => {
      if (result.ok) {
        showToast("تم إرسال طلب استرجاع المعاملة", "success");
      } else {
        showToast(result.error, "error");
      }
    });
  }, [options, showToast]);
}
