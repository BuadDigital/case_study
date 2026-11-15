import type { ValuationReportImportPreviewDto } from "@platform/api-client";

/** The file picker's filter — the export of every source is an Excel workbook. */
export const EXCEL_ACCEPT =
  ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

export function isExcelFile(file: File): boolean {
  return /\.(xlsx|xls)$/i.test(file.name);
}

/**
 * Why «اعتماد الاستيراد» is disabled, or null when the import can go ahead.
 *
 * How it works: a missing required column stops the import; a gap after the previous upload
 * needs the employee to tick the acknowledgement; a file with nothing valid has nothing to save.
 * Gaps inside the file itself are information only (a filtered export has them).
 */
export function importBlockReason(
  preview: ValuationReportImportPreviewDto,
  gapAcknowledged: boolean,
): string | null {
  if (preview.missingColumns.length > 0) return "أعمدة إلزامية ناقصة في الملف";
  if (preview.newCount + preview.replacedCount === 0) return "لا توجد تقارير صالحة للاستيراد";
  if (preview.previousBatchGap && !gapAcknowledged) return "أكّد الاطلاع على الفجوة قبل الاعتماد";
  return null;
}
