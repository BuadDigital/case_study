/** Building finishing level filled by the case specialist — mirrored to the appraiser draft for print. */

import {
  loadSpecialistReportExtrasBag,
  patchSpecialistReportExtras,
} from "@platform/app-shared/storage/specialist-report-extras-sync";
import {
  submittedInspectorAssetIsLand,
  type InspectorWorkspaceStatus,
} from "./inspector-workspace-data";

export type SpecialistFinishingLevel =
  | ""
  | "luxury"
  | "medium"
  | "ordinary"
  | "none";

export const VALUATION_SPECIALIST_FINISHING_CHANGED_EVENT =
  "ejadah-valuation-specialist-finishing-changed";

/** Fired when confirm is blocked because finishing was left empty. */
export const VALUATION_SPECIALIST_FINISHING_REQUIRED_EVENT =
  "ejadah-valuation-specialist-finishing-required";

export const SPECIALIST_FINISHING_REQUIRED_MESSAGE =
  "اختر مستوى تشطيبات البناء قبل تأكيد مدخلات المعاين.";

export function normalizeSpecialistFinishingLevel(
  raw: string | null | undefined,
): SpecialistFinishingLevel {
  const v = (raw ?? "").trim();
  if (
    v === "luxury" ||
    v === "medium" ||
    v === "ordinary" ||
    v === "none"
  ) {
    return v;
  }
  return "";
}

/** Building finishing is inapplicable to land, including stale saved values. */
export function specialistFinishingLevelForInspection(
  level: SpecialistFinishingLevel,
  inspection: {
    status: InspectorWorkspaceStatus;
    assetSubject?: string | null;
    initialAssetSubject?: string | null;
  },
): SpecialistFinishingLevel {
  return submittedInspectorAssetIsLand(inspection) ? "" : level;
}

/** True when the specialist must pick finishing before accepting inspector inputs. */
export function specialistFinishingLevelIsRequired(inspection: {
  status: InspectorWorkspaceStatus;
  assetSubject?: string | null;
  initialAssetSubject?: string | null;
}): boolean {
  return !submittedInspectorAssetIsLand(inspection);
}

/**
 * Returns an error message when finishing is required but not chosen.
 * Land packages skip this gate.
 */
export function specialistFinishingLevelMissingMessage(input: {
  propertyId: string;
  status: InspectorWorkspaceStatus;
  assetSubject?: string | null;
  initialAssetSubject?: string | null;
}): string | null {
  if (!specialistFinishingLevelIsRequired(input)) return null;
  const level = specialistFinishingLevelForInspection(
    loadSpecialistFinishingLevel(input.propertyId),
    input,
  );
  return level ? null : SPECIALIST_FINISHING_REQUIRED_MESSAGE;
}

export function notifySpecialistFinishingRequired(propertyId: string): void {
  const id = propertyId.trim();
  if (!id || typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(VALUATION_SPECIALIST_FINISHING_REQUIRED_EVENT, {
      detail: { propertyId: id },
    }),
  );
}

export function loadSpecialistFinishingLevel(
  propertyId: string | null | undefined,
): SpecialistFinishingLevel {
  const id = (propertyId ?? "").trim();
  if (!id || typeof window === "undefined") return "";
  return normalizeSpecialistFinishingLevel(
    loadSpecialistReportExtrasBag(id).finishing,
  );
}

export function saveSpecialistFinishingLevel(
  propertyId: string,
  level: SpecialistFinishingLevel,
): void {
  const id = propertyId.trim();
  if (!id || typeof window === "undefined") return;
  const next = normalizeSpecialistFinishingLevel(level);
  patchSpecialistReportExtras(id, { finishing: next || undefined });
  window.dispatchEvent(
    new CustomEvent(VALUATION_SPECIALIST_FINISHING_CHANGED_EVENT, {
      detail: { propertyId: id },
    }),
  );
}

export function specialistFinishingLevelLabel(
  key: SpecialistFinishingLevel,
): string {
  switch (key) {
    case "luxury":
      return "تشطيب فاخر";
    case "medium":
      return "تشطيب متوسط";
    case "ordinary":
      return "تشطيب عادي";
    case "none":
      return "بدون تشطيب";
    default:
      return "";
  }
}
