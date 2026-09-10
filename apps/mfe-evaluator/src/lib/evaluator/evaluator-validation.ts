import {
  invalidControlClass,
  resolveFirstErrorMessage,
  resolveFirstErrorTarget,
  type FormErrorTarget,
} from "@platform/app-shared/form-ux";
import { esgGroupsMissingImpactDescription } from "@platform/app-shared/app-data/valuation-report-specialist-esg";
import type {
  EvaluatorReportChoices,
  EvaluatorReportWorker,
} from "./evaluator-window-data";
import { parseEvaluatorAmount } from "./value-estimation";

export type EvaluatorValidationErrors = Record<string, string>;

export type EvaluatorRetrospectiveDraft = {
  mode: string;
  kind: "single" | "range";
  date: string;
  dateEnd: string;
};

export function retrospectiveDraftFromSettings(settings: {
  valuationDateMode?: string | null;
  retrospectiveDate?: string | null;
  retrospectiveDateEnd?: string | null;
} | null | undefined): EvaluatorRetrospectiveDraft | null {
  if (!settings) return null;
  const dateEnd = (settings.retrospectiveDateEnd ?? "").trim();
  return {
    mode: settings.valuationDateMode ?? "",
    kind: dateEnd ? "range" : "single",
    date: (settings.retrospectiveDate ?? "").trim(),
    dateEnd,
  };
}

/** Document order: basics (retro dates), final-opinion value, then review-tab send fields. */
const EVALUATOR_ERROR_TARGETS: readonly FormErrorTarget[] = [
  { key: "retrospective_date", targetId: "as-retro-date" },
  { key: "retrospective_date_from", targetId: "as-retro-date-from" },
  { key: "retrospective_date_to", targetId: "as-retro-date-to" },
  { key: "land_value", targetId: "inf-land" },
  { key: "building_value", targetId: "inf-building" },
  { key: "evaluator_price", targetId: "final-inf-total" },
  { key: "forced_sale_discount", targetId: "final-inf-discount" },
  { key: "esg_impact_notes", targetId: "val-esg" },
  { key: "independence_declared", targetId: "inf-independence" },
  { key: "report_workers", targetId: "inf-workers" },
] as const;

const RETRO_DATE_TARGET_IDS = new Set([
  "as-retro-date",
  "as-retro-date-from",
  "as-retro-date-to",
]);

const FINAL_OPINION_TARGET_IDS = new Set([
  "inf-land",
  "inf-building",
  "final-inf-total",
  "final-inf-discount",
]);

export function evaluatorWorkScreenForErrorTarget(
  targetId: string | null,
): "basic" | "market" | "cost" | "final" | "review" {
  if (targetId && RETRO_DATE_TARGET_IDS.has(targetId)) return "basic";
  if (targetId && FINAL_OPINION_TARGET_IDS.has(targetId)) return "final";
  return "review";
}

export const EVALUATOR_INFATH_ERROR_KEYS = [
  "independence_declared",
  "report_workers",
] as const;

const EVALUATOR_ERROR_KEYS = EVALUATOR_ERROR_TARGETS.map((t) => t.key);

export function firstEvaluatorErrorTarget(
  errors: EvaluatorValidationErrors,
): string | null {
  return resolveFirstErrorTarget(errors, EVALUATOR_ERROR_TARGETS);
}

export function validateEvaluatorSubmission(input: {
  taskId: string;
  evaluatorPrice: string;
  landValue?: string;
  buildingValue?: string;
  forcedSaleDiscountPct?: string;
  valueBasisKey?: string;
  assetDataConfirmed?: boolean;
  assetDataVarianceNotes?: string;
  independenceDeclared?: boolean;
  reportWorkers?: EvaluatorReportWorker[];
  reportChoices?: Pick<
    EvaluatorReportChoices,
    "esgEnv" | "esgSoc" | "esgGov"
  > | null;
  /** When approaches panel is source of truth — skip manual land/building. */
  skipManualLandBuilding?: boolean;
  retrospective?: EvaluatorRetrospectiveDraft | null;
}): EvaluatorValidationErrors {
  const errors: EvaluatorValidationErrors = {};
  const {
    evaluatorPrice,
    landValue = "",
    buildingValue = "",
    forcedSaleDiscountPct = "",
    valueBasisKey = "",
    skipManualLandBuilding = false,
    retrospective,
    reportChoices,
  } = input;

  if (retrospective?.mode === "retrospective") {
    const date = retrospective.date.trim();
    const dateEnd = retrospective.dateEnd.trim();
    if (retrospective.kind === "range") {
      if (!date) {
        errors.retrospective_date_from = "تاريخ الأثر الرجعي إلزامي";
      } else if (!dateEnd) {
        errors.retrospective_date_to = "حدّد تاريخ نهاية الفترة";
      } else if (dateEnd < date) {
        errors.retrospective_date_to =
          "تاريخ النهاية يجب ألا يسبق تاريخ البداية";
      }
    } else if (!date) {
      errors.retrospective_date = "تاريخ الأثر الرجعي إلزامي";
    }
  }

  if (!skipManualLandBuilding) {
    const land = parseEvaluatorAmount(landValue);
    if (!landValue.trim()) {
      errors.land_value = "مطلوب إدخال قيمة الأرض.";
    } else if (land == null || land < 0) {
      errors.land_value = "يجب أن تكون قيمة الأرض رقماً صحيحاً (≥ 0).";
    }

    const building = parseEvaluatorAmount(buildingValue);
    if (!buildingValue.trim()) {
      errors.building_value = "مطلوب إدخال قيمة المباني (صفر للأراضي).";
    } else if (building == null || building < 0) {
      errors.building_value = "يجب أن تكون قيمة المباني رقماً صحيحاً (≥ 0).";
    }
  }

  if (valueBasisKey === "liquidation") {
    const discount = parseEvaluatorAmount(forcedSaleDiscountPct);
    if (!forcedSaleDiscountPct.trim()) {
      errors.forced_sale_discount = "مطلوب إدخال نسبة خصم التصفية.";
    } else if (discount == null || discount < 0 || discount > 100) {
      errors.forced_sale_discount = "النسبة يجب أن تكون بين 0 و 100.";
    }
  }

  const priceRaw = evaluatorPrice.trim()
    ? Number.parseFloat(evaluatorPrice.replace(/,/g, "").trim())
    : NaN;

  if (!evaluatorPrice.trim() || !Number.isFinite(priceRaw) || priceRaw <= 0) {
    errors.evaluator_price =
      "مطلوب إدخال إجمالي قيمة العقار — رقم موجب أكبر من صفر.";
  }

  if (
    reportChoices &&
    esgGroupsMissingImpactDescription(reportChoices).length > 0
  ) {
    errors.esg_impact_notes =
      "عند اختيار «يوجد تأثير» في ESG يجب كتابة وصف الأثر.";
  }

  return errors;
}

export function firstEvaluatorError(
  errors: EvaluatorValidationErrors,
): string | null {
  return resolveFirstErrorMessage(errors, EVALUATOR_ERROR_KEYS);
}

export { invalidControlClass as evaluatorInvalidControlClass };