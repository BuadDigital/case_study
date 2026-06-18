"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { filterTasksForCaseStudy } from "@platform/app-shared/prototype/active-transactions";
import { PanelSkeleton } from "@platform/design-system";
import {
  ActiveTransactionQueueView,
  type ActiveTransactionQueueConfig,
} from "./ActiveTransactionQueueView";
import { buildCaseStudyQueueRowMoreItems } from "../lib/prototype/active-queue-row-menu";
import {
  activeCaseStudyPath,
  caseStudyTaskPath,
  caseStudyWorkspacePath,
  decodeTaskParam,
} from "../lib/my-task-routes";

const CASE_STUDY_QUEUE: ActiveTransactionQueueConfig = {
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
  filterListed: (mine) => filterTasksForCaseStudy(mine),
  buildRowMoreItems: ({ task, propertyId, router }) =>
    buildCaseStudyQueueRowMoreItems({ task, propertyId, router }),
};

export function ActiveCaseStudyView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacyTask = searchParams.get("task");

  useEffect(() => {
    if (!legacyTask) return;
    router.replace(caseStudyWorkspacePath(decodeTaskParam(legacyTask)));
  }, [legacyTask, router]);

  if (legacyTask) {
    return <PanelSkeleton className="my-2" />;
  }

  return <ActiveTransactionQueueView config={CASE_STUDY_QUEUE} />;
}
