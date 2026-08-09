"use client";

import { useMemo } from "react";
import { filterTasksForSystemUpload } from "@platform/app-shared/prototype/active-transactions";
import {
  ActiveTransactionQueueView,
  type ActiveTransactionQueueConfig,
} from "./ActiveTransactionQueueView";
import { buildCaseStudyQueueRowMoreItems } from "../lib/prototype/active-queue-row-menu";
import {
  caseStudyWorkspacePath,
  systemUploadPath,
} from "../lib/my-task-routes";
import { poPropertyPath } from "../lib/po-routes";

export function SystemUploadView() {
  const config = useMemo(
    (): ActiveTransactionQueueConfig => ({
      pageId: "system-upload",
      pageTitle: "الرفع على النظام",
      hidePageTitle: true,
      tableLayout: "case-study",
      emptyLine: "لا توجد معاملات جاهزة للرفع على النظام.",
      emptyHint:
        "تظهر هنا معاملات دراسة الحالة لتعبئة حزمة الرفع ونسخها إلى المنصة/إنفاذ. اضغط الصف لفتح تبويب الرفع.",
      panelId: "system-upload-panel",
      getBasePath: systemUploadPath,
      getTaskPath: caseStudyWorkspacePath,
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
