"use client";

import type { PartyEngineeringSurveyExtensions } from "@case-study/mfe";
import type { PoIntakeRecord } from "@case-study/mfe";
import type { WorkflowTask } from "@case-study/mfe";
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

export const partyEngineeringSurveyExtensions: PartyEngineeringSurveyExtensions =
  {
    patchQueueConfig(base, _def) {
      const baseFilter = base.filterListed!;

      return {
        ...base,
        hidePageTitle: true,
        emptyHint:
          "تظهر هنا بعد تأكيد التوزيع عند تفعيل المكتب الهندسي — اضغط الصف لفتح مهمة الرفع.",
        tableHint: "اضغط الصف لفتح مهمة الرفع المساحي في صفحة مستقلة.",
        fullPageTaskPath: activeSurveyWorkspacePath,
        statusColumnLabel: "الحالة",
        filterListed: (
          mine: WorkflowTask[],
          poByNumber: Map<string, PoIntakeRecord>,
        ) => {
          const listed = filterEngineeringSurveyListedTasks(
            baseFilter(mine, poByNumber),
          );
          void prefetchEngineeringSurveySubmissions(listed.map((t) => t.id));
          return listed;
        },
        getTaskStatusBadge: (task) => engineeringSurveyTaskStatusBadge(task.id),
        refreshOnWindowEvents: [ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT],
      };
    },

    renderSurveyWork({
      def,
      childTask,
      hostRef,
      deedNumber,
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
