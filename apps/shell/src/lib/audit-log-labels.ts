/**
 * Human-readable Arabic labels for audit-log codes.
 * Codes stay English in storage; only the monitor UI is localized.
 */

const ACTION_AR: Record<string, string> = {
  CASE_STUDY_INFO_ROLES_SAVED: "حفظ علاقة المستخدم بالمعلومة",
  FIELD_DICTIONARY_SAVED: "حفظ قاموس الحقول",
  DIFFERENCE_FACTOR_CATALOG_SAVED: "حفظ كتالوج عوامل الفرق",
  ORGANIZATION_SETTINGS_SAVED: "حفظ إعدادات المنشأة",
  COURT_CATALOG_REPLACED: "استبدال كتالوج المحاكم",
  COURT_CREATED: "إنشاء محكمة",
  COURT_UPDATED: "تعديل محكمة",
  COURT_ACTIVATED: "تفعيل محكمة",
  COURT_DEACTIVATED: "تعطيل محكمة",
  CIRCUIT_CREATED: "إنشاء دائرة",
  CIRCUIT_UPDATED: "تعديل دائرة",
  CIRCUIT_ACTIVATED: "تفعيل دائرة",
  CIRCUIT_DEACTIVATED: "تعطيل دائرة",
  USER_CREATED: "إنشاء مستخدم",
  USER_UPDATED: "تعديل مستخدم",
  USER_DISABLED: "تعطيل مستخدم",
  USER_REACTIVATED: "إعادة تفعيل مستخدم",
  USER_UNLOCKED: "إلغاء قفل مستخدم",
  PRICING_TABLE_CREATED: "إنشاء جدول تسعير",
  PRICING_TABLE_UPDATED: "تعديل جدول تسعير",
  PRICING_TABLE_ACTIVATED: "تفعيل جدول تسعير",
  PRICING_TABLE_DEACTIVATED: "تعطيل جدول تسعير",
  PRICING_TABLE_REVISED: "مراجعة جدول تسعير",
  PRICING_TABLE_DELETED: "حذف جدول تسعير",
  PRICING_ASSIGNMENTS_REPLACED: "استبدال إسناد التسعير",
  PRICING_ASSIGNMENTS_RELINKED: "إعادة ربط إسناد التسعير",
  ENFAZ_INVOICE_COLLECTED: "تحصيل فاتورة إنفاذ",
  BILLING_NEGOTIATION_DEADLINE: "انتهاء مهلة تفاوض الفوترة",
  FEE_BILLING_TRANSITION: "انتقال حالة فاتورة الأتعاب",
  PROPERTY_GROUP_LINK_CONFIRMED: "تأكيد ربط مجموعة عقارات",
  PROPERTY_GROUP_UNLINKED: "فك ربط مجموعة عقارات",
  "failure.raised": "تسجيل تعذّر",
  "failure.suspended": "تعليق تعذّر",
  "failure.resolved": "حل تعذّر",
  "failure.approved": "اعتماد تعذّر",
  "failure.returned": "إعادة تعذّر",
  "case-study.party-submission.submitted": "تسليم مهمة طرف",
  "case-study.party-submission.accepted": "قبول تسليم طرف",
  "case-study.workflow-task.distribution-confirmed": "تأكيد توزيع مهمة",
  "case-study.workflow-task.reopened": "إعادة فتح مهمة سير العمل",
  "case-study.post-enfaz-decision.recorded": "تسجيل قرار ما بعد إنفاذ",
  "inspection.remote-scope.approved": "اعتماد نطاق معاينة عن بُعد",
  "valuation.alert-overrides.updated": "تعديل تجاوزات تنبيهات التقييم",
  "valuation.report-issuance.reopened": "إعادة فتح إصدار تقرير التقييم",
};

const ENTITY_AR: Record<string, string> = {
  case_study_info_roles: "علاقة المستخدم بالمعلومة",
  field_dictionary: "قاموس الحقول",
  difference_factor_catalog: "كتالوج عوامل الفرق",
  organization_settings: "إعدادات المنشأة",
  court: "محكمة",
  circuit: "دائرة",
  court_catalog: "كتالوج المحاكم",
  user: "مستخدم",
  User: "مستخدم",
  pricing_table: "جدول تسعير",
  pricing_assignment: "إسناد تسعير",
  PropertyFailure: "تعذّر",
  property_group: "مجموعة عقارات",
  WorkflowTask: "مهمة سير العمل",
  workflow_task: "مهمة سير العمل",
  PartyTaskSubmission: "تسليم طرف",
  party_submission: "تسليم طرف",
  valuation_report: "تقرير التقييم",
  inspection: "معاينة",
  OrganizationSettings: "إعدادات المنشأة",
};

export function auditActionLabel(action: string): string {
  const key = action.trim();
  if (!key) return "—";
  return ACTION_AR[key] ?? ACTION_AR[key.toUpperCase()] ?? `إجراء غير معروف (${key})`;
}

/** Resolve actor id to a staff display name when available. */
export function auditActorLabel(
  actorId: string,
  namesById?: ReadonlyMap<string, string>,
): string {
  const id = actorId.trim();
  if (!id) return "—";
  if (id === "system") return "النظام";
  if (id === "unknown") return "غير معروف";
  const name = namesById?.get(id)?.trim();
  if (name) return name;
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

export function auditEntityTypeLabel(entityType: string): string {
  const key = entityType.trim();
  if (!key) return "—";
  return ENTITY_AR[key] ?? ENTITY_AR[key.toLowerCase()] ?? key;
}

export function auditEntityLabel(entityType: string, entityId: string): string {
  const typeLabel = auditEntityTypeLabel(entityType);
  const id = entityId.trim();
  if (!id) return typeLabel;
  // Hide long technical ids from the main cell; keep type readable.
  if (id.length > 12) return typeLabel;
  return `${typeLabel} · ${id}`;
}

export function auditDetailSummary(before: unknown, after: unknown): string {
  const hasBefore = before != null;
  const hasAfter = after != null;
  if (!hasBefore && hasAfter) return "أُنشئ سجل جديد";
  if (hasBefore && hasAfter) return "عُدّل السجل";
  if (hasBefore && !hasAfter) return "حُذف السجل";
  return "—";
}

export function auditDetailTooltip(before: unknown, after: unknown): string {
  try {
    return JSON.stringify({ قبل: before, بعد: after });
  } catch {
    return "—";
  }
}
