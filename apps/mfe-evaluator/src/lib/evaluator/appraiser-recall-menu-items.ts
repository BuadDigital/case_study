import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import type { WorkflowTask } from "@case-study/mfe/lib/prototype/tasks-storage";
import {
  getEvaluatorRecall,
  requestEvaluatorRecall,
} from "./evaluator-recall-storage";
import { loadEvaluatorSubmission } from "./evaluator-submission-storage";

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

  const recall = getEvaluatorRecall(task.id);
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
        void requestEvaluatorRecall({
          taskId: task.id,
          poNumber: task.poNumber,
          propertyId: task.propertyId ?? "",
          reason,
        }).then((result) => {
          if (result) {
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
