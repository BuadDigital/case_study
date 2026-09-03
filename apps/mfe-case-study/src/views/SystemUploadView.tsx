"use client";

import { useMemo } from "react";
import { filterTasksForSystemUpload } from "@platform/app-shared/app-data/active-transactions";
import {
  ActiveTransactionQueueView,
  type ActiveTransactionQueueConfig,
} from "./ActiveTransactionQueueView";
import { buildCaseStudyQueueRowMoreItems } from "../lib/app-data/active-queue-row-menu";
import {
  caseStudyWorkspacePath,
  systemUploadPath,
} from "../lib/my-task-routes";
import { poPropertyPath } from "@platform/app-shared/domain/po-routes";

export function SystemUploadView() {
  const config = useMemo(
    (): ActiveTransactionQueueConfig => ({
      pageId: "system-upload",
      pageTitle: "الرفع على النظام",
      hidePageTitle: true,
      tableLayout: "case-study",
      emptyLine: "لا توجد عقارات مكتملة الدراسة جاهزة للرفع.",
      emptyHint:
        "تظهر هنا فقط العقارات التي اكتملت دراستها (قبول الأخصائي). اضغط الصف لفتح تبويب حزمة الرفع/إنفاذ.",
      panelId: "system-upload-panel",
      getBasePath: systemUploadPath,
      getTaskPath: caseStudyWorkspacePath,
      /** Completed case-study tasks are the source queue for this page. */
      includeAllStatuses: true,
      resolveFullPageTaskPath: (task) => {
        if (task.poNumber?.trim() && task.propertyId?.trim()) {
          return `${poPropertyPath(task.poNumber, task.propertyId)}?tab=enfath-upload`;
        }
        return caseStudyWorkspacePath(task.id);
      },
      queueSort: "distributed-newest-first",
      filterListed: (mine) => filterTasksForSystemUpload(mine),
      buildRowMoreItems: ({ task, propertyId, router, viewerRole }) =>
        buildCaseStudyQueueRowMoreItems({
          task,
          propertyId,
          router,
          viewerRole,
        }),
    }),
    [],
  );

  return <ActiveTransactionQueueView config={config} />;
}
