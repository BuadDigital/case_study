/** Building finishing level filled by the case specialist — mirrored to the appraiser draft for print. */

import {
  VALUATION_REPORT_HTML_DEFAULTS,
  type OrganizationValuationReportSettings,
} from "@platform/api-client";
import {
  loadSpecialistReportExtrasBag,
  patchSpecialistReportExtras,
} from "@platform/app-shared/storage/specialist-report-extras-sync";
import {
  submittedInspectorAssetIsLand,
  type InspectorWorkspaceStatus,
} from "./inspector-workspace-data";
import {
  VALUATION_SPECIALIST_FINISHING_CHANGED_EVENT,
  VALUATION_SPECIALIST_FINISHING_REQUIRED_EVENT,
} from "../events/app-events";

export const SpecialistFinishingLevels = {
  Luxury: "luxury",
  Medium: "medium",
  Ordinary: "ordinary",
  None: "none",
} as const;
/** "" until the specialist picks one. */
export type SpecialistFinishingLevel =
  | ""
  | (typeof SpecialistFinishingLevels)[keyof typeof SpecialistFinishingLevels];

/** The levels in the order the specialist picks from, with the words the report prints. */
export const SPECIALIST_FINISHING_LEVEL_OPTIONS = [
  { value: SpecialistFinishingLevels.Luxury, label: "تشطيب فاخر" },
  { value: SpecialistFinishingLevels.Medium, label: "تشطيب متوسط" },
  { value: SpecialistFinishingLevels.Ordinary, label: "تشطيب عادي" },
  { value: SpecialistFinishingLevels.None, label: "بدون تشطيب" },
] as const;

export const SPECIALIST_FINISHING_REQUIRED_MESSAGE =
  "اختر مستوى تشطيبات البناء قبل تأكيد مدخلات المعاين.";

export function normalizeSpecialistFinishingLevel(
  raw: string | null | undefined,
): SpecialistFinishingLevel {
  const v = (raw ?? "").trim();
  return SPECIALIST_FINISHING_LEVEL_OPTIONS.find((o) => o.value === v)?.value ?? "";
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
function specialistFinishingLevelIsRequired(inspection: {
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
  return SPECIALIST_FINISHING_LEVEL_OPTIONS.find((o) => o.value === key)?.label ?? "";
}

/** Old shortened defaults — replace with HTML v3 full copy when still stored in org settings. */
const LEGACY_SHORT_FINISHING = new Set([
  "واجهات حجر طبيعي أو دهان عالي الجودة، أرضيات مداخل ومجالس من رخام فاخر، عزل ونوافذ عالية، تكييف مركزي ومصعد.",
  "واجهات حجر أو دهان، أرضيات سيراميك، تكييف منفصل (سبليت)، مكونات جدران مزدوجة.",
  "واجهات دهان، أرضيات سيراميك عادي أو بلاط بلدي، شبابيك عادية، تكييف شباك، بدون جبس أسقف.",
]);

export function finishingTextForReport(stored: string, htmlV3Default: string): string {
  const t = (stored ?? "").trim();
  if (!t || LEGACY_SHORT_FINISHING.has(t)) return htmlV3Default;
  return t;
}

/**
 * What the report prints for each level — the organisation's text from «إعدادات المنشأة», or the
 * report's own text where none is set (an old short text counts as none). «بدون تشطيب» has none.
 */
export function specialistFinishingDescriptions(
  valuationReport: Partial<
    Pick<OrganizationValuationReportSettings, "finishingLuxury" | "finishingMedium" | "finishingOrdinary">
  > | null | undefined,
): Record<SpecialistFinishingLevel, string> {
  const d = VALUATION_REPORT_HTML_DEFAULTS;
  return {
    "": "",
    [SpecialistFinishingLevels.Luxury]: finishingTextForReport(valuationReport?.finishingLuxury ?? "", d.finishingLuxury),
    [SpecialistFinishingLevels.Medium]: finishingTextForReport(valuationReport?.finishingMedium ?? "", d.finishingMedium),
    [SpecialistFinishingLevels.Ordinary]: finishingTextForReport(valuationReport?.finishingOrdinary ?? "", d.finishingOrdinary),
    [SpecialistFinishingLevels.None]: "",
  };
}
