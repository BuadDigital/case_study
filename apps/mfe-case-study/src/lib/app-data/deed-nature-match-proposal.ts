import { DeedNatureMatchOutcomes } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import {
  effectiveDeedVerdict,
  isInspectorWorkspaceAccepted,
  type InspectorBoundaryKey,
  type InspectorWorkspaceDraft,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import {
  propertyRecordsFacadeType,
  type PoPropertyIntake,
} from "@platform/app-shared/app-data/po-intake-property-model";
import { ChecklistAnswers } from "@platform/app-shared/engineering-survey/checklist-answers";
import { SubmissionStatuses } from "@platform/app-shared/workflow/task-types";
import type { EngineeringSurveySubmissionSnapshot } from "./property-detail-party-submission-types";

export type DeedNatureMatchProposal = {
  /** Only the field inspector proposes; the prior survey / engineering office are info lines. */
  source: "inspector";
  suggested:
    | typeof DeedNatureMatchOutcomes.Matched
    | typeof DeedNatureMatchOutcomes.Differences
    | "";
  /** True while the inspector has not submitted yet. */
  waiting: boolean;
  sourceLabelAr: string;
  /** The inspector's per-side mismatch notes joined — copied to the notes when «differences» is adopted. */
  inspectorMismatchNotes: string;
  /** Context shown to the specialist — never a proposal. */
  infoLinesAr: string[];
  /**
   * The engineering office's submitted verdict is «الصك غير مطابق للطبيعة» — «مطابق» then needs the
   * specialist's reason, as against the inspector (A→Z 2026-11-02 #20). Never a proposal.
   */
  engineeringSaidNotMatched: boolean;
};

const SIDE_LABELS: Record<InspectorBoundaryKey, string> = {
  north: "الحد الشمالي",
  south: "الحد الجنوبي",
  east: "الحد الشرقي",
  west: "الحد الغربي",
};
const SIDE_ORDER: InspectorBoundaryKey[] = ["north", "south", "east", "west"];

type InspectorBoundaryRows = Partial<
  Record<InspectorBoundaryKey, { matches: boolean | null; mismatchNote: string }>
>;

export function inspectorBoundariesIndicateMismatch(
  matches: Iterable<{ matches: boolean | null }> | null | undefined,
): boolean {
  if (!matches) return false;
  for (const row of matches) {
    if (row.matches === false) return true;
  }
  return false;
}

/** One side of the deed as the specialist compares it: what the deed says, and what the inspector found. */
export type DeedMatchSideRow = {
  side: InspectorBoundaryKey;
  label: string;
  /** The boundary as written in the deed («—» when unknown). */
  deedDesc: string;
  /** The deed's length for this side, «12 م» or «—». */
  deedLength: string;
  /** The side's facade type as the inspector recorded it, else the property's; "" when none. */
  facade: string;
  /** The inspector's finding on site: true مطابق، false غير مطابق، null not answered. */
  matches: boolean | null;
  /** The inspector's note on a non-matching side. */
  note: string;
};

type DeedSideField =
  | "northBoundary" | "northBoundaryLengthM"
  | "southBoundary" | "southBoundaryLengthM"
  | "eastBoundary" | "eastBoundaryLengthM"
  | "westBoundary" | "westBoundaryLengthM";

type DeedSideFacadeField =
  | "northFacadeFinishing" | "southFacadeFinishing" | "eastFacadeFinishing" | "westFacadeFinishing";

const PROPERTY_SIDE_FIELDS: Record<
  InspectorBoundaryKey,
  { desc: DeedSideField; len: DeedSideField; facade: DeedSideFacadeField }
> = {
  north: { desc: "northBoundary", len: "northBoundaryLengthM", facade: "northFacadeFinishing" },
  south: { desc: "southBoundary", len: "southBoundaryLengthM", facade: "southFacadeFinishing" },
  east: { desc: "eastBoundary", len: "eastBoundaryLengthM", facade: "eastFacadeFinishing" },
  west: { desc: "westBoundary", len: "westBoundaryLengthM", facade: "westFacadeFinishing" },
};

/**
 * The four sides for the «مطابقة الصك على الطبيعة» card (Omar 2026-11-10: «how do they know?» — the
 * specialist sees on the card what each side of the deed says and what the inspector found there).
 *
 * How it works: the deed side is the inspector's own transcription when he wrote one, else the
 * property's (the same rule as the inspector's table, `resolvedBoundaryDeedField`); the finding and
 * note are the inspector's per-side answers.
 * Edge cases: no inspection yet → an empty list (the card shows no table); a side with nothing in the
 * deed and no answer still shows, with «—», so a missing side is visible. The facade (Omar
 * 2026-11-12: one table instead of this one and «الحدود والأطوال» below it) follows the same
 * rule; a property record without facades gives "".
 */
export function deedMatchSideRows(
  inspector: Pick<InspectorWorkspaceDraft, "boundaryMatches"> | null | undefined,
  property: Pick<PoPropertyIntake, DeedSideField> & Partial<Pick<PoPropertyIntake, DeedSideFacadeField>>,
): DeedMatchSideRow[] {
  if (!inspector) return [];
  return SIDE_ORDER.map((side) => {
    const row = inspector.boundaryMatches?.[side];
    const fields = PROPERTY_SIDE_FIELDS[side];
    const desc = row?.deedDesc?.trim() || (property[fields.desc] ?? "").trim();
    const length = row?.deedLength?.trim() || (property[fields.len] ?? "").trim();
    return {
      side,
      label: SIDE_LABELS[side],
      deedDesc: desc || "—",
      deedLength: length ? `${length} م` : "—",
      facade: row?.facade?.trim() || (property[fields.facade] ?? "").trim(),
      matches: row?.matches ?? null,
      note: row?.matches === false ? (row.mismatchNote ?? "").trim() : "",
    };
  });
}

/** «الحد الشمالي: …» per non-matching side with a note, one per line. */
export function inspectorMismatchNotesText(
  boundaryMatches: InspectorBoundaryRows | null | undefined,
): string {
  if (!boundaryMatches) return "";
  const lines: string[] = [];
  for (const key of SIDE_ORDER) {
    const row = boundaryMatches[key];
    const note = row?.mismatchNote?.trim();
    if (row?.matches === false && note) lines.push(`${SIDE_LABELS[key]}: ${note}`);
  }
  return lines.join("\n");
}

/**
 * The first deed↔nature proposal. ONLY the field inspector proposes: their explicit
 * `deedMatchesNature` wins; a legacy submitted payload without the key is derived from the
 * sides (any explicit non-match → differences; all four explicitly matching → matched);
 * anything else is «unknown» — never defaulted to matched. A prior survey of the same deed and
 * the engineering office's verdict are shown as `infoLinesAr`, never suggested.
 */
export function proposeDeedNatureMatch(input: {
  inspector: Pick<InspectorWorkspaceDraft, "deedMatchesNature" | "boundaryMatches"> | null;
  inspectorSubmitted: boolean;
  hasPriorSurvey: boolean;
  engineeringAssigned: boolean;
  engineeringDeedMatchesNature: "yes" | "no" | null;
}): DeedNatureMatchProposal {
  const infoLinesAr: string[] = [];
  const engineeringSaidNotMatched =
    input.engineeringAssigned && input.engineeringDeedMatchesNature === ChecklistAnswers.No;
  if (input.hasPriorSurvey) {
    infoLinesAr.push("رفع مساحي سابق لنفس الصك — للعلم فقط، وليس مطابقة لهذه المعاملة.");
  }
  // The office's verdict counts once its survey is sent (or accepted) — the line says so (Omar 2026-11-19:
  // «has he sent a result?»); its form cannot be sent without the verdict, so no verdict means not sent.
  if (input.engineeringAssigned) {
    infoLinesAr.push(
      input.engineeringDeedMatchesNature === ChecklistAnswers.Yes
        ? "المكتب الهندسي (رفع مساحي مُرسل): الصك مطابق للطبيعة."
        : input.engineeringDeedMatchesNature === ChecklistAnswers.No
          ? "المكتب الهندسي (رفع مساحي مُرسل): الصك غير مطابق للطبيعة."
          : "المكتب الهندسي: لم يُرسل رفعه المساحي بعد.",
    );
  }

  if (!input.inspectorSubmitted || !input.inspector) {
    return {
      source: "inspector",
      suggested: "",
      waiting: true,
      sourceLabelAr: "المطابقة مسؤولية المعاين — بانتظار رفعه.",
      inspectorMismatchNotes: "",
      infoLinesAr,
      engineeringSaidNotMatched,
    };
  }

  const verdict = effectiveDeedVerdict(input.inspector);
  const notes = inspectorMismatchNotesText(input.inspector.boundaryMatches);
  if (verdict === "no") {
    return {
      source: "inspector",
      suggested: DeedNatureMatchOutcomes.Differences,
      waiting: false,
      sourceLabelAr: "المعاين: حدود الصك غير مطابقة للطبيعة.",
      inspectorMismatchNotes: notes,
      infoLinesAr,
      engineeringSaidNotMatched,
    };
  }
  if (verdict === "yes") {
    return {
      source: "inspector",
      suggested: DeedNatureMatchOutcomes.Matched,
      waiting: false,
      sourceLabelAr: "المعاين: حدود الصك مطابقة للطبيعة.",
      inspectorMismatchNotes: "",
      infoLinesAr,
      engineeringSaidNotMatched,
    };
  }
  return {
    source: "inspector",
    suggested: "",
    waiting: false,
    sourceLabelAr: "لم يحدد المعاين صراحةً",
    inspectorMismatchNotes: "",
    infoLinesAr,
    engineeringSaidNotMatched,
  };
}

/**
 * What the deed↔nature section shows from its loaded sources: the inspector's side-by-side rows and
 * the proposal.
 *
 * How it works: the inspector counts once the inspection is submitted or accepted; the engineering
 * office's verdict once its survey is submitted or accepted.
 * Edge cases: land in any form and an apartment have no «نوع الواجهة» — the column stays off
 * (Omar 2026-11-16).
 */
export function deedMatchSourceView(input: {
  property: PoPropertyIntake;
  inspector: InspectorWorkspaceDraft | null;
  survey: Pick<EngineeringSurveySubmissionSnapshot, "status" | "acceptedAtUtc" | "deedMatchesNature"> | null;
  hasPriorSurvey: boolean;
  engineeringAssigned: boolean;
}): {
  sides: DeedMatchSideRow[];
  proposal: DeedNatureMatchProposal;
  /** The office's survey is sent (or accepted) — what it sent can be shown. */
  officeSent: boolean;
} {
  const { property, inspector, survey } = input;
  const inspectorSubmitted =
    inspector?.status === SubmissionStatuses.Submitted || isInspectorWorkspaceAccepted(inspector);
  const sideRows = inspectorSubmitted ? deedMatchSideRows(inspector, property) : [];
  const engineeringSubmitted =
    survey?.status === SubmissionStatuses.Submitted || Boolean(survey?.acceptedAtUtc?.trim());
  return {
    sides: propertyRecordsFacadeType(property, inspector)
      ? sideRows
      : sideRows.map((side) => ({ ...side, facade: "" })),
    proposal: proposeDeedNatureMatch({
      inspector,
      inspectorSubmitted,
      hasPriorSurvey: input.hasPriorSurvey,
      engineeringAssigned: input.engineeringAssigned,
      engineeringDeedMatchesNature: engineeringSubmitted ? (survey?.deedMatchesNature ?? null) : null,
    }),
    officeSent: engineeringSubmitted,
  };
}
