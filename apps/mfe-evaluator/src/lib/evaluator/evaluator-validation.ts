import { getCachedEvaluatorReport } from "./evaluator-report-attachments";
import { parseEvaluatorAmount } from "./value-estimation";
import type { EvaluatorReportWorker } from "./evaluator-window-data";

export type EvaluatorValidationErrors = Record<string, string>;

export function validateEvaluatorSubmission(input: {
  taskId: string;
  reportNo?: string;
  evaluatorPrice: string;
  landValue?: string;
  buildingValue?: string;
  forcedSaleDiscountPct?: string;
  /** Legacy fields retained in persisted payloads; not part of the HTML form. */
  independenceDeclared?: boolean;
  reportWorkers?: EvaluatorReportWorker[];
  assetDataConfirmed?: boolean;
  assetDataVarianceNotes?: string;
}): EvaluatorValidationErrors {
  const errors: EvaluatorValidationErrors = {};
  const {
    taskId,
    reportNo = "",
    evaluatorPrice,
    landValue = "",
    buildingValue = "",
    forcedSaleDiscountPct = "",
  } = input;

  if (!reportNo.trim()) {
    errors.report_no = "مطلوب إدخال رقم التقرير.";
  }

  const report = getCachedEvaluatorReport(taskId);
  if (!report?.dataUrl) {
    errors.evaluator_report_file = "مطلوب رفع تقرير PDF من برنامج المقياس.";
  }

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

  return errors;
}

export function firstEvaluatorError(
  errors: EvaluatorValidationErrors,
): string | null {
  const values = Object.values(errors);
  return values[0] ?? null;
}
