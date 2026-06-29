import {
  CASE_STUDY_INFO_PARTIES,
  partyIdForRoleId,
  type CaseStudyInfoPartyId,
} from "@settings/mfe/lib/prototype/case-study-info-roles-data";
import {
  isPartyQuestionVisible,
  type CaseStudyInfoRolesMatrix,
} from "@settings/mfe/lib/prototype/case-study-info-roles-storage";
import { DEFAULT_CASE_STUDY_QUESTION_CATALOG } from "./case-study-question-catalog";
import {
  type CaseStudyFormAnswer,
  type CaseStudyQuestionSection,
} from "./case-study-form-data";
import { childTasksForCaseStudyParent } from "./case-study-party-answers";
import {
  loadCaseStudyFormDraft,
  loadPartyCaseStudyFormDraft,
} from "./case-study-form-storage";
import type { WorkflowTask, WorkflowTaskKind } from "./tasks-storage";

const FORM_SECTIONS: CaseStudyQuestionSection[] = [
  "deed",
  "survey",
  "comp",
  "occ",
  "extra",
];

const CHILD_KIND_PARTY: Partial<
  Record<WorkflowTaskKind, CaseStudyInfoPartyId>
> = {
  "field-inspection": "insp",
  "government-review": "gov",
  "property-appraisal": "val",
  "engineering-survey": "eng",
};

export type PartyCaseStudyProgress = {
  partyId: CaseStudyInfoPartyId;
  name: string;
  color: string;
  total: number;
  answered: number;
  pct: number;
};

/** RTL row: first → right (أخصائي), last → left (المكتب الهندسي). */
export const PARTY_PROGRESS_DISPLAY_ORDER: CaseStudyInfoPartyId[] = [
  "specA",
  "insp",
  "gov",
  "val",
  "eng",
  "sup",
];

export function sortPartyCaseStudyProgress(
  rows: PartyCaseStudyProgress[],
): PartyCaseStudyProgress[] {
  const order = new Map(
    PARTY_PROGRESS_DISPLAY_ORDER.map((id, index) => [id, index]),
  );
  return [...rows].sort(
    (a, b) => (order.get(a.partyId) ?? 99) - (order.get(b.partyId) ?? 99),
  );
}

function allQuestionKeys(): string[] {
  const keys: string[] = [];
  for (const section of FORM_SECTIONS) {
    for (const key of DEFAULT_CASE_STUDY_QUESTION_CATALOG.sectionKeys[section]) {
      keys.push(key);
    }
  }
  return keys;
}

function partyIdForChildTask(child: WorkflowTask): CaseStudyInfoPartyId | null {
  if (child.assigneeRole) {
    const fromRole = partyIdForRoleId(child.assigneeRole);
    if (fromRole) return fromRole;
  }
  return CHILD_KIND_PARTY[child.kind] ?? null;
}

export function computePartyCaseStudyProgress(
  matrix: CaseStudyInfoRolesMatrix,
  answersByParty: Partial<
    Record<
      CaseStudyInfoPartyId,
      Record<string, CaseStudyFormAnswer | null | undefined>
    >
  >,
): PartyCaseStudyProgress[] {
  const keys = allQuestionKeys();
  const specialistAnswers = answersByParty.specA ?? {};

  const rows = CASE_STUDY_INFO_PARTIES.map((party) => {
    const visibleKeys = keys.filter((key) =>
      isPartyQuestionVisible(matrix, key, party.id),
    );
    const partyAnswers = answersByParty[party.id] ?? {};
    const answered = visibleKeys.filter((key) => {
      const value = partyAnswers[key];
      if (value === "A" || value === "B") return true;
      if (party.id === "specA") return false;
      const official = specialistAnswers[key];
      return official === "A" || official === "B";
    }).length;
    const total = visibleKeys.length;
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

    return {
      partyId: party.id,
      name: party.name,
      color: party.color,
      total,
      answered,
      pct,
    };
  }).filter((row) => row.total > 0);

  return sortPartyCaseStudyProgress(rows);
}

export async function loadPartyCaseStudyAnswersByParty(
  parentTask: WorkflowTask,
  tasks: WorkflowTask[],
): Promise<
  Partial<
    Record<
      CaseStudyInfoPartyId,
      Record<string, CaseStudyFormAnswer | null | undefined>
    >
  >
> {
  const byParty: Partial<
    Record<
      CaseStudyInfoPartyId,
      Record<string, CaseStudyFormAnswer | null | undefined>
    >
  > = {};

  const parentDraft = await loadCaseStudyFormDraft(parentTask.id);
  byParty.specA = parentDraft?.answers ?? {};

  for (const child of childTasksForCaseStudyParent(parentTask.id, tasks)) {
    const partyId = partyIdForChildTask(child);
    if (!partyId || partyId === "specA") continue;

    const draft = await loadPartyCaseStudyFormDraft(child.id);
    if (!draft) continue;

    byParty[partyId] = {
      ...(byParty[partyId] ?? {}),
      ...draft.answers,
    };
  }

  return byParty;
}
