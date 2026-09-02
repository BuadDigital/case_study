"use client";

import type { PartyAppraisalExtensions } from "@case-study/mfe/lib/party-appraisal-extensions";
import type { PoIntakeRecord } from "@case-study/mfe/lib/app-data/po-intake-data";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import { propertyAppraisalWorkspacePath } from "@case-study/mfe/lib/my-task-routes";
import dynamic from "next/dynamic";

// Appraiser work window (~5.8k lines via ValuationWorkShell) mounts only when the appraiser opens
// their task — static import put it in every party's task-page bundle (bundle-dynamic-imports).
const AppraiserUploadTab = dynamic(
  () =>
    import("../components/evaluator/AppraiserUploadTab").then(
      (m) => m.AppraiserUploadTab,
    ),
  { ssr: false },
);
import { buildAppraiserQueueRowMoreItems } from "../lib/evaluator/appraiser-queue-row-menu";
import { appraiserTaskStatusBadge, canAppraiserOpenTask, filterAppraiserListedTasks } from "../lib/evaluator/evaluator-queue";
import { PARTY_TASK_RECALL_CHANGED_EVENT, PARTY_TASK_RECALL_HYDRATED_EVENT, hydratePartyTaskRecalls } from "@platform/app-shared/app-data/party-task-recall-storage";
import { EVALUATOR_SUBMISSION_CHANGED_EVENT, isEvaluatorFormLocked, loadEvaluatorSubmission, prefetchEvaluatorSubmissions } from "../lib/evaluator/evaluator-submission-storage";
import type { EvaluatorWindowHostRefObject } from "../lib/evaluator/evaluator-window-host";

/** Footer from Case Study.html `renderValOrders`. */
const APPRAISER_TABLE_HINT = "راقب تقدم الأطراف من هنا. حساب القيمة يُفعَّل بعد اعتماد الأخصائي لبيانات معاينة العقار — المقيّم يعتمد القيمة، واستلام الأخصائي ليس اعتماداً للسعر.";

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
