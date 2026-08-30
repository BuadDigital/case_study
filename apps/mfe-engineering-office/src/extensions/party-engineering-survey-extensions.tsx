"use client";

import type { PartyEngineeringSurveyExtensions } from "@case-study/mfe/lib/party-engineering-survey-extensions";
import type { PoIntakeRecord } from "@case-study/mfe/lib/prototype/po-intake-data";
import type { WorkflowTask } from "@case-study/mfe/lib/prototype/tasks-storage";
import { activeSurveyWorkspacePath } from "@case-study/mfe/lib/my-task-routes";
import { EngineeringSurveyWorkPanel } from "../components/EngineeringSurveyWorkPanel";
import { isEngineeringSurveyFormLocked } from "../lib/engineering-survey-data";
import {
  engineeringSurveyTaskStatusBadge,
  filterEngineeringSurveyListedTasks,
} from "../lib/engineering-survey-queue";
import {
  ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
  loadEngineeringSurveySubmission,
  prefetchEngineeringSurveySubmissions,
} from "../lib/engineering-survey-submission-storage";
import type { EngineeringSurveyWindowHostRefObject } from "../lib/engineering-survey-window-host";

/** Footer from Case Study.html `renderEngOrders` — prerequisites to start the survey. */
const ENG_SURVEY_TABLE_HINT =
  "اشتراطات البدء بالرفع: رقم ضابط اتصال إلزامي · الأرض المنظمة تُرفع مباشرة · الأرض الشعبية تتطلب تحديد موقع العقار (وإلا يُشعَر الأخصائي وتوقف مؤقتاً) · المباني تتطلب إخطار المعاين أو إتمام المعاينة.";

export const partyEngineeringSurveyExtensions: PartyEngineeringSurveyExtensions =
  {
    patchQueueConfig(base, _def) {
      const baseFilter = base.filterListed!;

      return {
        ...base,
        hidePageTitle: true,
        tableLayout: "engineering-survey",
        emptyHint:
          "تظهر هنا بعد تأكيد التوزيع عند تفعيل المكتب الهندسي — اضغط الصف لفتح مهمة الرفع.",
        tableHint: ENG_SURVEY_TABLE_HINT,
        fullPageTaskPath: activeSurveyWorkspacePath,
        statusColumnLabel: "الحالة",
        filterListed: (
          mine: WorkflowTask[],
          poByNumber: Map<string, PoIntakeRecord>,
          options?: { showCompleted?: boolean },
        ) => {
          const listed = filterEngineeringSurveyListedTasks(
            baseFilter(mine, poByNumber),
            { showCompleted: options?.showCompleted },
          );
          void prefetchEngineeringSurveySubmissions(listed.map((t) => t.id));
          return listed;
        },
        getTaskStatusBadge: (task) =>
          engineeringSurveyTaskStatusBadge(task.id, task.status),
        refreshOnWindowEvents: [ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT],
      };
    },

    renderSurveyWork({
      def,
      childTask,
      hostRef,
      deedNumber,
      onBack,
      onFailureSubmitted,
      variant,
      forceReadOnly,
    }) {
      return (
        <EngineeringSurveyWorkPanel
          def={def}
          childTask={childTask}
          hostRef={hostRef as EngineeringSurveyWindowHostRefObject}
          deedNumber={deedNumber}
          onBack={onBack}
          onFailureSubmitted={onFailureSubmitted}
          variant={variant ?? "workspace"}
          forceReadOnly={forceReadOnly}
        />
      );
    },

    isSurveyLocked(taskId, saving) {
      void saving;
      const sub = loadEngineeringSurveySubmission(taskId);
      return sub ? isEngineeringSurveyFormLocked(sub.status) : false;
    },
  };
