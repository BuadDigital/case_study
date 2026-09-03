/**
 * Copy deed boundary fields into nature fields when الصك غير مطابق للطبيعة.
 * Manual entry only — no PDF length extraction.
 */

export type NatureBoundaryPatch = {
  natureNorthBoundary?: string;
  natureNorthBoundaryLengthM?: string;
  natureSouthBoundary?: string;
  natureSouthBoundaryLengthM?: string;
  natureEastBoundary?: string;
  natureEastBoundaryLengthM?: string;
  natureWestBoundary?: string;
  natureWestBoundaryLengthM?: string;
};

function cleanLength(raw: string): string {
  const t = raw.trim().replace(/,/g, "");
  if (!t) return "";
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(n);
}

/** Mirror form deed boundary text+lengths into nature fields. */
export function natureFieldsFromDeedForm(fields: {
  northBoundary?: string;
  northBoundaryLengthM?: string;
  southBoundary?: string;
  southBoundaryLengthM?: string;
  eastBoundary?: string;
  eastBoundaryLengthM?: string;
  westBoundary?: string;
  westBoundaryLengthM?: string;
}): NatureBoundaryPatch {
  const take = (v?: string) => (v?.trim() ? v.trim() : undefined);
  return {
    natureNorthBoundary: take(fields.northBoundary),
    natureNorthBoundaryLengthM:
      cleanLength(fields.northBoundaryLengthM ?? "") || undefined,
    natureSouthBoundary: take(fields.southBoundary),
    natureSouthBoundaryLengthM:
      cleanLength(fields.southBoundaryLengthM ?? "") || undefined,
    natureEastBoundary: take(fields.eastBoundary),
    natureEastBoundaryLengthM:
      cleanLength(fields.eastBoundaryLengthM ?? "") || undefined,
    natureWestBoundary: take(fields.westBoundary),
    natureWestBoundaryLengthM:
      cleanLength(fields.westBoundaryLengthM ?? "") || undefined,
  };
}

/** Apply nature patch into form — empty slots unless overwrite. */
export function applyNatureBoundaryPatch(
  naturePatch: NatureBoundaryPatch,
  current: NatureBoundaryPatch,
  overwrite = false,
): { patch: NatureBoundaryPatch; appliedCount: number } {
  const keys: Array<keyof NatureBoundaryPatch> = [
    "natureNorthBoundary",
    "natureNorthBoundaryLengthM",
    "natureSouthBoundary",
    "natureSouthBoundaryLengthM",
    "natureEastBoundary",
    "natureEastBoundaryLengthM",
    "natureWestBoundary",
    "natureWestBoundaryLengthM",
  ];
  const patch: NatureBoundaryPatch = {};
  let appliedCount = 0;
  for (const key of keys) {
    const next = naturePatch[key];
    if (typeof next !== "string" || !next.trim()) continue;
    const curr = current[key] ?? "";
    if (!overwrite && curr.trim()) continue;
    patch[key] = next.trim();
    appliedCount += 1;
  }
  return { patch, appliedCount };
}
