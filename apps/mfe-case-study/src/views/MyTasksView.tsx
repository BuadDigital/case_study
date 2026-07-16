"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ActiveTransactionQueueView,
  type ActiveQueueApi,
  type ActiveTransactionQueueConfig,
} from "@case-study/mfe/views/ActiveTransactionQueueView";
import { CaseStudyTaskWork } from "@case-study/mfe/views/MyTaskWorkView";
import {
  distributionTaskPath,
  myTasksPath,
  primaryDataTaskPath,
} from "../lib/my-task-routes";
import { filterTasksForPrimaryData } from "@case-study/mfe/lib/prototype/transaction-filters";
import { nextPrimaryDataTaskId } from "../lib/prototype/my-task-row";
import {
  skipsBourseForIdentifier,
  type PropertyIdentifierType,
} from "../lib/prototype/po-intake-data";

const PRIMARY_DATA_QUEUE: ActiveTransactionQueueConfig = {
  pageId: "active-primary-data",
  pageTitle: "البيانات الأولية",
  hidePageTitle: true,
  emptyLine: "لا توجد معاملات في «البيانات الأولية».",
  emptyHint:
    "تُنشأ خانات البيانات الأولية عند تسجيل أمر عمل بعدد العقارات المتوقع.",
  tableHint:
    "اضغط الصف لفتح البيانات الأولية — اضغط نفس الصف مرة أخرى للإغلاق.",
  panelId: "primary-data-panel",
  getBasePath: myTasksPath,
  getTaskPath: primaryDataTaskPath,
  queueSort: "newest-first",
  statusColumnLabel: "المدة المتبقية",
  filterListed: (mine, poByNumber) => filterTasksForPrimaryData(mine, poByNumber),
  allowCopyFromPrior: true,
  allowDeleteTransaction: true,
};

export function MyTasksView() {
  const router = useRouter();
  const queueApiRef = useRef<ActiveQueueApi | null>(null);

  const handleEnfathSaved = useCallback(
    async (
      savedTaskId: string,
      meta: { identifierType: PropertyIdentifierType },
    ) => {
      const api = queueApiRef.current;
      if (!api) return;

      try {
        api.setAdvancing(true);

        if (skipsBourseForIdentifier(meta.identifierType)) {
          router.replace(distributionTaskPath(savedTaskId), { scroll: false });
          await api.syncQueue();
          return;
        }

        const nextId = nextPrimaryDataTaskId(
          api.listed,
          savedTaskId,
          api.poByNumber,
        );
        if (nextId) {
          api.openTask(nextId);
        }

        await api.syncQueue();

        if (!nextId) {
          api.closePanel();
        }
      } finally {
        api.setAdvancing(false);
      }
    },
    [router],
  );

  return (
    <ActiveTransactionQueueView
      config={PRIMARY_DATA_QUEUE}
      queueApiRef={queueApiRef}
      renderPanel={({ task, onRefresh, onClose }) => (
        <CaseStudyTaskWork
          key={task.id}
          task={task}
          onRefresh={onRefresh}
          layout="panel"
          onClose={onClose}
          onEnfathSaved={handleEnfathSaved}
        />
      )}
    />
  );
}
