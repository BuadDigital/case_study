export type BreadcrumbSegment = {
  label: string;
  href?: string;
  current?: boolean;
  /** Isolate LTR values (deed numbers) in RTL breadcrumb layout. */
  ltr?: boolean;
};

/**
 * Known intermediate crumb labels → routes (Case Study.html crumbs).
 * Section headers (دراسة الحالة، المعاملات النشطة، …) intentionally omit href.
 */
const BREADCRUMB_LABEL_HREF: Record<string, string> = {
  الرئيسية: "/dashboard",
  "لوحة التحكم": "/dashboard",
  "أوامر العمل": "/po",
  "جميع المعاملات": "/all-transactions",
  "البيانات الأولية": "/active-primary-data",
  "استعلام بورصة": "/bourse-inquiry",
  "توزيع المعاملات": "/active-distribution",
  "دراسة حالة العقارات": "/active-case-study",
  "الرفع على النظام": "/system-upload",
  "معاينة العقار": "/active-inspection",
  "تقييم العقار": "/property-appraisal",
  "الرفع المساحي": "/active-survey",
  "مكاتب الرفع الهندسي": "/survey",
  "مكاتب الرفع": "/survey",
  "فوترة الأتعاب": "/party-fees",
  "الأتعاب والصرف": "/party-fees",
  المهام: "/operations-tasks",
  "محفظة المفاتيح": "/keys",
  "إدارة المفاتيح": "/keys",
  "إدارة التعذرات": "/failures",
  "المعاملات المعلقة": "/suspended-transactions",
  "التقارير المالية": "/financial",
  "المالية والفوترة": "/financial",
  الإيرادات: "/financial?area=revenue",
  التكاليف: "/financial?area=costs",
  مهامي: "/financial?area=tasks",
  "المكتب الهندسي": "/profile",
  "مسيرات الصرف": "/profile",
  المعاين: "/profile",
  المستحقات: "/profile",
  "طلبات التقييم": "/valuation-requests",
  "قاموس الحقول المركزي": "/system-fields-catalog",
  "دليل الشاشات": "/system-screen-catalog",
  المستخدمون: "/users",
  "المحاكم و الدوائر": "/courts",
  "المحاكم والدوائر": "/courts",
  "مراجعة المسميات": "/location-pending",
  "أنواع التعذرات": "/failure-types",
  "علاقة المستخدم بالمعلومة": "/case-study-info-roles",
  "سجل التدقيق": "/audit-log",
  التسعيرة: "/fee-pricing",
  البروفايل: "/profile",
};

/** Split a legacy `a / b / c` trail into segments (last segment is current). */
export function slashTrailToSegments(trail: string): BreadcrumbSegment[] {
  const parts = trail
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];
  return parts.map((label, index) => {
    const current = index === parts.length - 1;
    const href = current ? undefined : BREADCRUMB_LABEL_HREF[label];
    return {
      label,
      current,
      ...(href ? { href } : {}),
    };
  });
}
