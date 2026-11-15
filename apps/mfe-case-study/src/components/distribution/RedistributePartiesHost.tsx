"use client";

import dynamic from "next/dynamic";
import { useToast } from "@platform/ui-kit";
import {
  redistributeTaskParties,
  type WorkflowTask,
} from "../../lib/app-data/tasks";
import { skipEngineeringSurveyOfTask } from "../../lib/app-data/tasks-commands";

const RedistributePartiesModal = dynamic(
  () =>
    import("./RedistributePartiesModal").then(
      (m) => m.RedistributePartiesModal,
    ),
  { ssr: false },
);

/**
 * «تعديل إسناد الأطراف» for one case-study task, opened from a row's ⋮ menu.
 *
 * How it works: mounts the modal only while a task is set (its chunk loads on demand) and saves
 * through `redistributeTaskParties` with the staff directory, so the new assignee keeps his name.
 * Edge cases: a refused save shows the server's message and keeps the modal open (the throw tells
 * the modal it failed). Extracted 2026-11-05 from the study queue so «أعمالي» opens the same modal.
 * «جميع العقارات» (Omar 2026-11-15) opens it as «تعديل الأطراف»: with `allowDropOffice` the open
 * engineering office may also be dropped (`skipEngineeringSurveyOfTask`).
 */
export function RedistributePartiesHost({
  task,
  onClose,
  mayReassign = true,
  allowDropOffice = false,
}: {
  task: WorkflowTask | null;
  onClose: () => void;
  /** The viewer may hand a party to someone else (`canRedistributeParties`). */
  mayReassign?: boolean;
  /** The viewer may drop the office (`canSkipEngineeringSurvey`). */
  allowDropOffice?: boolean;
}) {
  const { showToast } = useToast();
  if (task === null) return null;
  return (
    <RedistributePartiesModal
      open
      task={task}
      onClose={onClose}
      mayReassign={mayReassign}
      onSkipOffice={
        allowDropOffice
          ? async (reason) => {
              const result = await skipEngineeringSurveyOfTask(task.id, reason);
              if (!result.ok) {
                showToast(result.error, "error");
                throw new Error(result.error);
              }
              showToast("أُلغي المكتب الهندسي وأُبلغ المكتب", "success");
            }
          : undefined
      }
      onConfirm={async (distribution, reason, idempotencyKey, staffUsers) => {
        // The directory resolves the new assignee's name; without it the server stored the
        // generic role label («معاين ميداني») instead of the person.
        const result = await redistributeTaskParties(
          task.id,
          distribution,
          reason,
          staffUsers,
          idempotencyKey,
        );
        if (!result.ok) {
          showToast(result.error, "error");
          throw new Error(result.error);
        }
        showToast("تم تحديث إسناد الأطراف", "success");
      }}
    />
  );
}
