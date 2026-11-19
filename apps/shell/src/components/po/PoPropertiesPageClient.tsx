"use client";

import { useCallback, useEffect } from "react";
import { PoPropertiesPage } from "@case-study/mfe/views/PoPropertiesPage";
import type { PoPropertyRowMoreContext } from "@case-study/mfe/lib/app-data/po-properties-row-menu";
import {
  type RowMoreMenuItem,
  useToast,
} from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { buildAppraiserRecallMenuItems } from "@evaluator/mfe/lib/evaluator/appraiser-recall-menu-items";
import { useWorkflowTasksQuery } from "@/lib/query/app-data-queries";
import {
  EVALUATOR_SUBMISSION_CHANGED_EVENT,
  PARTY_TASK_RECALL_CHANGED_EVENT,
} from "@platform/app-shared/events/app-events";
import { WorkflowTaskKinds } from "@platform/app-shared/workflow/task-types";
import { Roles } from "@platform/types";

export function PoPropertiesPageClient({ poNumber }: { poNumber: string }) {
  const { role } = useAppAccess();
  const { showToast } = useToast();
  const { data: tasks, refetch } = useWorkflowTasksQuery();

  useEffect(() => {
    if (role !== Roles.RealEstateAppraiser) return;
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
      if (role !== Roles.RealEstateAppraiser) return [];
      const task = (tasks ?? []).find(
        (t) =>
          t.kind === WorkflowTaskKinds.PropertyAppraisal &&
          t.poNumber.trim() === ctx.poNumber.trim() &&
          t.propertyId === ctx.property.id,
      );
      if (!task) return [];
      return buildAppraiserRecallMenuItems(task, () => void refetch(), {
        onRecallSent: () =>
          showToast("تم إرسال طلب استرجاع المعاملة", "success"),
        onRecallFailed: () =>
          showToast("تعذّر إرسال الطلب — حاول لاحقاً", "error"),
      });
    },
    [role, tasks, showToast, refetch],
  );

  return (
    <PoPropertiesPage
      poNumber={poNumber}
      buildPropertyRowMoreItems={
        role === Roles.RealEstateAppraiser ? buildPropertyRowMoreItems : undefined
      }
    />
  );
}