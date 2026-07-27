"use client";

import type { PartyAppraisalExtensions } from "@case-study/mfe";
import type { PoIntakeRecord } from "@case-study/mfe";
import type { WorkflowTask } from "@case-study/mfe";
import { propertyAppraisalWorkspacePath } from "@case-study/mfe/lib/my-task-routes";
import { AppraiserUploadTab } from "../components/evaluator/AppraiserUploadTab";
import { buildAppraiserQueueRowMoreItems } from "../lib/evaluator/appraiser-queue-row-menu";
import {
  appraiserTaskStatusBadge,
  canAppraiserOpenTask,
  filterAppraiserListedTasks,
} from "../lib/evaluator/evaluator-queue";
import {
  PARTY_TASK_RECALL_CHANGED_EVENT,
  PARTY_TASK_RECALL_HYDRATED_EVENT,
  hydratePartyTaskRecalls,
} from "@platform/app-shared/prototype/party-task-recall-storage";
import {
  EVALUATOR_SUBMISSION_CHANGED_EVENT,
  isEvaluatorFormLocked,
  loadEvaluatorSubmission,
  prefetchEvaluatorSubmissions,
} from "../lib/evaluator/evaluator-submission-storage";
import type { EvaluatorWindowHostRefObject } from "../lib/evaluator/evaluator-window-host";

/** Footer from Case Study.html `renderValOrders`. */
const APPRAISER_TABLE_HINT =
  "لا يُفعَّل إدخال التقييم إلا بعد اكتمال المعاينة الميدانية لنفس العقار. مصدر سعر التقييم هو المقيم وحده — ويُعرض للأخصائي للاسترشاد به في دراسة الحالة.";

export const partyAppraisalExtensions: PartyAppraisalExtensions = {
  patchQueueConfig(base, _def) {
    const baseFilter = base.filterListed!;

    return {
      ...base,
      hidePageTitle: true,
      tableLayout: "property-appraisal",
      emptyHint:
        "بعد الإرسال للأخصائي تختفي المعاملة من هنا — لاستدعائها افتح «عقارات أمر العمل» ثم ⋮ على الصك، أو فعّل «إظهار الكل».",
      tableHint: APPRAISER_TABLE_HINT,
      fullPageTaskPath: propertyAppraisalWorkspacePath,
      statusColumnLabel: "الحالة",
      filterListed: (
        mine: WorkflowTask[],
        poByNumber: Map<string, PoIntakeRecord>,
        options?: { showCompleted?: boolean },
      ) => {
        void hydratePartyTaskRecalls();
        const listed = filterAppraiserListedTasks(baseFilter(mine, poByNumber), {
          showCompleted: options?.showCompleted,
        });
        void prefetchEvaluatorSubmissions(listed.map((t) => t.id));
        return listed;
      },
      buildRowMoreItems: (ctx) => buildAppraiserQueueRowMoreItems(ctx),
      canOpenTask: (task) => canAppraiserOpenTask(task.id, task.status),
      getTaskStatusBadge: (task) =>
        appraiserTaskStatusBadge(task.id, task.status),
      refreshOnWindowEvents: [
        PARTY_TASK_RECALL_CHANGED_EVENT,
        PARTY_TASK_RECALL_HYDRATED_EVENT,
        EVALUATOR_SUBMISSION_CHANGED_EVENT,
      ],
    };
  },

  renderAppraisalWork({
    def,
    childTask,
    hostRef,
    propertySummary,
    deedLabel,
    onBack,
  }) {
    return (
      <AppraiserUploadTab
        def={def}
        childTask={childTask}
        hostRef={hostRef as EvaluatorWindowHostRefObject}
        propertySummary={propertySummary}
        deedLabel={deedLabel}
        onBack={onBack}
      />
    );
  },

  isEvaluatorLocked(taskId, saving) {
    void saving;
    const sub = loadEvaluatorSubmission(taskId);
    return sub ? isEvaluatorFormLocked(sub.status) : false;
  },
};
