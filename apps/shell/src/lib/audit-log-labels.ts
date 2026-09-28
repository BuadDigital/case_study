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
  "case-study.party-submission.submitted": "الطرف أنهى مهمته وسلّمها للمراجعة",
  "case-study.party-submission.accepted": "المسؤول اعتمد عمل الطرف بعد المراجعة",
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
  OrganizationSettings: "إعدادات المنشأة",
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
  PartyTaskSubmission: "مهمة طرف",
  party_submission: "مهمة طرف",
  ValuationReconciliation: "تسوية التقييم",
  valuation_report: "تقرير التقييم",
  inspection: "معاينة",
  PartyFeePricingTable: "جدول تسعير الأطراف",
  PartyFeePricingAssignment: "إسناد تسعير الأطراف",
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
    `إجراء غير معروف (${key})`
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
  return "مستخدم غير معروف في السجل";
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
        `${kind}: الطرف أنهى العمل وسلّمه للمراجعة`,
        poPart(readString(afterObj, "poNumber")),
      ]);
    }
    case "case-study.party-submission.accepted": {
      const kind = kindLabel(readString(afterObj, "kind"));
      const by = readString(afterObj, "acceptedBy");
      return joinParts([
        `${kind}: المسؤول راجع العمل واعتمده`,
        poPart(readString(afterObj, "poNumber")),
        by ? `اعتمده ${by}` : null,
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
        "تأكيد توزيع الأطراف",
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
        ? `تحديث تجاوزات تنبيهات التقييم (${n} بند)`
        : "مسح تجاوزات تنبيهات التقييم";
    }
    case "ORGANIZATION_SETTINGS_SAVED": {
      const sections = orgChangedSections(beforeObj, afterObj);
      if (sections.length === 0) {
        return before == null ? "إنشاء إعدادات المنشأة" : "حفظ إعدادات المنشأة";
      }
      return `حفظ إعدادات المنشأة — تغيّر: ${sections.join("، ")}`;
    }
    case "CASE_STUDY_INFO_ROLES_SAVED": {
      const matrix = asRecord(afterObj?.matrix ?? afterObj);
      const n = matrix ? Object.keys(matrix).length : 0;
      return n > 0
        ? `حفظ مصفوفة علاقة المستخدم بالمعلومة (${n} سؤال)`
        : "حفظ مصفوفة علاقة المستخدم بالمعلومة";
    }
    case "FIELD_DICTIONARY_SAVED":
      return "حفظ قاموس الحقول النظامية";
    case "DIFFERENCE_FACTOR_CATALOG_SAVED": {
      const version = readNumber(afterObj, "version");
      return version != null
        ? `حفظ كتالوج عوامل الفرق — الإصدار ${version}`
        : "حفظ كتالوج عوامل الفرق";
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
          ? `الخطورة: ${readString(afterObj, "severity")}`
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
        "إنشاء جدول تسعير",
        readString(afterObj, "name") ? `«${readString(afterObj, "name")}»` : null,
        readString(afterObj, "category")
          ? `التصنيف: ${readString(afterObj, "category")}`
          : null,
      ]);
    case "PRICING_TABLE_UPDATED": {
      const keys = changedKeys(beforeObj, afterObj).slice(0, 4);
      return keys.length > 0
        ? `تعديل جدول تسعير — ${keys.map(fieldLabel).join("، ")}`
        : "تعديل جدول تسعير";
    }
    case "PRICING_TABLE_ACTIVATED":
      return "تفعيل جدول التسعير ليصبح سارياً";
    case "PRICING_TABLE_DEACTIVATED":
      return "تعطيل جدول التسعير";
    case "PRICING_TABLE_DELETED":
      return "حذف جدول التسعير نهائياً";
    case "PRICING_TABLE_REVISED":
      return "إصدار مراجعة جديدة لجدول التسعير";
    case "PRICING_ASSIGNMENTS_REPLACED":
      return "استبدال قائمة المسند إليهم على جدول التسعير";
    case "PRICING_ASSIGNMENTS_RELINKED":
      return "إعادة ربط إسناد التسعير بعد مراجعة الجدول";
    case "USER_CREATED": {
      const name =
        readString(afterObj, "displayName") ?? readString(afterObj, "name");
      return name ? `إنشاء مستخدم «${name}»` : "إنشاء مستخدم جديد";
    }
    case "USER_UPDATED": {
      const keys = changedKeys(beforeObj, afterObj).slice(0, 4);
      if (keys.length === 0) return "تعديل بيانات مستخدم";
      return `تعديل مستخدم — ${keys.map(fieldLabel).join("، ")}`;
    }
    case "USER_DISABLED":
      return "تعطيل حساب مستخدم";
    case "USER_REACTIVATED":
      return "إعادة تفعيل حساب مستخدم";
    case "USER_UNLOCKED":
      return "إلغاء قفل حساب مستخدم";
    case "valuation.report-issuance.reopened":
      return "إعادة فتح إصدار تقرير التقييم";
    case "inspection.remote-scope.approved":
      return joinParts([
        "اعتماد نطاق معاينة عن بُعد",
        poPart(readString(afterObj, "poNumber")),
      ]);
    case "case-study.post-enfaz-decision.recorded":
      return joinParts([
        "تسجيل قرار ما بعد إنفاذ",
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
    return `تغيّر: ${keys.map(fieldLabel).join("، ")}`;
  }

  if (before == null && after != null) return "أُنشئ سجل جديد";
  if (before != null && after == null) return "حُذف السجل";
  if (before != null && after != null) return "عُدّل السجل";
  return "—";
}

export function auditDetailTooltip(before: unknown, after: unknown): string {
  try {
    return JSON.stringify({ قبل: before, بعد: after });
  } catch {
    return "—";
  }
}
