export { apiConfig } from "../../../../lib/evaluator/api-config";

// المنسّق العددي الموحّد انتقل إلى الحزمة المشتركة — نعيد تصديره لبقاء الاستيرادات كما هي.
export { fmt } from "@platform/app-shared/format/number";

/** ق-8-2: الحد الأدنى لطول المبرر — يطابق JustificationRules.MinLength في الخادم. */
export const JUSTIFICATION_MIN_LENGTH = 10;
