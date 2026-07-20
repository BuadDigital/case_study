import type { PageId } from "@platform/types";
import { PAGE_TITLES } from "../constants";

/** أسماء أوضح في الدليل — قد تختلف عن تسمية القائمة الجانبية */
export const SCREEN_CATALOG_PAGE_NAMES: Partial<Record<PageId, string>> = {
  dashboard: "لوحة التحكم",
  po: "قائمة أوامر العمل",
  "all-transactions": "جميع المعاملات المسندة",
  "active-primary-data": "البيانات الأولية",
  "active-distribution": "توزيع المعاملات على الأطراف",
  "active-case-study": "دراسة حالة العقارات",
  "bourse-inquiry": "استعلام بورصة عقارية",
  "active-survey": "الرفع المساحي — مهام المكتب الهندسي",
  keys: "المفاتيح — لوحة عامة",
  failures: "إدارة التعذرات",
  "suspended-transactions": "المعاملات المعلقة",
  "valuation-requests": "طلبات التقييم — لوحة عامة",
  financial: "التقارير المالية",
  kpi: "مؤشرات الأداء",
  "property-inspection": "معاينة العقار — قائمة المهام",
  "government-review": "المراجعة الحكومية — قائمة المهام",
  "valuation-coordination": "استلام التقييم — قائمة المهام",
  "property-appraisal": "تقييم العقار — قائمة المهام",
  users: "إدارة المستخدمين",
  courts: "المحاكم والدوائر",
  "failure-types": "أنواع التعذرات",
  "case-study-info-roles": "علاقة المستخدم بالمعلومة",
  "system-fields-catalog": "قاموس الحقول المركزي",
  "system-screen-catalog": "دليل الشاشات",
  "fee-pricing": "التسعيرة — أسعار الأتعاب",
  "audit-log": "سجل التدقيق",
};

export function screenCatalogPageName(
  pageId: PageId,
  fallbackLabel: string,
): string {
  return SCREEN_CATALOG_PAGE_NAMES[pageId] ?? PAGE_TITLES[pageId] ?? fallbackLabel;
}
