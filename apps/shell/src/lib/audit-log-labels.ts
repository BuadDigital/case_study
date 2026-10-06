/**
 * Human-readable Arabic labels for audit-log codes.
 * Codes stay English in storage; only the monitor UI is localized.
 */

const ACTION_AR: Record<string, string> = {
  CASE_STUDY_INFO_ROLES_SAVED: "تعديل من يجيب على أسئلة دراسة الحالة",
  FIELD_DICTIONARY_SAVED: "تعديل أسماء الحقول في النظام",
  DIFFERENCE_FACTOR_CATALOG_SAVED: "تعديل قائمة عوامل الفروق",
  ORGANIZATION_SETTINGS_SAVED: "تعديل إعدادات الشركة",
  COURT_CATALOG_REPLACED: "تحديث قائمة المحاكم كاملة",
  COURT_CREATED: "إضافة محكمة",
  COURT_UPDATED: "تعديل بيانات محكمة",
  COURT_ACTIVATED: "تفعيل محكمة",
  COURT_DEACTIVATED: "إيقاف محكمة",
  CIRCUIT_CREATED: "إضافة دائرة قضائية",
  CIRCUIT_UPDATED: "تعديل دائرة قضائية",
  CIRCUIT_ACTIVATED: "تفعيل دائرة قضائية",
  CIRCUIT_DEACTIVATED: "إيقاف دائرة قضائية",
  USER_CREATED: "إضافة مستخدم",
  USER_UPDATED: "تعديل بيانات مستخدم",
  USER_DISABLED: "إيقاف حساب مستخدم",
  USER_REACTIVATED: "إعادة تفعيل حساب مستخدم",
  USER_UNLOCKED: "فتح حساب مقفل",
  PRICING_TABLE_CREATED: "إضافة جدول أسعار",
  PRICING_TABLE_UPDATED: "تعديل جدول أسعار",
  PRICING_TABLE_ACTIVATED: "تفعيل جدول أسعار",
  PRICING_TABLE_DEACTIVATED: "إيقاف جدول أسعار",
  PRICING_TABLE_REVISED: "إصدار نسخة جديدة من جدول الأسعار",
  PRICING_TABLE_DELETED: "حذف جدول أسعار",
  PRICING_ASSIGNMENTS_REPLACED: "تغيير من يُطبَّق عليهم جدول الأسعار",
  PRICING_ASSIGNMENTS_RELINKED: "إعادة ربط جدول الأسعار بأصحابه",
  ENFAZ_INVOICE_COLLECTED: "تحصيل فاتورة من إنفاذ",
  BILLING_NEGOTIATION_DEADLINE: "انتهاء مهلة الاعتراض على الفاتورة",
  FEE_BILLING_TRANSITION: "تغيّر حالة فاتورة الأتعاب",
  PROPERTY_GROUP_LINK_CONFIRMED: "ربط عقارات في مجموعة واحدة",
  PROPERTY_GROUP_UNLINKED: "فك ربط مجموعة العقارات",
  "failure.raised": "الإبلاغ عن تعذّر",
  "failure.suspended": "تعليق التعذّر",
  "failure.resolved": "حل التعذّر",
  "failure.approved": "اعتماد حل التعذّر",
  "failure.returned": "إرجاع التعذّر لمن رفعه",
  "case-study.party-submission.submitted": "تسليم العمل للمراجعة",
  "case-study.party-submission.accepted": "اعتماد العمل بعد المراجعة",
  "case-study.workflow-task.distribution-confirmed": "توزيع المهام على الأطراف",
  "case-study.workflow-task.reopened": "إعادة فتح مهمة",
  "case-study.post-enfaz-decision.recorded": "تسجيل قرار بعد التسليم لإنفاذ",
  "case-study.enfaz-handover.cleared": "إلغاء تسليم الملف لإنفاذ",
  "case-study.report.issued": "إصدار تقرير دراسة الحالة",
  "case-study.report.reopened": "إعادة فتح تقرير دراسة الحالة",
  "case-study.party-submission.returned-with-impact": "إرجاع المعاينة للمعاين",
  "failures.survey-freeze.lifted": "رفع إيقاف الرفع المساحي",
  "inspection.remote-scope.approved": "الموافقة على معاينة عن بُعد",
  "valuation.alert-overrides.updated": "تخطّي تنبيهات على التقييم",
  "valuation.report-issuance.reopened": "إعادة فتح إصدار تقرير التقييم",
  "valuation.report-issuance.code-corrected": "تصحيح رمز إيداع التقرير",
};

const ENTITY_AR: Record<string, string> = {
  case_study_info_roles: "أسئلة دراسة الحالة",
  field_dictionary: "أسماء الحقول",
  difference_factor_catalog: "عوامل الفروق",
  organization_settings: "إعدادات الشركة",
  OrganizationSettings: "إعدادات الشركة",
  court: "محكمة",
  circuit: "دائرة قضائية",
  court_catalog: "قائمة المحاكم",
  user: "مستخدم",
  User: "مستخدم",
  pricing_table: "جدول أسعار",
  pricing_assignment: "ربط جدول الأسعار",
  PropertyFailure: "تعذّر",
  property_group: "مجموعة عقارات",
  WorkflowTask: "مهمة",
  workflow_task: "مهمة",
  PartyTaskSubmission: "عمل طرف",
  party_submission: "عمل طرف",
  WorkOrderProperty: "عقار",
  CaseStudyReport: "تقرير دراسة الحالة",
  ValuationReconciliation: "ترجيح التقييم",
  valuation_report: "تقرير التقييم",
  inspection: "معاينة",
  PartyFeePricingTable: "جدول أتعاب الأطراف",
  PartyFeePricingAssignment: "ربط أتعاب الأطراف",
  ValuationReportIssuance: "إصدار تقرير التقييم",
  inspector_fee_ledger: "سجل أتعاب المعاين",
};

const KIND_AR: Record<string, string> = {
  FieldInspection: "معاينة ميدانية",
  "field-inspection": "معاينة ميدانية",
  PropertyAppraisal: "تقييم عقاري",
  "property-appraisal": "تقييم عقاري",
  EngineeringSurvey: "رفع مساحي",
  "engineering-survey": "رفع مساحي",
  CaseStudyProperty: "دراسة حالة",
  "case-study-property": "دراسة حالة",
  GovernmentReview: "مراجعة حكومية",
  "government-review": "مراجعة حكومية",
  ValuationCoordination: "تنسيق تقييم",
  "valuation-coordination": "تنسيق تقييم",
  "court-visit": "زيارة محكمة",
};

const PHASE_AR: Record<string, string> = {
  Enfath: "إنفاذ",
  enfath: "إنفاذ",
  Bourse: "بورصة",
  bourse: "بورصة",
  Distribution: "توزيع",
  distribution: "توزيع",
  CaseStudy: "دراسة حالة",
  "case-study": "دراسة حالة",
  Obstruction: "عائق",
  obstruction: "عائق",
  Done: "مكتمل",
  done: "مكتمل",
};

const STATUS_AR: Record<string, string> = {
  Draft: "مسودة",
  Submitted: "مُسلَّم",
  Accepted: "مقبول",
  Open: "مفتوح",
  Completed: "مكتمل",
  Cancelled: "ملغى",
  Blocked: "موقوف",
  Raised: "مسجّل",
  Suspended: "معلّق",
  Resolved: "محلول",
  Approved: "معتمد",
  Returned: "مُعاد",
  // Failure statuses arrive lowercase from the failures service.
  review: "قيد المراجعة",
  returned: "مُعاد لمن رفعه",
  internal: "مفتوح داخليًا",
  approved: "معتمد",
  resolved: "تم الحل",
  suspended: "معلّق",
};

/** Failure severity, worded the way the failures screen words it. */
const SEVERITY_AR: Record<string, string> = {
  internal: "تعذّر داخلي",
  suspected: "احتمال تعذّر",
};

const ORG_SECTION_AR: { label: string; keys: string[] }[] = [
  { label: "بيانات المنشأة", keys: ["company"] },
  { label: "المقيّمون", keys: ["evaluator", "valuers"] },
  { label: "تقرير التقييم المهني", keys: ["valuationReport"] },
  { label: "الهوية البصرية", keys: ["branding"] },
  { label: "التواصل", keys: ["communications"] },
  { label: "مهل التنفيذ", keys: ["sla"] },
  { label: "إعدادات التقييم", keys: ["valuation"] },
];

const FIELD_AR: Record<string, string> = {
  displayName: "الاسم",
  roleId: "الدور",
  mobile: "الجوال",
  city: "المدينة",
  status: "الحالة",
  department: "القسم",
  name: "الاسم",
  poNumber: "أمر العمل",
  kind: "نوع المهمة",
  phase: "المرحلة",
  severity: "الخطورة",
  problemTypeId: "نوع المشكلة",
  acceptedBy: "قبله",
  childCount: "عدد الأطراف",
  isActive: "التفعيل",
  category: "التصنيف",
  feeValueSar: "قيمة الأتعاب",
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (value == null || typeof value !== "object" || Array.isArray(value))
    return null;
  return value as JsonRecord;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(obj: JsonRecord | null, key: string): string | null {
  if (!obj) return null;
  const v = obj[key];
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function readNumber(obj: JsonRecord | null, key: string): number | null {
  if (!obj) return null;
  const v = obj[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v)))
    return Number(v);
  return null;
}

function kindLabel(kind: string | null | undefined): string {
  if (!kind) return "مهمة";
  return KIND_AR[kind] ?? kind;
}

function phaseLabel(phase: string | null | undefined): string {
  if (!phase) return "—";
  return PHASE_AR[phase] ?? phase;
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return STATUS_AR[status] ?? status;
}

function severityLabel(severity: string | null | undefined): string {
  if (!severity) return "—";
  return SEVERITY_AR[severity.trim().toLowerCase()] ?? severity;
}

function fieldLabel(key: string): string {
  return FIELD_AR[key] ?? key;
}

function joinParts(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(" — ");
}

function poPart(po: string | null): string | null {
  return po ? `أمر العمل ${po}` : null;
}

function jsonEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}

function changedKeys(before: JsonRecord | null, after: JsonRecord | null): string[] {
  if (!before && !after) return [];
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const changed: string[] = [];
  for (const key of keys) {
    if (!jsonEqual(before?.[key], after?.[key])) changed.push(key);
  }
  return changed;
}

function orgChangedSections(
  before: JsonRecord | null,
  after: JsonRecord | null,
): string[] {
  const labels: string[] = [];
  for (const section of ORG_SECTION_AR) {
    if (section.keys.some((k) => !jsonEqual(before?.[k], after?.[k]))) {
      labels.push(section.label);
    }
  }
  return labels;
}

function countLeaves(value: unknown): number {
  if (value == null) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value === "object") return Object.keys(value as object).length;
  return 1;
}

export function auditActionLabel(action: string): string {
  const key = action.trim();
  if (!key) return "—";
  return (
    ACTION_AR[key] ??
    ACTION_AR[key.toUpperCase()] ??
    `إجراء غير مُعرَّف (${key})`
  );
}

function normalizeActorKey(id: string): string {
  return id.trim().toLowerCase().replace(/[{}]/g, "");
}

/** Prefer the API-resolved name for every system actor; staff map is a local fallback. */
export function auditActorLabel(
  actorId: string,
  namesById?: ReadonlyMap<string, string>,
  actorDisplayName?: string | null,
): string {
  const fromApi = actorDisplayName?.trim();
  if (fromApi) return fromApi;
  const id = actorId.trim();
  if (!id) return "—";
  if (id === "system") return "النظام";
  if (id === "unknown") return "غير معروف";
  const direct = namesById?.get(id)?.trim();
  if (direct) return direct;
  const normalized = normalizeActorKey(id);
  const byNorm = namesById?.get(normalized)?.trim();
  if (byNorm) return byNorm;
  return "مستخدم غير معروف";
}

/** Build a lookup that accepts raw and normalized Guid keys. */
export function buildActorNameMap(
  users: ReadonlyArray<{ id?: string | null; name?: string | null }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const u of users) {
    const id = u.id?.trim();
    const name = u.name?.trim();
    if (!id || !name) continue;
    map.set(id, name);
    map.set(normalizeActorKey(id), name);
  }
  return map;
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
  if (id.length > 12) return typeLabel;
  return `${typeLabel} · ${id}`;
}

/**
 * One-line Arabic description of what actually happened, derived from
 * action + before/after payloads (not a generic «عُدّل السجل»).
 */
export function auditDetailSummary(
  action: string,
  before: unknown,
  after: unknown,
): string {
  const beforeObj = asRecord(before);
  const afterObj = asRecord(after);
  const key = action.trim();

  switch (key) {
    case "case-study.party-submission.submitted": {
      const kind = kindLabel(readString(afterObj, "kind"));
      return joinParts([
        `تسليم ${kind} للمراجعة`,
        poPart(readString(afterObj, "poNumber")),
      ]);
    }
    case "case-study.party-submission.accepted": {
      const kind = kindLabel(readString(afterObj, "kind"));
      const by = readString(afterObj, "acceptedBy");
      return joinParts([
        `اعتماد ${kind} بعد المراجعة`,
        poPart(readString(afterObj, "poNumber")),
        by ? `بواسطة ${by}` : null,
      ]);
    }
    case "case-study.workflow-task.distribution-confirmed": {
      const kinds = asArray(afterObj?.childKinds)
        .map((k) => kindLabel(String(k)))
        .filter(Boolean);
      const count =
        readNumber(afterObj, "childCount") ??
        (kinds.length > 0 ? kinds.length : null);
      const kindsText =
        kinds.length > 0
          ? kinds.join("، ")
          : count != null
            ? `${count} أطراف`
            : null;
      return joinParts([
        "توزيع المهام على الأطراف",
        poPart(readString(afterObj, "poNumber")),
        kindsText,
        readString(afterObj, "phase")
          ? `المرحلة: ${phaseLabel(readString(afterObj, "phase"))}`
          : null,
      ]);
    }
    case "case-study.workflow-task.reopened": {
      return joinParts([
        "إعادة فتح المهمة",
        poPart(readString(afterObj, "poNumber") ?? readString(beforeObj, "poNumber")),
        readString(beforeObj, "status") && readString(afterObj, "status")
          ? `${statusLabel(readString(beforeObj, "status"))} ← ${statusLabel(readString(afterObj, "status"))}`
          : null,
      ]);
    }
    case "valuation.alert-overrides.updated": {
      const n = countLeaves(after);
      return n > 0
        ? `تخطّي ${n} تنبيه على التقييم`
        : "إلغاء تخطّي تنبيهات التقييم";
    }
    case "ORGANIZATION_SETTINGS_SAVED": {
      const sections = orgChangedSections(beforeObj, afterObj);
      if (sections.length === 0) {
        return before == null ? "إنشاء إعدادات الشركة" : "تعديل إعدادات الشركة";
      }
      return `تعديل إعدادات الشركة — القسم: ${sections.join("، ")}`;
    }
    case "CASE_STUDY_INFO_ROLES_SAVED": {
      const matrix = asRecord(afterObj?.matrix ?? afterObj);
      const n = matrix ? Object.keys(matrix).length : 0;
      return n > 0
        ? `تعديل من يجيب على أسئلة دراسة الحالة (${n} سؤال)`
        : "تعديل من يجيب على أسئلة دراسة الحالة";
    }
    case "FIELD_DICTIONARY_SAVED":
      return "تعديل أسماء الحقول في النظام";
    case "DIFFERENCE_FACTOR_CATALOG_SAVED": {
      const version = readNumber(afterObj, "version");
      return version != null
        ? `تعديل قائمة عوامل الفروق — الإصدار ${version}`
        : "تعديل قائمة عوامل الفروق";
    }
    case "failure.raised":
    case "failure.suspended":
    case "failure.resolved":
    case "failure.approved":
    case "failure.returned": {
      const actionWord = ACTION_AR[key] ?? "تحديث تعذّر";
      return joinParts([
        actionWord,
        poPart(readString(afterObj, "poNumber") ?? readString(beforeObj, "poNumber")),
        readString(afterObj, "severity")
          ? `النوع: ${severityLabel(readString(afterObj, "severity"))}`
          : null,
        readString(beforeObj, "status") && readString(afterObj, "status")
          ? `${statusLabel(readString(beforeObj, "status"))} ← ${statusLabel(readString(afterObj, "status"))}`
          : readString(afterObj, "status")
            ? `الحالة: ${statusLabel(readString(afterObj, "status"))}`
            : null,
      ]);
    }
    case "PRICING_TABLE_CREATED":
      return joinParts([
        "إضافة جدول أسعار",
        readString(afterObj, "name") ? `«${readString(afterObj, "name")}»` : null,
        readString(afterObj, "category")
          ? `التصنيف: ${readString(afterObj, "category")}`
          : null,
      ]);
    case "PRICING_TABLE_UPDATED": {
      const keys = changedKeys(beforeObj, afterObj).slice(0, 4);
      return keys.length > 0
        ? `تعديل جدول أسعار — ${keys.map(fieldLabel).join("، ")}`
        : "تعديل جدول أسعار";
    }
    case "PRICING_TABLE_ACTIVATED":
      return "تفعيل جدول الأسعار ليصبح سارياً";
    case "PRICING_TABLE_DEACTIVATED":
      return "إيقاف العمل بجدول الأسعار";
    case "PRICING_TABLE_DELETED":
      return "حذف جدول الأسعار نهائياً";
    case "PRICING_TABLE_REVISED":
      return "إصدار نسخة جديدة من جدول الأسعار";
    case "PRICING_ASSIGNMENTS_REPLACED":
      return "تغيير من يُطبَّق عليهم جدول الأسعار";
    case "PRICING_ASSIGNMENTS_RELINKED":
      return "إعادة ربط جدول الأسعار بأصحابه بعد تحديثه";
    case "USER_CREATED": {
      const name =
        readString(afterObj, "displayName") ?? readString(afterObj, "name");
      return name ? `إضافة مستخدم «${name}»` : "إضافة مستخدم جديد";
    }
    case "USER_UPDATED": {
      const keys = changedKeys(beforeObj, afterObj).slice(0, 4);
      if (keys.length === 0) return "تعديل بيانات مستخدم";
      return `تعديل مستخدم — ${keys.map(fieldLabel).join("، ")}`;
    }
    case "USER_DISABLED":
      return "إيقاف حساب مستخدم";
    case "USER_REACTIVATED":
      return "إعادة تفعيل حساب مستخدم";
    case "USER_UNLOCKED":
      return "فتح حساب مستخدم مقفل";
    case "valuation.report-issuance.reopened":
      return "إعادة فتح إصدار تقرير التقييم";
    case "valuation.report-issuance.code-corrected": {
      const from = readString(beforeObj, "depositCode");
      const to = readString(afterObj, "depositCode");
      return from && to
        ? `تصحيح رمز إيداع التقرير: ${from} ← ${to}`
        : "تصحيح رمز إيداع التقرير";
    }
    case "inspection.remote-scope.approved":
      return joinParts([
        "الموافقة على معاينة عن بُعد",
        poPart(readString(afterObj, "poNumber")),
      ]);
    case "case-study.enfaz-handover.cleared": {
      const choices = [
        afterObj?.reopenedStudy === true ? "تقرير الدراسة" : null,
        afterObj?.reopenedValuation === true ? "التقييم" : null,
      ].filter(Boolean);
      return joinParts([
        "إلغاء تسليم الملف لإنفاذ",
        choices.length > 0 ? `أُعيد فتح: ${choices.join("، ")}` : null,
        readString(afterObj, "reason") ? `السبب: ${readString(afterObj, "reason")}` : null,
      ]);
    }
    case "case-study.report.issued":
      return joinParts([
        "إصدار تقرير دراسة الحالة",
        poPart(readString(afterObj, "poNumber")),
      ]);
    case "case-study.report.reopened":
      return joinParts([
        "إعادة فتح تقرير دراسة الحالة",
        poPart(readString(afterObj, "poNumber")),
        readString(afterObj, "reason") ? `السبب: ${readString(afterObj, "reason")}` : null,
        afterObj?.enfazHandoverCleared === true ? "وأُلغي تسليم الملف لإنفاذ" : null,
      ]);
    case "case-study.party-submission.returned-with-impact": {
      const sections = asArray(afterObj?.sections).length;
      const affected = asArray(afterObj?.affected).length;
      return joinParts([
        "إرجاع المعاينة للمعاين",
        poPart(readString(afterObj, "poNumber")),
        sections > 0 ? `${sections} قسم للتصحيح` : null,
        affected > 0 ? `${affected} طرف متأثر` : null,
        readString(afterObj, "returnNote")
          ? `السبب: ${readString(afterObj, "returnNote")}`
          : null,
      ]);
    }
    case "failures.survey-freeze.lifted":
      return joinParts([
        "رفع إيقاف الرفع المساحي",
        poPart(readString(afterObj, "poNumber")),
        readString(afterObj, "reason") ? `السبب: ${readString(afterObj, "reason")}` : null,
      ]);
    case "case-study.post-enfaz-decision.recorded":
      return joinParts([
        "تسجيل قرار بعد التسليم لإنفاذ",
        poPart(readString(afterObj, "poNumber")),
        readString(afterObj, "decision")
          ? `القرار: ${readString(afterObj, "decision")}`
          : null,
      ]);
    default:
      break;
  }

  // Generic status/phase transitions when payloads carry them.
  const beforeStatus = readString(beforeObj, "status");
  const afterStatus = readString(afterObj, "status");
  if (beforeStatus && afterStatus && beforeStatus !== afterStatus) {
    return joinParts([
      `${statusLabel(beforeStatus)} ← ${statusLabel(afterStatus)}`,
      poPart(readString(afterObj, "poNumber") ?? readString(beforeObj, "poNumber")),
    ]);
  }

  const beforePhase = readString(beforeObj, "phase");
  const afterPhase = readString(afterObj, "phase");
  if (beforePhase && afterPhase && beforePhase !== afterPhase) {
    return joinParts([
      `المرحلة: ${phaseLabel(beforePhase)} ← ${phaseLabel(afterPhase)}`,
      poPart(readString(afterObj, "poNumber")),
    ]);
  }

  const keys = changedKeys(beforeObj, afterObj).slice(0, 4);
  if (keys.length > 0 && beforeObj && afterObj) {
    return `تعديل: ${keys.map(fieldLabel).join("، ")}`;
  }

  if (before == null && after != null) return "إضافة سجل جديد";
  if (before != null && after == null) return "حذف السجل";
  if (before != null && after != null) return "تعديل على السجل";
  return "—";
}

export function auditDetailTooltip(before: unknown, after: unknown): string {
  try {
    return JSON.stringify({ قبل: before, بعد: after });
  } catch {
    return "—";
  }
}
