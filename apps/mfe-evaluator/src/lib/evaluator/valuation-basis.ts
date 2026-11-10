/**
 * THE basis of value, premise and purpose of a valuation — one order for the final-opinion screen,
 * the report tab seed and the printed report, mirroring the server
 * (AssignmentValuationDefaults.ResolveBasisAndPremise / ResolvePurposeKey).
 *
 * Owner's ruling 2026-11-10: the basis has ONE owner, the work order. The appraiser does not choose
 * it; the saved reconciliation basis counts only when the work order has none (legacy).
 */
import {
  VALUE_BASIS_OPTIONS,
  VALUE_PREMISE_OPTIONS,
  VALUATION_PURPOSE_OPTIONS,
  assignmentValuationDefaults,
  defaultPremiseKeyForBasis,
  isPremiseCompatibleWithBasis,
} from "@platform/app-shared/app-data/assignment-valuation-defaults";

type ValuationKeys = {
  basisKey?: string | null;
  premiseKey?: string | null;
};

/** First key (trimmed, lower-cased) that passes `accept`; "" when none. */
function firstKey(accept: (key: string) => boolean, ...keys: (string | null | undefined)[]): string {
  for (const key of keys) {
    const k = (key ?? "").trim().toLowerCase();
    if (k && accept(k)) return k;
  }
  return "";
}

const isKnownBasis = (key: string) => VALUE_BASIS_OPTIONS.some((o) => o.value === key);
const isKnownPremise = (key: string) => VALUE_PREMISE_OPTIONS.some((o) => o.value === key);
const isKnownPurpose = (key: string) => VALUATION_PURPOSE_OPTIONS.some((o) => o.value === key);

/**
 * Basis and premise of a valuation.
 *
 * How it works: basis = the work order's key → the saved (reconciliation) key → the assignment
 * type's default. Premise = the work order's key → the saved key, each only when known and
 * compatible with the resolved basis → the basis default (orderly for liquidation, current use
 * otherwise).
 *
 * Edge cases: unknown keys are skipped. No assignment type and nothing saved → both "" (callers
 * choose their own blank/«market» display). Fixed 2026-11-10: the screen read the work order first
 * while the server and the printed report read the saved reconciliation first, so one valuation
 * showed 950,000 on screen and «قيمة التصفية» 855,000 in the report.
 */
export function resolveValuationBasisKeys(input: {
  assignmentType?: string | null;
  subClientId?: string | null;
  workOrder?: ValuationKeys | null;
  saved?: ValuationKeys | null;
}): { basisKey: string; premiseKey: string } {
  const type = (input.assignmentType ?? "").trim();
  const basisKey =
    firstKey(isKnownBasis, input.workOrder?.basisKey, input.saved?.basisKey) ||
    (type ? assignmentValuationDefaults(type, input.subClientId).basisKey : "");
  if (!basisKey) return { basisKey: "", premiseKey: "" };
  const premiseKey =
    firstKey(
      (k) => isKnownPremise(k) && isPremiseCompatibleWithBasis(basisKey, k),
      input.workOrder?.premiseKey,
      input.saved?.premiseKey,
    ) || defaultPremiseKeyForBasis(basisKey);
  return { basisKey, premiseKey };
}

/**
 * Purpose of the valuation: the work order's key → the assignment type's default → the approach
 * settings' key (only when the assignment type is unknown). Unknown keys are skipped; "" when
 * nothing is known. Same order as the server's ResolvePurposeKey.
 */
export function resolveValuationPurposeKey(input: {
  assignmentType?: string | null;
  subClientId?: string | null;
  workOrderPurposeKey?: string | null;
  settingsPurposeKey?: string | null;
}): string {
  const type = (input.assignmentType ?? "").trim();
  return (
    firstKey(isKnownPurpose, input.workOrderPurposeKey) ||
    (type ? assignmentValuationDefaults(type, input.subClientId).purposeKey : "") ||
    firstKey(isKnownPurpose, input.settingsPurposeKey)
  );
}
