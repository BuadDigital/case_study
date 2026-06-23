"use client";

import {
  ActiveTransactionQueueView,
  type ActiveTransactionQueueConfig,
} from "@case-study/mfe/views/ActiveTransactionQueueView";
import { DistributionTaskWork } from "../components/distribution/DistributionTaskWork";
import {
  activeDistributionPath,
  distributionTaskPath,
} from "../lib/my-task-routes";
import { FAILURES_CHANGED_EVENT } from "@failures/mfe/lib/failures-events";
import { TASKS_CHANGED_EVENT } from "@case-study/mfe/lib/prototype/tasks-storage";
import { filterTasksForDistribution } from "@case-study/mfe/lib/prototype/transaction-filters";

const DISTRIBUTION_QUEUE: ActiveTransactionQueueConfig = {
  pageId: "active-distribution",
  pageTitle: "توزيع المعاملات",
  hidePageTitle: true,
  tableLayout: "distribution",
  emptyLine: "لا توجد معاملات بانتظار التوزيع.",
  emptyHint:
    "تظهر هنا بعد إكمال البيانات الأولية واستعلام البورصة عند الحاجة.",
  tableHint:
    "اضغط الصف لفتح توزيع المعاملة على الأطراف — اضغط نفس الصف مرة أخرى للإغلاق.",
  panelId: "distribution-panel",
  getBasePath: activeDistributionPath,
  getTaskPath: distributionTaskPath,
  filterListed: (mine) => filterTasksForDistribution(mine),
  refreshOnWindowEvents: [FAILURES_CHANGED_EVENT, TASKS_CHANGED_EVENT],
};

export function ActiveDistributionView() {
  return (
    <ActiveTransactionQueueView
      config={DISTRIBUTION_QUEUE}
      renderPanel={({ task, onRefresh, onClose }) => (
        <DistributionTaskWork
          key={task.id}
          task={task}
          onRefresh={onRefresh}
          onClose={onClose}
        />
      )}
    />
  );
}
