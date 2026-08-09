"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { filterTasksForCaseStudy } from "@platform/app-shared/prototype/active-transactions";
import { PanelSkeleton, useToast } from "@platform/design-system";
import {
  ActiveTransactionQueueView,
  type ActiveTransactionQueueConfig,
} from "./ActiveTransactionQueueView";
import { buildCaseStudyQueueRowMoreItems } from "../lib/prototype/active-queue-row-menu";
import { RedistributePartiesModal } from "../components/distribution/RedistributePartiesModal";
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
    emptyLine: "لا توجد معاملات في مرحلة دراسة الحالة.",
    emptyHint:
      "تظهر هنا بعد تأكيد توزيع المعاملة وإرسال المهام للأطراف. اضغط الصف لفتح دراسة الحالة.",
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
    </>
  );
}
