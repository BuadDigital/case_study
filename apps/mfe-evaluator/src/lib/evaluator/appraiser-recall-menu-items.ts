import type { RowMoreMenuItem } from "@platform/ui-kit";
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
        const reason = window.prompt("سبب طلب الاسترجاع (اختياري):", "");
        if (reason === null) return;
        void requestPartyTaskRecall({
          taskId: task.id,
          poNumber: task.poNumber,
          propertyId: task.propertyId ?? "",
          reason,
        }).then((result) => {
          if (result.ok) {
            options?.onRecallSent?.();
            refresh();
            return;
          }
          options?.onRecallFailed?.();
        });
      },
    },
  ];
}
