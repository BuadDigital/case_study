import { DeedNatureMatchOutcomes } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import {
  effectiveDeedVerdict,
  type InspectorBoundaryKey,
  type InspectorWorkspaceDraft,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import type { PoPropertyIntake } from "@platform/app-shared/app-data/po-intake-property-model";

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

const PROPERTY_SIDE_FIELDS: Record<InspectorBoundaryKey, { desc: DeedSideField; len: DeedSideField }> = {
  north: { desc: "northBoundary", len: "northBoundaryLengthM" },
  south: { desc: "southBoundary", len: "southBoundaryLengthM" },
  east: { desc: "eastBoundary", len: "eastBoundaryLengthM" },
  west: { desc: "westBoundary", len: "westBoundaryLengthM" },
};

/**
 * The four sides for the «مطابقة الصك على الطبيعة» card (Omar 2026-11-10: «how do they know?» — the
 * specialist sees on the card what each side of the deed says and what the inspector found there).
 *
 * How it works: the deed side is the inspector's own transcription when he wrote one, else the
 * property's (the same rule as the inspector's table, `resolvedBoundaryDeedField`); the finding and
 * note are the inspector's per-side answers.
 * Edge cases: no inspection yet → an empty list (the card shows no table); a side with nothing in the
 * deed and no answer still shows, with «—», so a missing side is visible.
 */
export function deedMatchSideRows(
  inspector: Pick<InspectorWorkspaceDraft, "boundaryMatches"> | null | undefined,
  property: Pick<PoPropertyIntake, DeedSideField>,
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
    input.engineeringAssigned && input.engineeringDeedMatchesNature === "no";
  if (input.hasPriorSurvey) {
    infoLinesAr.push("رفع مساحي سابق لنفس الصك — للعلم فقط، وليس مطابقة لهذه المعاملة.");
  }
  if (input.engineeringAssigned) {
    infoLinesAr.push(
      input.engineeringDeedMatchesNature === "yes"
        ? "المكتب الهندسي: الصك مطابق للطبيعة."
        : input.engineeringDeedMatchesNature === "no"
          ? "المكتب الهندسي: الصك غير مطابق للطبيعة."
          : "المكتب الهندسي: لم يُبدِ حكمه بعد.",
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
