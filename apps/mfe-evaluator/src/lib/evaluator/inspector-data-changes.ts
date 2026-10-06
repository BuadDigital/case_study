/**
 * The appraiser works on a DRAFT of the inspector's package, so the inspector's data can change
 * under him. The server fingerprints the inspector's data by group and compares it with the
 * baseline the appraiser last acknowledged (`inspectorDataSeen`, stored in his own draft payload).
 * This module is the pure client side of that: what the banner shows and what an acknowledgement
 * writes. Nothing here acknowledges anything on its own.
 */

/** Group keys the server sends in `inspectorDataChangedGroups`. */
export type InspectorDataGroup =
  | "assetType"
  | "components"
  | "area"
  | "age"
  | "boundaries"
  | "location"
  | "photos"
  | "narrative"
  | "services";

export const INSPECTOR_DATA_GROUP_LABELS: Record<InspectorDataGroup, string> = {
  assetType: "نوع الأصل",
  components: "المكونات",
  area: "المساحات",
  age: "العمر",
  boundaries: "الحدود",
  location: "الموقع",
  photos: "الصور",
  narrative: "الوصف والملاحظات",
  services: "الخدمات",
};

/** Arabic label of one group key (an unknown key from a newer server is shown as sent). */
export function inspectorDataGroupLabel(key: string): string {
  return (INSPECTOR_DATA_GROUP_LABELS as Record<string, string>)[key] ?? key;
}

/** Arabic labels of the changed groups, de-duplicated, in the server's order. */
export function inspectorDataChangedLabels(
  groups: readonly string[] | null | undefined,
): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const raw of groups ?? []) {
    const key = raw?.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    labels.push(inspectorDataGroupLabel(key));
  }
  return labels;
}

export type InspectorChangedBannerState =
  | { kind: "none" }
  /** First open: no baseline yet — store the current fingerprint silently, show nothing. */
  | { kind: "baseline"; fingerprint: string }
  /** The inspector's data changed since the appraiser last acknowledged it. */
  | { kind: "changed"; fingerprint: string; groups: string[]; labels: string[] };

/**
 * What to show for the appraiser's draft.
 * - locked (submitted) drafts and an unknown fingerprint show nothing;
 * - no `inspectorDataSeen` yet means first open: set the baseline silently;
 * - otherwise a non-empty changed-groups list shows the banner.
 */
export function inspectorChangedBannerState(input: {
  fingerprint?: string | null;
  seen?: string | null;
  changedGroups?: readonly string[] | null;
  locked?: boolean;
}): InspectorChangedBannerState {
  if (input.locked) return { kind: "none" };
  const fingerprint = input.fingerprint?.trim();
  if (!fingerprint) return { kind: "none" };
  if (!input.seen?.trim()) return { kind: "baseline", fingerprint };
  const labels = inspectorDataChangedLabels(input.changedGroups);
  if (labels.length === 0) return { kind: "none" };
  const groups = [...new Set((input.changedGroups ?? []).map((g) => g.trim()).filter(Boolean))];
  return { kind: "changed", fingerprint, groups, labels };
}

/** The banner sentence (without the button). */
export function inspectorChangedMessage(labels: readonly string[]): string {
  return `تغيّرت بيانات المعاين منذ اطلاعك: ${labels.join("، ")}`;
}

/** True when the age group changed and the inspector's age differs from the one the appraiser entered. */
export function inspectorAgeNeedsApply(input: {
  changedGroups?: readonly string[] | null;
  inspectorAgeYears?: string | null;
  enteredAgeYears?: string | null;
}): boolean {
  if (!input.changedGroups?.includes("age")) return false;
  const inspector = parseYears(input.inspectorAgeYears);
  if (inspector == null) return false;
  const entered = parseYears(input.enteredAgeYears);
  return entered == null || entered !== inspector;
}

function parseYears(value: string | null | undefined): number | null {
  const text = (value ?? "").replace(/,/g, "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/* ─── Which inspector data is on screen (label + last sync) ─── */

export const INSPECTOR_DRAFT_DATA_LABEL = "بيانات المعاين (مسودة)";

/**
 * The inspector's package is stable once the inspector submitted it (`submitted`) or the
 * specialist accepted it; anything earlier is still his working draft.
 */
export function isInspectorDataFinal(input: {
  status?: string | null;
  acceptedAtUtc?: string | null;
}): boolean {
  if (input.acceptedAtUtc?.trim()) return true;
  return input.status === "submitted" || input.status === "accepted";
}

export type InspectorDataSyncInfo = {
  /** «بيانات المعاين (مسودة)» while the package is not submitted/accepted, else null. */
  draftLabel: string | null;
  /** «آخر مزامنة للمعاين: …», or null when the server gave no timestamp. */
  syncedLabel: string | null;
};

const SYNC_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
};

export function describeInspectorDataSync(
  workspace:
    | {
        status?: string | null;
        acceptedAtUtc?: string | null;
        updatedAtUtc?: string | null;
      }
    | null
    | undefined,
): InspectorDataSyncInfo {
  if (!workspace) return { draftLabel: null, syncedLabel: null };
  const ts = Date.parse(workspace.updatedAtUtc ?? "");
  return {
    draftLabel: isInspectorDataFinal(workspace) ? null : INSPECTOR_DRAFT_DATA_LABEL,
    syncedLabel: Number.isFinite(ts)
      ? `آخر مزامنة للمعاين: ${new Date(ts).toLocaleString("ar-SA-u-ca-gregory-nu-latn", SYNC_DATE_FORMAT)}`
      : null,
  };
}

/* ─── Merging a fresh read into the open draft ─── */

export type InspectorDataMeta = {
  inspectorDataSeen?: string;
  inspectorDataFingerprint?: string;
  inspectorDataChangedGroups?: string[];
};

/**
 * Takes ONLY the inspector-data fields from a fresh read of the appraiser's submission and puts
 * them on the open draft — whatever else the appraiser typed meanwhile stays untouched. A baseline
 * equal to the current fingerprint means nothing changed, whatever the stale group list says.
 */
export function mergeInspectorDataMeta<T extends InspectorDataMeta>(
  current: T,
  fresh: InspectorDataMeta,
): T {
  const seen = fresh.inspectorDataSeen ?? current.inspectorDataSeen;
  const fingerprint = fresh.inspectorDataFingerprint ?? current.inspectorDataFingerprint;
  const groups =
    seen && fingerprint && seen === fingerprint
      ? []
      : (fresh.inspectorDataChangedGroups ?? current.inspectorDataChangedGroups);
  return {
    ...current,
    inspectorDataSeen: seen,
    inspectorDataFingerprint: fingerprint,
    inspectorDataChangedGroups: groups,
  };
}

/* ─── Approach settings ─── */

export const ASSET_TYPE_CHANGED_MESSAGE = "نوع الأصل تغيّر — راجع نطاق وأساليب التقييم";

/**
 * The asset type changed on the inspector's side and the appraiser had already saved his approach
 * settings. Only a reminder — nothing is changed for him.
 */
export function assetTypeChangedNeedsReview(input: {
  changedGroups?: readonly string[] | null;
  settingsSaved: boolean;
}): boolean {
  return input.settingsSaved && Boolean(input.changedGroups?.includes("assetType"));
}
