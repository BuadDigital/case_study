"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { filterTasksForCaseStudy } from "@platform/app-shared/prototype/active-transactions";
import { PanelSkeleton, useToast } from "@platform/ui-kit";
import {
  ActiveTransactionQueueView,
  type ActiveTransactionQueueConfig,
} from "./ActiveTransactionQueueView";
import { buildCaseStudyQueueRowMoreItems } from "../lib/prototype/active-queue-row-menu";
const RedistributePartiesModal = dynamic(
  () =>
    import("../components/distribution/RedistributePartiesModal").then(
      (m) => m.RedistributePartiesModal,
    ),
  { ssr: false },
);
import {
  redistributeTaskParties,
  type WorkflowTask,
} from "../lib/prototype/tasks-storage";
import {
  activeCaseStudyPath,
  caseStudyTaskPath,
  caseStudyWorkspacePath,
  decodeTaskParam,
} from "../lib/my-task-routes";

export function ActiveCaseStudyView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacyTask = searchParams.get("task");
  const { showToast } = useToast();
  const [redistributeTask, setRedistributeTask] = useState<WorkflowTask | null>(
    null,
  );

  useEffect(() => {
    if (!legacyTask) return;
    router.replace(caseStudyWorkspacePath(decodeTaskParam(legacyTask)));
  }, [legacyTask, router]);

  const config = useMemo((): ActiveTransactionQueueConfig => ({
    pageId: "active-case-study",
    pageTitle: "دراسة حالة العقارات",
    hidePageTitle: true,
    tableLayout: "case-study",
    disableRowOpen: true,
    emptyLine: "لا توجد معاملات في مرحلة دراسة الحالة.",
    emptyHint:
      "تظهر هنا بعد تأكيد توزيع المعاملة وإرسال المهام للأطراف. افتح عبر رقم الصك أو أمر العمل أو قائمة ⋮.",
    tableHint: "افتح عبر رقم الصك أو أمر العمل أو قائمة ⋮.",
    panelId: "case-study-panel",
    getBasePath: activeCaseStudyPath,
    getTaskPath: caseStudyTaskPath,
    fullPageTaskPath: caseStudyWorkspacePath,
    queueSort: "distributed-newest-first",
    filterListed: (mine) => filterTasksForCaseStudy(mine),
    buildRowMoreItems: ({ task, propertyId, router: rowRouter, viewerRole }) =>
      buildCaseStudyQueueRowMoreItems({
        task,
        propertyId,
        router: rowRouter,
        viewerRole,
        onRedistributeParties: () => setRedistributeTask(task),
      }),
  }), []);

  if (legacyTask) {
    return <PanelSkeleton className="my-2" />;
  }

  return (
    <>
      <ActiveTransactionQueueView config={config} />
      {redistributeTask !== null ? (
        <RedistributePartiesModal
          open={redistributeTask !== null}
          task={redistributeTask}
          onClose={() => setRedistributeTask(null)}
          onConfirm={async (distribution, reason) => {
            if (!redistributeTask) return;
            const result = await redistributeTaskParties(
              redistributeTask.id,
              distribution,
              reason,
            );
            if (!result.ok) {
              showToast(result.error, "error");
              return;
            }
            showToast("تم تحديث إسناد الأطراف", "success");
          }}
        />
      ) : null}
    </>
  );
}
