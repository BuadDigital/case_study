import { isNoExternalSpecialistAssumption } from "@platform/api-client";

/** UI label for the exclusive pair — not a printable library clause. */
export const EXTERNAL_SPECIALIST_USED_LABEL = "استُعين بأخصائي خارجي";

export const DEFAULT_NO_EXTERNAL_SPECIALIST_ASSUMPTION =
  "لم يستعن المقيّم بأي أخصائي أو مؤسسة خدمات أثناء تنفيذ مهمة التقييم، وجميع الإجراءات والتحليلات اللازمة نُفّذت بواسطة فريق العمل بإدارة التقييم.";

export type SpecialAssumptionRow =
  | { kind: "specialist-used"; key: "specialist-used" }
  | { kind: "clause"; key: string; text: string };

export function resolveNoSpecialistClause(
  library: readonly string[],
): string {
  return (
    library.find(isNoExternalSpecialistAssumption) ??
    DEFAULT_NO_EXTERNAL_SPECIALIST_ASSUMPTION
  );
}

/**
 * Library + extras, with «استُعين بأخصائي خارجي» inserted immediately above
 * the no-specialist clause so the pair can be chosen exclusively in one list.
 */
export function specialAssumptionRows(
  library: readonly string[],
  extras: readonly string[] = [],
): SpecialAssumptionRow[] {
  const clauses: string[] = [];
  const seen = new Set<string>();
  const push = (text: string) => {
    const t = text.trim();
    if (!t || seen.has(t) || t === EXTERNAL_SPECIALIST_USED_LABEL) return;
    seen.add(t);
    clauses.push(t);
  };
  for (const item of library) push(item);
  for (const item of extras) push(item);
  if (!clauses.some(isNoExternalSpecialistAssumption)) {
    clauses.push(DEFAULT_NO_EXTERNAL_SPECIALIST_ASSUMPTION);
  }
  const noSpecialistAt = clauses.findIndex(isNoExternalSpecialistAssumption);
  const rows: SpecialAssumptionRow[] = [];
  clauses.forEach((text, index) => {
    if (index === noSpecialistAt) {
      rows.push({ kind: "specialist-used", key: "specialist-used" });
    }
    rows.push({ kind: "clause", key: text, text });
  });
  return rows;
}

/** Selecting one of the specialist pair never leaves both in `assumptions`. */
export function assumptionsAfterSpecialistChoice(input: {
  specialistUsed: boolean;
  assumptions: readonly string[];
  noSpecialistClause: string;
}): string[] {
  const stripped = input.assumptions.filter(
    (item) =>
      !isNoExternalSpecialistAssumption(item) &&
      item !== EXTERNAL_SPECIALIST_USED_LABEL,
  );
  if (input.specialistUsed) return stripped;
  return stripped.includes(input.noSpecialistClause)
    ? stripped
    : [...stripped, input.noSpecialistClause];
}

/**
 * True when there is no real saved selection yet — empty, or only the
 * auto-injected «لم يستعن…» clause from an older approach-settings save.
 */
export function shouldUseDefaultSpecialAssumptions(
  selected: readonly string[],
): boolean {
  if (selected.length === 0) return true;
  return selected.every(isNoExternalSpecialistAssumption);
}

/** All library clauses on by default (respecting the specialist exclusive pair). */
export function defaultSelectedSpecialAssumptions(
  library: readonly string[],
  specialistUsed: boolean,
): string[] {
  const noSpecialistClause = resolveNoSpecialistClause(library);
  const base = library.length > 0 ? [...library] : [noSpecialistClause];
  return assumptionsAfterSpecialistChoice({
    specialistUsed,
    assumptions: base,
    noSpecialistClause,
  });
}
