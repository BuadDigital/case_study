export type EvaluatorSubmissionStatus =
  | "draft"
  | "submitted"
  | "reopened"
  | "completed";

export type SharedDeedScope = "full" | "part";

export type EvaluatorChecklistAnswers = {
  q_plan_match: boolean | null;
  q_excess_zoning: boolean | null;
  q_land_waqf: boolean | null;
  q_property_waqf: boolean | null;
  q_expropriation: boolean | null;
  q_property_use_verified: boolean | null;
  q_agriculture_inquiry: boolean | null;
  q_overlap: boolean | null;
  q_shared_building: boolean | null;
  q_environmental_factors: boolean | null;
  q_unregistered_additions: boolean | null;
  q_shared_deed: boolean | null;
  shared_deed_scope: SharedDeedScope | null;
  shared_deed_percentage: string;
  q_lease_exists: boolean | null;
  q_lease_active: boolean | null;
  q_technical_notes_exists: boolean | null;
  technical_notes_text: string;
};

export type EvaluatorReportWorkerRole = "معد" | "مراجع" | "معتمد";

export type EvaluatorReportWorker = {
  id: string;
  role: EvaluatorReportWorkerRole | "";
  name: string;
  licenseNumber: string;
  licenseDate: string;
  licenseFileName: string | null;
};

/** Case Study.html settings defaults for read-only Infath contact fields. */
export const DEFAULT_APPRAISER_ADDRESS =
  "جدة — حي الروضة، شارع الأمير سلطان، مبنى 42";
export const DEFAULT_APPRAISER_PHONE = "0126612345";

export type EvaluatorSubmission = {
  taskId: string;
  propertyId: string;
  poNumber: string;
  status: EvaluatorSubmissionStatus;
  /** رقم التقرير (المقياس) — Case Study.html `reportNo`. */
  reportNo: string;
  evaluatorPrice: string;
  evaluatorNotes: string;
  checklist: EvaluatorChecklistAnswers;
  reportFileName: string | null;
  /** حقول الرفع لإنفاذ — المقيّم */
  appraisalDate: string;
  valuationMethod: string;
  valueBasis: string;
  demandLevel: string;
  landValue: string;
  buildingValue: string;
  forcedSaleDiscountPct: string;
  searchScopeNotes: string;
  planImageFileName: string | null;
  appraiserAddress: string;
  appraiserPhone: string;
  reportIssueDate: string;
  /** إقرار الاستقلالية وعدم تضارب المصالح */
  independenceDeclared: boolean;
  /** بيانات العاملين على التقرير (معد / مراجع / معتمد) */
  reportWorkers: EvaluatorReportWorker[];
  /** تأكيد مراجعة بيانات الأصل المعروضة من مصادرها (معاين / مكتب هندسي / أخصائي / مراجع) */
  assetDataConfirmed: boolean;
  /** ملاحظات التباين عند عدم تأكيد بيانات الأصل كما هي */
  assetDataVarianceNotes: string;
  /** مرفق التقييم المعتمد الموقّع (البيانات الختامية) — اختياري */
  signedAppraisalFileName: string | null;
  submittedAtUtc: string | null;
  updatedAtUtc: string;
};

export type EvaluatorBooleanQuestion = {
  id: keyof Pick<
    EvaluatorChecklistAnswers,
    | "q_plan_match"
    | "q_excess_zoning"
    | "q_land_waqf"
    | "q_property_waqf"
    | "q_expropriation"
    | "q_property_use_verified"
    | "q_agriculture_inquiry"
    | "q_overlap"
    | "q_shared_building"
    | "q_environmental_factors"
    | "q_unregistered_additions"
    | "q_shared_deed"
    | "q_lease_exists"
    | "q_technical_notes_exists"
  >;
  label: string;
};

export const EVALUATOR_SIMPLE_QUESTIONS: EvaluatorBooleanQuestion[] = [
  { id: "q_plan_match", label: "هل رقم المخطط مطابق للصك؟" },
  { id: "q_excess_zoning", label: "هل القطعة زائدة تنظيمية؟" },
  { id: "q_land_waqf", label: "هل الأرض موقوفة؟" },
  { id: "q_property_waqf", label: "هل العقار موقوف؟" },
  { id: "q_expropriation", label: "هل يوجد نزع على منطقة العقار؟" },
  {
    id: "q_property_use_verified",
    label: "هل تم التأكد من استخدام العقار؟",
  },
  {
    id: "q_agriculture_inquiry",
    label: "هل تم الاستعلام من وزارة الزراعة حيال الأرض الزراعية؟",
  },
  { id: "q_overlap", label: "هل يوجد تداخل في الأصل؟" },
  { id: "q_shared_building", label: "هل يوجد على الأصل مبنى مشترك؟" },
  {
    id: "q_environmental_factors",
    label:
      "هل هناك أي عوامل بيئية أو تنظيمية قد تؤثر على العقار؟ (مثل طريق مستقبلي أو قيود بناء)",
  },
  {
    id: "q_unregistered_additions",
    label: "هل العقار يحتوي على أي إضافات غير مسجلة في الصك؟",
  },
];

export const EVALUATOR_CONDITIONAL_QUESTIONS: EvaluatorBooleanQuestion[] = [
  { id: "q_shared_deed", label: "هل الصك مشاع؟" },
  { id: "q_lease_exists", label: "هل يوجد عقد إيجار؟" },
  {
    id: "q_technical_notes_exists",
    label: "هل يوجد ملاحظات فنية قد تؤثر على قيمة العقار؟",
  },
];

export const MAX_EVALUATOR_PDF_BYTES = 20 * 1024 * 1024;

export const EVALUATOR_WORKER_ROLES: EvaluatorReportWorkerRole[] = [
  "معد",
  "مراجع",
  "معتمد",
];

export function createEmptyReportWorker(
  role: EvaluatorReportWorkerRole | "" = "معد",
): EvaluatorReportWorker {
  return {
    id: `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    name: "",
    licenseNumber: "",
    licenseDate: "",
    licenseFileName: null,
  };
}

export function emptyChecklist(): EvaluatorChecklistAnswers {
  return {
    q_plan_match: null,
    q_excess_zoning: null,
    q_land_waqf: null,
    q_property_waqf: null,
    q_expropriation: null,
    q_property_use_verified: null,
    q_agriculture_inquiry: null,
    q_overlap: null,
    q_shared_building: null,
    q_environmental_factors: null,
    q_unregistered_additions: null,
    q_shared_deed: null,
    shared_deed_scope: null,
    shared_deed_percentage: "",
    q_lease_exists: null,
    q_lease_active: null,
    q_technical_notes_exists: null,
    technical_notes_text: "",
  };
}

export function createEvaluatorDraft(input: {
  taskId: string;
  propertyId: string;
  poNumber: string;
}): EvaluatorSubmission {
  const now = new Date().toISOString();
  return {
    ...input,
    status: "draft",
    reportNo: "",
    evaluatorPrice: "",
    evaluatorNotes: "",
    checklist: emptyChecklist(),
    reportFileName: null,
    appraisalDate: "",
    valuationMethod: "طريقة البيوع المقارنة",
    valueBasis: "القيمة السوقية",
    demandLevel: "",
    landValue: "0",
    buildingValue: "0",
    forcedSaleDiscountPct: "20",
    searchScopeNotes: "",
    planImageFileName: null,
    appraiserAddress: DEFAULT_APPRAISER_ADDRESS,
    appraiserPhone: DEFAULT_APPRAISER_PHONE,
    reportIssueDate: "",
    independenceDeclared: false,
    reportWorkers: [createEmptyReportWorker("معد")],
    assetDataConfirmed: false,
    assetDataVarianceNotes: "",
    signedAppraisalFileName: null,
    submittedAtUtc: null,
    updatedAtUtc: now,
  };
}

export function evaluatorStatusLabel(status: EvaluatorSubmissionStatus): string {
  if (status === "draft") return "مسودة";
  if (status === "submitted") return "مُرسَل للأخصائي";
  if (status === "reopened") return "معادة للتصحيح";
  return "مكتمل";
}

export function formatEvaluatorPriceDisplay(raw: string): string {
  const n = Number.parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function checklistAnswerLabel(value: boolean | null): string {
  if (value === true) return "نعم";
  if (value === false) return "لا";
  return "—";
}
