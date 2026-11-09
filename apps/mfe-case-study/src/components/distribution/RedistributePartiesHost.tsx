"use client";

import dynamic from "next/dynamic";
import { useToast } from "@platform/ui-kit";
import {
  redistributeTaskParties,
  type WorkflowTask,
} from "../../lib/app-data/tasks";

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
 */
export function RedistributePartiesHost({
  task,
  onClose,
}: {
  task: WorkflowTask | null;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  if (task === null) return null;
  return (
    <RedistributePartiesModal
      open
      task={task}
      onClose={onClose}
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
