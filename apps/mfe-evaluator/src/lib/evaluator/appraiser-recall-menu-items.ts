import { promptAction, type RowMoreMenuItem } from "@platform/ui-kit";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import { getPartyTaskRecall } from "@platform/app-shared/app-data/party-task-recall-model";
import { requestPartyTaskRecall } from "@platform/app-shared/app-data/party-task-recall-commands";
import { loadEvaluatorSubmission } from "./evaluator-submission-model";

export function buildAppraiserRecallMenuItems(
  task: WorkflowTask,
  refresh: () => void,
  options?: {
    onRecallSent?: () => void;
    onRecallFailed?: () => void;
  },
): RowMoreMenuItem[] {
  // After the final issuance the report is deposited: a change is a new version by the specialist.
  if (task.status === "completed") return [];
  const submission = loadEvaluatorSubmission(task.id);
  if (submission?.status !== "submitted") return [];

  const recall = getPartyTaskRecall(task.id);
  if (recall?.status === "pending") {
    return [
      {
        id: "recall-pending",
        label: "بانتظار موافقة الأخصائي",
        disabled: true,
        onClick: () => {},
      },
    ];
  }

  return [
    {
      id: "recall",
      label: "طلب استرجاع المعاملة",
      onClick: () => {
        void (async () => {
          const reason = await promptAction({
            title: "طلب استرجاع المعاملة",
            label: "سبب طلب الاسترجاع (اختياري)",
            confirmLabel: "إرسال الطلب",
          });
          if (reason === null) return;
          const result = await requestPartyTaskRecall({
            taskId: task.id,
            poNumber: task.poNumber,
            propertyId: task.propertyId ?? "",
            reason,
          });
          if (result.ok) {
            options?.onRecallSent?.();
            refresh();
            return;
          }
          options?.onRecallFailed?.();
        })();
      },
    },
  ];
}
