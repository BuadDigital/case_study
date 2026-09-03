import type { CaseStudyFormAnswer } from "./case-study-form-data";
import {
  CASE_STUDY_INFO_PARTIES,
  CASE_STUDY_INFO_ROLE_TYPES,
  partyIdForRoleId,
  type CaseStudyInfoPartyId,
  type CaseStudyInfoRoleType,
} from "@settings/mfe/lib/app-data/case-study-info-roles-data";
import {
  partyRoleOnQuestion,
  type CaseStudyInfoRolesMatrix,
} from "@settings/mfe/lib/app-data/case-study-info-roles-model";
import { resolveAssigneeDisplayName } from "@platform/app-shared/fees/party-fee-meta";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import { loadPartyCaseStudyFormDraft } from "./case-study-form-reads";
import type { WorkflowTask, WorkflowTaskKind } from "./tasks-storage";

export type PartyQuestionContribution = {
  partyId: CaseStudyInfoPartyId | null;
  partyName: string;
  partyColor: string;
  assigneeName: string;
  roleType: CaseStudyInfoRoleType | null;
  roleLabel: string | null;
  answer: CaseStudyFormAnswer;
  taskId: string;
  taskKind: WorkflowTaskKind;
  answeredByUserId?: string | null;
  answeredByName?: string | null;
  answeredAtUtc?: string | null;
  sourceRole?: string | null;
  formId?: string | null;
};

const KIND_PARTY_LABEL: Partial<
  Record<WorkflowTaskKind, { partyId: CaseStudyInfoPartyId | null; name: string; color: string }>
> = {
  "field-inspection": { partyId: "insp", name: "المعاين العقاري", color: "#102b4e" },
  "property-appraisal": { partyId: "val", name: "المقيم العقاري", color: "#DC2626" },
  "engineering-survey": { partyId: "eng", name: "المكتب الهندسي", color: "#D97706" },
};

function roleLabel(role: CaseStudyInfoRoleType | null | undefined): string | null {
  if (!role || role === "none") return null;
  return CASE_STUDY_INFO_ROLE_TYPES.find((r) => r.id === role)?.label ?? null;
}

export function childTasksForCaseStudyParent(
  parentTaskId: string,
  tasks: WorkflowTask[],
): WorkflowTask[] {
  const byParentLink = tasks.filter(
    (t) => t.parentTaskId === parentTaskId && t.kind !== "case-study-property",
  );
  if (byParentLink.length > 0) return byParentLink;

  const parent = tasks.find((t) => t.id === parentTaskId);
  if (!parent?.poNumber || !parent.propertyId) return byParentLink;

  return tasks.filter(
    (t) =>
      t.id !== parentTaskId &&
      t.kind !== "case-study-property" &&
      t.poNumber === parent.poNumber &&
      t.propertyId === parent.propertyId,
  );
}

/** Answers from assigned parties — for display in the specialist form */
export async function collectPartyAnswersByQuestion(
  parentTaskId: string,
  matrix: CaseStudyInfoRolesMatrix,
  tasks: WorkflowTask[],
  staffUsers: StaffUser[] = [],
): Promise<Record<string, PartyQuestionContribution[]>> {
  const byKey: Record<string, PartyQuestionContribution[]> = {};
  const children = childTasksForCaseStudyParent(parentTaskId, tasks);

  const drafts = await Promise.all(
    children.map((child) =>
      KIND_PARTY_LABEL[child.kind]
        ? loadPartyCaseStudyFormDraft(child.id)
        : null,
    ),
  );

  for (const [index, child] of children.entries()) {
    const meta = KIND_PARTY_LABEL[child.kind];
    if (!meta) continue;

    const draft = drafts[index];
    if (!draft) continue;

    const partyFromRole = child.assigneeRole
      ? partyIdForRoleId(child.assigneeRole)
      : null;
    const partyId = meta.partyId ?? partyFromRole;

    for (const [key, answer] of Object.entries(draft.answers)) {
      if (answer !== "A" && answer !== "B") continue;

      const partyDef = partyId
        ? CASE_STUDY_INFO_PARTIES.find((p) => p.id === partyId)
        : null;
      const roleType = partyId
        ? partyRoleOnQuestion(matrix, key, partyId)
        : null;

      const provenance = draft.answerProvenance?.[key];
      const entry: PartyQuestionContribution = {
        partyId,
        partyName: partyDef?.name ?? meta.name,
        partyColor: partyDef?.color ?? meta.color,
        assigneeName: resolveAssigneeDisplayName({
          assigneeName:
            provenance?.answeredByName?.trim() || child.assigneeName,
          assigneeId: child.assigneeId,
          staffUsers,
          fallback: meta.name,
        }),
        roleType: roleType ?? null,
        roleLabel: roleLabel(roleType),
        answer,
        taskId: child.id,
        taskKind: child.kind,
        answeredByUserId: provenance?.answeredByUserId,
        answeredByName: provenance?.answeredByName,
        answeredAtUtc: provenance?.answeredAtUtc,
        sourceRole: provenance?.sourceRole,
        formId: provenance?.formId,
      };

      if (!byKey[key]) byKey[key] = [];
      byKey[key].push(entry);
    }
  }

  return byKey;
}
