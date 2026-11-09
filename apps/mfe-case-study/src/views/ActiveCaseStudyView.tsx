"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { filterTasksForCaseStudy } from "@platform/app-shared/app-data/active-transactions";
import { PanelSkeleton } from "@platform/ui-kit";
import {
  ActiveTransactionQueueView,
  type ActiveTransactionQueueConfig,
} from "./ActiveTransactionQueueView";
import { buildCaseStudyQueueRowMoreItems } from "../lib/app-data/active-queue-row-menu";
import type { WorkflowTask } from "../lib/app-data/tasks";
import { RedistributePartiesHost } from "../components/distribution/RedistributePartiesHost";
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
      "تظهر هنا بعد تأكيد توزيع المعاملة وإرسال المهام للأطراف. اضغط الصف لفتح تفاصيل العقار.",
    tableHint: "اضغط الصف لفتح تفاصيل العقار.",
    panelId: "case-study-panel",
    getBasePath: activeCaseStudyPath,
    getTaskPath: caseStudyTaskPath,
    fullPageTaskPath: caseStudyWorkspacePath,
    queueSort: "distributed-newest-first",
    filterListed: (mine) => filterTasksForCaseStudy(mine),
    buildRowMoreItems: ({ task, propertyId, router: rowRouter, viewerRole, viewerAccess }) =>
      buildCaseStudyQueueRowMoreItems({
        task,
        propertyId,
        router: rowRouter,
        viewerRole,
        viewerAccess,
        onRedistributeParties: () => setRedistributeTask(task),
      }),
  }), []);

  if (legacyTask) {
    return <PanelSkeleton className="my-2" />;
  }

  return (
    <>
      <ActiveTransactionQueueView config={config} />
      <RedistributePartiesHost
        task={redistributeTask}
        onClose={() => setRedistributeTask(null)}
      />
    </>
  );
}
