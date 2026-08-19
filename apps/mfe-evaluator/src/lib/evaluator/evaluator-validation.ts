import {
  invalidControlClass,
  resolveFirstErrorMessage,
  resolveFirstErrorTarget,
  type FormErrorTarget,
} from "@platform/app-shared/form-ux";
import type { EvaluatorReportWorker } from "./evaluator-window-data";
import { parseEvaluatorAmount } from "./value-estimation";

export type EvaluatorValidationErrors = Record<string, string>;

/** Document order on the valuation tab for scroll + first message. */
const EVALUATOR_ERROR_TARGETS: readonly FormErrorTarget[] = [
  { key: "land_value", targetId: "inf-land" },
  { key: "building_value", targetId: "inf-building" },
  { key: "evaluator_price", targetId: "inf-total" },
  { key: "forced_sale_discount", targetId: "inf-discount" },
  { key: "asset_data_confirmed", targetId: "val-asset-data" },
  { key: "independence_declared", targetId: "inf-independence" },
  { key: "report_workers", targetId: "inf-workers" },
] as const;

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
  assetDataConfirmed?: boolean;
  assetDataVarianceNotes?: string;
  independenceDeclared?: boolean;
  reportWorkers?: EvaluatorReportWorker[];
}): EvaluatorValidationErrors {
  const errors: EvaluatorValidationErrors = {};
  const {
    evaluatorPrice,
    landValue = "",
    buildingValue = "",
    forcedSaleDiscountPct = "",
  } = input;

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

  const discount = parseEvaluatorAmount(forcedSaleDiscountPct);
  if (!forcedSaleDiscountPct.trim()) {
    errors.forced_sale_discount = "مطلوب إدخال نسبة خصم البيع القسري.";
  } else if (discount == null || discount < 0 || discount > 100) {
    errors.forced_sale_discount = "النسبة يجب أن تكون بين 0 و 100.";
  }

  const priceRaw = evaluatorPrice.trim()
    ? Number.parseFloat(evaluatorPrice.replace(/,/g, "").trim())
    : NaN;

  if (!evaluatorPrice.trim() || !Number.isFinite(priceRaw) || priceRaw <= 0) {
    errors.evaluator_price =
      "مطلوب إدخال إجمالي قيمة العقار — رقم موجب أكبر من صفر.";
  }

  const assetConfirmed = Boolean(input.assetDataConfirmed);
  const varianceNotes = (input.assetDataVarianceNotes ?? "").trim();
  if (!assetConfirmed && !varianceNotes) {
    errors.asset_data_confirmed =
      "أكّد مراجعة بيانات الأصل، أو دوّن ملاحظات التباين إن وُجدت.";
  }

  if (!input.independenceDeclared) {
    errors.independence_declared =
      "يجب تأكيد إقرار الاستقلالية وعدم تضارب المصالح.";
  }

  const namedWorkers = (input.reportWorkers ?? []).filter((worker) =>
    worker.name.trim(),
  );
  if (namedWorkers.length === 0) {
    errors.report_workers =
      "أضف عاملاً واحداً على الأقل على التقرير (الدور والاسم).";
  } else if (namedWorkers.some((worker) => !worker.role)) {
    errors.report_workers = "حدد دور كل عامل على التقرير (معد / مراجع / معتمد).";
  }

  return errors;
}

export function firstEvaluatorError(
  errors: EvaluatorValidationErrors,
): string | null {
  return resolveFirstErrorMessage(errors, EVALUATOR_ERROR_KEYS);
}

export { invalidControlClass as evaluatorInvalidControlClass };