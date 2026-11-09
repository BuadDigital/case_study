"use client";

import { useMemo } from "react";
import { filterTasksForReceipt } from "@platform/app-shared/app-data/active-transactions";
import { poPropertyPath } from "@platform/app-shared/domain/po-routes";
import {
  ActiveTransactionQueueView,
  type ActiveTransactionQueueConfig,
} from "./ActiveTransactionQueueView";
import { buildCaseStudyQueueRowMoreItems } from "../lib/app-data/active-queue-row-menu";
import { activeReceiptPath, caseStudyWorkspacePath } from "../lib/my-task-routes";

/**
 * «الاستلام من الأطراف» — coordination's queue (ruling 2026-11-02): distributed transactions whose
 * parties are still working or have delivered and wait for the formal receipt. A row opens the
 * property page, where the receipt card names what is missing and receives the transaction.
 */
export function ActiveReceiptView() {
  const config = useMemo(
    (): ActiveTransactionQueueConfig => ({
      pageId: "active-receipt",
      pageTitle: "الاستلام من الأطراف",
      hidePageTitle: true,
      tableLayout: "case-study",
      emptyLine: "لا توجد معاملات بانتظار الاستلام.",
      emptyHint:
        "تظهر هنا المعاملات بعد التوزيع حتى يسلّم المعاين والمكتب الهندسي عملهما ويرسلها أخصائي التنسيق للدراسة؛ بعدها تنتقل إلى «دراسة حالة العقارات».",
      tableHint: "اضغط الصف لفتح تفاصيل العقار — «إرسال المعاملة للدراسة» في البطاقة الجانبية.",
      panelId: "receipt-panel",
      getBasePath: activeReceiptPath,
      getTaskPath: caseStudyWorkspacePath,
      resolveFullPageTaskPath: (task) =>
        task.poNumber?.trim() && task.propertyId?.trim()
          ? poPropertyPath(task.poNumber, task.propertyId)
          : caseStudyWorkspacePath(task.id),
      queueSort: "distributed-newest-first",
      filterListed: (mine) => filterTasksForReceipt(mine),
      buildRowMoreItems: ({ task, propertyId, router, viewerRole, viewerAccess }) =>
        buildCaseStudyQueueRowMoreItems({
          task,
          propertyId,
          router,
          viewerRole,
          viewerAccess,
        }),
    }),
    [],
  );

  return <ActiveTransactionQueueView config={config} />;
}
