import { mergeEvaluatorChecklistFromCaseStudy } from "@evaluator/mfe/lib/evaluator/evaluator-checklist-case-study-sync";
import type { EvaluatorChecklistAnswers } from "@evaluator/mfe/lib/evaluator/evaluator-window-data";
import { loadCaseStudyInfoRolesConfig } from "@settings/mfe";
import {
  loadCaseStudyFormDraft,
  loadPartyCaseStudyFormDraft,
} from "./case-study-form-storage";
import { loadInspectorWorkspaceSnapshot } from "./inspector-workspace-storage";
import type { PropertyDetailPartyRoleKey } from "./property-detail-parties";
import {
  loadEngineeringSurveySubmissionSnapshot,
  loadEvaluatorSubmissionSnapshot,
  loadGovernmentReviewSubmissionSnapshot,
  loadValuationCoordinationSubmissionSnapshot,
} from "./property-detail-party-submission-loaders";
import {
  buildCoordinatorSubmission,
  buildFromEngineeringSurvey,
  buildFromEvaluator,
  buildFromFieldInspection,
  buildFromFormDraft,
  buildFromGovernmentReview,
  buildFromValuationCoordination,
  childForRole,
  emptySubmission,
} from "./property-detail-party-submission-builders";
import type { EvaluatorChecklist } from "./property-detail-party-submission-types";
export type {
  PartyAnswerRow,
  PropertyDetailPartySubmission,
} from "./property-detail-party-submission-types";
import type {
  PropertyDetailPartySubmission,
} from "./property-detail-party-submission-types";
import type { WorkflowTask } from "./tasks-storage";

export const PROPERTY_DETAIL_PARTY_ROLE_KEYS = [
  "specialist",
  "inspection",
  "survey",
  "appraisal",
  "government",
  "coordinator",
] as const satisfies readonly PropertyDetailPartyRoleKey[];

export type PropertyDetailPartySubmissionsMap = Record<
  PropertyDetailPartyRoleKey,
  PropertyDetailPartySubmission
>;

/** Load all party-role submissions in parallel (forms + party task submissions via API). */
export async function loadPropertyDetailPartySubmissions(input: {
  parentTask: WorkflowTask | null;
  allTasks: WorkflowTask[];
  coordinatorName?: string;
}): Promise<PropertyDetailPartySubmissionsMap> {
  const entries = await Promise.all(
    PROPERTY_DETAIL_PARTY_ROLE_KEYS.map(async (roleKey) => {
      const submission = await loadPropertyDetailPartySubmission({
        roleKey,
        ...input,
      });
      return [roleKey, submission] as const;
    }),
  );
  return Object.fromEntries(entries) as PropertyDetailPartySubmissionsMap;
}

/** Load submission snapshot for one party role on the property detail page. */
export async function loadPropertyDetailPartySubmission(input: {
  roleKey: PropertyDetailPartyRoleKey;
  parentTask: WorkflowTask | null;
  allTasks: WorkflowTask[];
  coordinatorName?: string;
}): Promise<PropertyDetailPartySubmission> {
  const { roleKey, parentTask, allTasks, coordinatorName = "" } = input;

  if (roleKey === "coordinator") {
    const child = childForRole(parentTask, allTasks, "coordinator");
    if (child) {
      const submission = await loadValuationCoordinationSubmissionSnapshot(child);
      if (submission) {
        return buildFromValuationCoordination(submission, child);
      }
    }
    return buildCoordinatorSubmission(parentTask, allTasks, coordinatorName);
  }

  if (!parentTask) {
    return emptySubmission(roleKey, "لم تُبدأ دراسة الحالة بعد");
  }

  if (roleKey === "specialist") {
    const draft = await loadCaseStudyFormDraft(parentTask.id);
    if (!draft) {
      return emptySubmission(roleKey, "لم يُقدَّم بعد");
    }
    return buildFromFormDraft(roleKey, draft);
  }

  const child = childForRole(parentTask, allTasks, roleKey);
  if (!child) {
    return emptySubmission(roleKey, "لم يُعيَّن بعد");
  }

  if (roleKey === "appraisal") {
    const submission = await loadEvaluatorSubmissionSnapshot(child.id);
    if (!submission) {
      return emptySubmission(roleKey, "لم يُقدَّم بعد");
    }
    const partyDraft = await loadPartyCaseStudyFormDraft(child.id);
    const infoRoles = await loadCaseStudyInfoRolesConfig();
    if (partyDraft) {
      submission.checklist = mergeEvaluatorChecklistFromCaseStudy(
        submission.checklist as EvaluatorChecklistAnswers,
        partyDraft.answers,
        {
          deedRemarks: partyDraft.deedRemarks,
          componentsRemarks: partyDraft.componentsRemarks,
        },
        { overwriteLinked: true },
      ) as EvaluatorChecklist;
    }
    return buildFromEvaluator(
      submission,
      infoRoles.matrix,
      partyDraft?.answers,
    );
  }

  if (roleKey === "survey") {
    const submission = await loadEngineeringSurveySubmissionSnapshot(child.id);
    if (!submission) {
      return emptySubmission(roleKey, "لم يُقدَّم بعد");
    }
    return buildFromEngineeringSurvey(submission, child);
  }

  if (roleKey === "government") {
    const submission = await loadGovernmentReviewSubmissionSnapshot(child);
    if (!submission) {
      return emptySubmission(roleKey, "لم يُقدَّم بعد");
    }
    return buildFromGovernmentReview(submission, child);
  }

  if (roleKey === "inspection") {
    const submission = await loadInspectorWorkspaceSnapshot(child.id);
    if (!submission) {
      return emptySubmission(roleKey, "لم يُقدَّم بعد");
    }
    return buildFromFieldInspection(submission, child);
  }

  const draft = await loadPartyCaseStudyFormDraft(child.id);
  if (!draft) {
    return emptySubmission(roleKey, "لم يُقدَّم بعد");
  }
  return buildFromFormDraft(roleKey, draft, child);
}
