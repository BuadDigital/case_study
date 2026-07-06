"use client";

import { useCallback, useEffect } from "react";
import { PoPropertiesPage } from "@case-study/mfe";
import type { PoPropertyRowMoreContext } from "@case-study/mfe/lib/prototype/po-properties-row-menu";
import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { useToast } from "@platform/design-system";
import { buildAppraiserRecallMenuItems, EVALUATOR_SUBMISSION_CHANGED_EVENT, PARTY_TASK_RECALL_CHANGED_EVENT } from "@evaluator/mfe";
import { useWorkflowTasksQuery } from "@/lib/query/prototype-queries";

export function PoPropertiesPageClient({ poNumber }: { poNumber: string }) {
  const { role } = usePrototype();
  const { showToast } = useToast();
  const { data: tasks, refetch } = useWorkflowTasksQuery();

  useEffect(() => {
    if (role !== "real-estate-appraiser") return;
    const handler = () => void refetch();
    window.addEventListener(PARTY_TASK_RECALL_CHANGED_EVENT, handler);
    window.addEventListener(EVALUATOR_SUBMISSION_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(PARTY_TASK_RECALL_CHANGED_EVENT, handler);
      window.removeEventListener(EVALUATOR_SUBMISSION_CHANGED_EVENT, handler);
    };
  }, [role, refetch]);

  const buildPropertyRowMoreItems = useCallback(
    (ctx: PoPropertyRowMoreContext): RowMoreMenuItem[] => {
      if (role !== "real-estate-appraiser") return [];
      const task = (tasks ?? []).find(
        (t) =>
          t.kind === "property-appraisal" &&
          t.poNumber.trim() === ctx.poNumber.trim() &&
          t.propertyId === ctx.property.id,
      );
      if (!task) return [];
      return buildAppraiserRecallMenuItems(task, ctx.refresh, {
        onRecallSent: () =>
          showToast("تم إرسال طلب استرجاع المعاملة", "success"),
        onRecallFailed: () =>
          showToast("تعذّر إرسال الطلب — حاول لاحقاً", "error"),
      });
    },
    [role, tasks, showToast],
  );

  return (
    <PoPropertiesPage
      poNumber={poNumber}
      buildPropertyRowMoreItems={
        role === "real-estate-appraiser" ? buildPropertyRowMoreItems : undefined
      }
    />
  );
}