import { mergeEvaluatorChecklistFromCaseStudy } from "../evaluator-bridge";
import { loadCaseStudyInfoRolesConfig } from "@settings/mfe/lib/app-data/case-study-info-roles-reads";
import {
  loadCaseStudyFormDraft,
  loadPartyCaseStudyFormDraft,
} from "./case-study-form-reads";
import { loadInspectorWorkspaceSnapshot } from "./inspector-workspace-reads";
import type { PropertyDetailPartyRoleKey } from "./property-detail-parties";
import {
  loadEngineeringSurveySubmissionSnapshot,
  loadEvaluatorSubmissionSnapshot,
} from "./property-detail-party-submission-loaders";
import {
  buildFromEngineeringSurvey,
  buildFromEvaluator,
  buildFromFieldInspection,
  buildFromFormDraft,
  childForRole,
  emptySubmission,
} from "./property-detail-party-submission-builders";
export type {
  PartyAnswerRow,
  PropertyDetailPartySubmission,
} from "./property-detail-party-submission-types";
import type {
  EvaluatorChecklist,
  PropertyDetailPartySubmission,
} from "./property-detail-party-submission-types";
import type { WorkflowTask } from "./tasks-storage";

export const PROPERTY_DETAIL_PARTY_ROLE_KEYS = [
  "specialist",
  "inspection",
  "survey",
  "appraisal",
] as const satisfies readonly PropertyDetailPartyRoleKey[];

export type PropertyDetailPartySubmissionsMap = Record<
  PropertyDetailPartyRoleKey,
  PropertyDetailPartySubmission
>;

/** Load all party-role submissions in parallel (forms + party task submissions via API). */
export async function loadPropertyDetailPartySubmissions(input: {
  parentTask: WorkflowTask | null;
  allTasks: WorkflowTask[];
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
}): Promise<PropertyDetailPartySubmission> {
  const { roleKey, parentTask, allTasks } = input;

  if (!parentTask) {
    return emptySubmission(roleKey, "لم تُبدأ دراسة الحالة بعد");
  }

  if (roleKey === "specialist") {
    const draft = await loadCaseStudyFormDraft(parentTask.id);
    if (!draft?.savedAtUtc) {
      return emptySubmission(roleKey, "لم يُقدَّم بعد");
    }
    return buildFromFormDraft(roleKey, draft);
  }

  const child = childForRole(parentTask, allTasks, roleKey);
  if (!child) {
    return emptySubmission(roleKey, "لم يُعيَّن بعد");
  }

  if (roleKey === "appraisal") {
    // The three are independent — parallelize instead of three sequential round-trips (async-parallel).
    const [submission, partyDraft, infoRoles] = await Promise.all([
      loadEvaluatorSubmissionSnapshot(child.id),
      loadPartyCaseStudyFormDraft(child.id),
      loadCaseStudyInfoRolesConfig(),
    ]);
    if (!submission) {
      return emptySubmission(roleKey, "لم يُقدَّم بعد");
    }
    if (partyDraft?.savedAtUtc) {
      submission.checklist = mergeEvaluatorChecklistFromCaseStudy(
        submission.checklist,
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

  if (roleKey === "inspection") {
    const submission = await loadInspectorWorkspaceSnapshot(child.id);
    if (!submission) {
      return emptySubmission(roleKey, "لم يُقدَّم بعد");
    }
    return buildFromFieldInspection(submission, child);
  }

  const _exhaustive: never = roleKey;
  return emptySubmission(_exhaustive, "لم يُقدَّم بعد");
}
