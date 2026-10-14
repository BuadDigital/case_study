import { DeedNatureMatchOutcomes } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import {
  effectiveDeedVerdict,
  type InspectorBoundaryKey,
  type InspectorWorkspaceDraft,
} from "@platform/app-shared/app-data/inspector-workspace-data";

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
    };
  }
  return {
    source: "inspector",
    suggested: "",
    waiting: false,
    sourceLabelAr: "لم يحدد المعاين صراحةً",
    inspectorMismatchNotes: "",
    infoLinesAr,
  };
}
