import type { PageId } from "@platform/types";
import { PAGE_TITLES } from "../constants";

/** Clearer catalog names — may differ from the sidebar label */
const SCREEN_CATALOG_PAGE_NAMES: Partial<Record<PageId, string>> = {
  dashboard: "لوحة التحكم",
  po: "أوامر العمل (PO)",
  "all-transactions": "جميع المعاملات المسندة",
  "property-map": "خريطة العقارات",
  "active-primary-data": "البيانات الأولية",
  "active-distribution": "توزيع المعاملات على الأطراف",
  "active-case-study": "دراسة حالة العقارات",
  "system-upload": "الرفع على النظام",
  "bourse-inquiry": "استعلام بورصة عقارية",
  "active-survey": "الرفع المساحي — مهام المكتب الهندسي",
  "active-inspection": "معاينة العقار — مهام المعاين الميداني",
  survey: "مكاتب الرفع — شاشة يتيمة",
  keys: "المفاتيح — لوحة عامة",
  failures: "إدارة التعذّرات",
  "suspended-transactions": "المعاملات المعلّقة",
  "valuation-requests": "طلبات التقييم — لوحة عامة",
  financial: "المالية والفوترة",
  "property-inspection": "معاينة العقار — شاشة يتيمة",
  "property-appraisal": "تقييم العقار — قائمة المهام",
  "operations-tasks": "المهام التشغيلية — السجل والتذكير",
  users: "المستخدمون",
  courts: "المحاكم والدوائر",
  "location-pending": "مراجعة المسميات المبدئية",
  "failure-types": "أنواع التعذّرات",
  "case-study-info-roles": "علاقة المستخدم بالمعلومة",
  "system-fields-catalog": "قاموس الحقول المركزي",
  "system-screen-catalog": "دليل الشاشات",
  "fee-pricing": "التسعيرة — أسعار الأتعاب",
  "organization-settings": "بيانات المنشأة",
  "attachment-print-dictionary": "قوائم التقييم",
  "difference-factor-catalog": "تعريفات عوامل الاختلاف",
  clients: "سجل العملاء",
  "audit-log": "سجل التدقيق",
};

export function screenCatalogPageName(
  pageId: PageId,
  fallbackLabel: string,
): string {
  return SCREEN_CATALOG_PAGE_NAMES[pageId] ?? PAGE_TITLES[pageId] ?? fallbackLabel;
}
