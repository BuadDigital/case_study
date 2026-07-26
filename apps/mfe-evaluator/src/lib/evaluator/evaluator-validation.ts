import { getCachedEvaluatorReport } from "./evaluator-report-attachments";
import {
  computePropertyTotal,
  parseEvaluatorAmount,
} from "./value-estimation";
import type { EvaluatorReportWorker } from "./evaluator-window-data";

export type EvaluatorValidationErrors = Record<string, string>;

export function validateEvaluatorSubmission(input: {
  taskId: string;
  evaluatorPrice: string;
  landValue?: string;
  buildingValue?: string;
  forcedSaleDiscountPct?: string;
  independenceDeclared?: boolean;
  reportWorkers?: EvaluatorReportWorker[];
}): EvaluatorValidationErrors {
  const errors: EvaluatorValidationErrors = {};
  const {
    taskId,
    evaluatorPrice,
    landValue = "",
    buildingValue = "",
    forcedSaleDiscountPct = "",
    independenceDeclared = false,
    reportWorkers = [],
  } = input;

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

  const total = computePropertyTotal(landValue, buildingValue);
  const priceRaw = evaluatorPrice.trim()
    ? Number.parseFloat(evaluatorPrice.replace(/,/g, "").trim())
    : total;

  if (!Number.isFinite(priceRaw) || priceRaw <= 0) {
    errors.evaluator_price =
      "إجمالي قيمة العقار يجب أن يكون أكبر من صفر (أرض + مباني).";
  }

  if (!independenceDeclared) {
    errors.independence_declared =
      "يجب تأكيد إقرار الاستقلالية وعدم تضارب المصالح.";
  }

  const filledWorkers = reportWorkers.filter((w) => w.name.trim());
  if (filledWorkers.length === 0) {
    errors.report_workers = "أضف عاملاً واحداً على الأقل باسم كامل.";
  } else {
    for (const [i, w] of filledWorkers.entries()) {
      if (!w.role) {
        errors[`report_worker_${i}_role`] = `اختر دور العامل #${i + 1}.`;
      }
      if (!w.licenseNumber.trim()) {
        errors[`report_worker_${i}_license`] =
          `رقم الترخيص مطلوب للعامل #${i + 1}.`;
      }
    }
  }

  return errors;
}

export function firstEvaluatorError(
  errors: EvaluatorValidationErrors,
): string | null {
  const values = Object.values(errors);
  return values[0] ?? null;
}
