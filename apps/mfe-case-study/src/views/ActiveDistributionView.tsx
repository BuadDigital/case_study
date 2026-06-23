"use client";

import {
  ActiveTransactionQueueView,
  type ActiveTransactionQueueConfig,
} from "@case-study/mfe/views/ActiveTransactionQueueView";
import { CaseStudyTaskWork } from "@case-study/mfe/views/MyTaskWorkView";
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
    "تظهر هنا بعد إكمال استعلام البورصة — المدينة والحي ونوع العقار من بيانات الصك.",
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
        <CaseStudyTaskWork
          key={task.id}
          task={task}
          onRefresh={onRefresh}
          layout="panel"
          onClose={onClose}
        />
      )}
    />
  );
}
