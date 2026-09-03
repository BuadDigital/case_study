"use client";

import type { PartyAppraisalExtensions } from "@case-study/mfe/lib/party-appraisal-extensions";
import type { PoIntakeRecord } from "@case-study/mfe/lib/app-data/po-intake-data";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import { propertyAppraisalWorkspacePath } from "@case-study/mfe/lib/my-task-routes";
import dynamic from "next/dynamic";

const AppraiserUploadTab = dynamic(() =>
    import("../components/evaluator/AppraiserUploadTab").then(
      (m) => m.AppraiserUploadTab,
    ),
  { ssr: false },
);
import { buildAppraiserQueueRowMoreItems } from "../lib/evaluator/appraiser-queue-row-menu";
import {
  appraiserTaskStatusBadge,
  canAppraiserOpenTask,
  filterAppraiserListedTasks,
} from "../lib/evaluator/evaluator-queue";
import { PARTY_TASK_RECALL_CHANGED_EVENT, PARTY_TASK_RECALL_HYDRATED_EVENT } from "@platform/app-shared/app-data/party-task-recall-model";
import { hydratePartyTaskRecalls } from "@platform/app-shared/app-data/party-task-recall-reads";
import {
  EVALUATOR_SUBMISSION_CHANGED_EVENT,
  isEvaluatorFormLocked,
  loadEvaluatorSubmission,
} from "../lib/evaluator/evaluator-submission-model";
import { prefetchEvaluatorSubmissions } from "../lib/evaluator/evaluator-submission-reads";
import type { EvaluatorWindowHostRefObject } from "../lib/evaluator/evaluator-window-host";

/** Footer from Case Study.html `renderValOrders`. */
const APPRAISER_TABLE_HINT = "راقب تقدم الأطراف من هنا. حساب القيمة يُفعَّل بعد اكتمال معاينة العقار — الأخصائي يعتمد تقرير التقييم لاحقاً داخل دراسة الحالة (أو يعيده للتصحيح).";

export const partyAppraisalExtensions: PartyAppraisalExtensions = {
  patchQueueConfig(base, _def) {
    const baseFilter = base.filterListed!;

    return {
      ...base,
      hidePageTitle: true,
      tableLayout: "property-appraisal",
      emptyHint: "بعد الإرسال للأخصائي تختفي المعاملة من هنا — لاستدعائها افتح «عقارات أمر العمل» ثم ⋮ على الصك، أو فعّل «إظهار الكل».",
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
    embeddedInPropertyChrome,
  }) {
    return (
      <AppraiserUploadTab
        def={def}
        childTask={childTask}
        hostRef={hostRef as EvaluatorWindowHostRefObject}
        propertySummary={propertySummary}
        deedLabel={deedLabel}
        onBack={onBack}
        embeddedInPropertyChrome={embeddedInPropertyChrome}
      />
    );
  },

  isEvaluatorLocked(taskId, saving) {
    void saving;
    const sub = loadEvaluatorSubmission(taskId);
    return sub ? isEvaluatorFormLocked(sub.status) : false;
  },
};