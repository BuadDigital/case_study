export type GovernmentReviewVisitStatus =
  | "completed"
  | "scheduled"
  | "blocked";

export type GovernmentReviewKeysStatus =
  | "received"
  | "pending"
  | "not_required";

/** هل سُلِّم المفتاح من المراجع للمعاين الميداني */
export type GovernmentReviewKeyHandedToInspector = "yes" | "no";

export type GovernmentReviewSubmissionStatus =
  | "draft"
  | "submitted"
  | "reopened";

export type GovernmentReviewKeysProofFile = {
  id: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
};

export type GovernmentReviewSubmission = {
  taskId: string;
  propertyId: string;
  poNumber: string;
  visitStatus: GovernmentReviewVisitStatus | "";
  visitDate: string;
  courtName: string;
  keysStatus: GovernmentReviewKeysStatus | "";
  keysDescription: string;
  /** تسليم المفتاح للمعاين — مطلوب لإتمام المعاملة */
  keyHandedToInspector: GovernmentReviewKeyHandedToInspector | "";
  accessBlockReason: string;
  reviewNotes: string;
  /** حقول الرفع لإنفاذ — المراجع الحكومي */
  propertyZoneStatus: string;
  keysProofFiles: GovernmentReviewKeysProofFile[];
  /** @deprecated migrated to keysProofFiles on load */
  keysProofFileName?: string;
  confirmed: boolean;
  status: GovernmentReviewSubmissionStatus;
  returnNote?: string;
  submittedAtUtc: string | null;
  updatedAtUtc: string;
};

export function createGovernmentReviewDraft(input: {
  taskId: string;
  propertyId: string;
  poNumber: string;
  courtName?: string;
}): GovernmentReviewSubmission {
  const now = new Date().toISOString();
  return {
    taskId: input.taskId,
    propertyId: input.propertyId,
    poNumber: input.poNumber,
    visitStatus: "",
    visitDate: "",
    courtName: input.courtName?.trim() ?? "",
    keysStatus: "",
    keysDescription: "",
    keyHandedToInspector: "",
    accessBlockReason: "",
    reviewNotes: "",
    propertyZoneStatus: "",
    keysProofFiles: [],
    confirmed: false,
    status: "draft",
    submittedAtUtc: null,
    updatedAtUtc: now,
  };
}

export function isGovernmentReviewFormLocked(
  status: GovernmentReviewSubmissionStatus,
): boolean {
  return status === "submitted";
}

/** Visit not done yet — save draft only; do not finalize the party task. */
export function isGovernmentReviewAwaitingVisit(
  visitStatus: GovernmentReviewVisitStatus | "",
): boolean {
  return visitStatus === "scheduled" || visitStatus === "blocked";
}

/** المفتاح لم يُسلَّم للمعاين — تبقى المعاملة قيد التنفيذ. */
export function isGovernmentReviewAwaitingKeyHandoff(
  submission: Pick<
    GovernmentReviewSubmission,
    "visitStatus" | "keyHandedToInspector" | "keysStatus"
  >,
): boolean {
  if (submission.keysStatus === "not_required") return false;
  return (
    submission.visitStatus === "completed" &&
    submission.keyHandedToInspector === "no"
  );
}

/** Full submission (إتمام) — زيارة مكتملة + تسليم مفتاح، أو مفاتيح غير مطلوبة. */
export function canFinalizeGovernmentReview(
  submission: Pick<
    GovernmentReviewSubmission,
    "visitStatus" | "keyHandedToInspector" | "keysStatus"
  >,
): boolean {
  if (submission.visitStatus !== "completed") return false;
  if (submission.keysStatus === "not_required") return true;
  return submission.keyHandedToInspector === "yes";
}

export function governmentReviewVisitStatusLabel(
  value: GovernmentReviewVisitStatus | "",
): string {
  if (value === "completed") return "تمت الزيارة";
  if (value === "scheduled") return "بانتظار الموعد";
  if (value === "blocked") return "تعذر الوصول";
  return "—";
}

export function governmentReviewKeysStatusLabel(
  value: GovernmentReviewKeysStatus | "",
): string {
  if (value === "received") return "تم استلام المفاتيح";
  if (value === "pending") return "لم تُسلَّم بعد";
  if (value === "not_required") return "غير مطلوبة";
  return "—";
}

export function governmentReviewKeyHandedToInspectorLabel(
  value: GovernmentReviewKeyHandedToInspector | "",
): string {
  if (value === "yes") return "نعم — تم التسليم للمعاين";
  if (value === "no") return "لا — لم يُسلَّم بعد";
  return "—";
}

export function governmentReviewStatusLabel(
  status: GovernmentReviewSubmissionStatus,
): string {
  if (status === "submitted") return "مُرسَل";
  if (status === "reopened") return "مُعاد للتصحيح";
  return "قيد العمل";
}

export function normalizeGovernmentReviewKeysProofFiles(
  payload: Partial<GovernmentReviewSubmission>,
): GovernmentReviewKeysProofFile[] {
  const files = payload.keysProofFiles ?? [];
  if (files.length > 0) {
    return files.filter((f) => f.fileName?.trim());
  }
  const legacy = payload.keysProofFileName?.trim();
  if (legacy) {
    return [
      {
        id: "legacy",
        fileName: legacy,
        mimeType: "application/octet-stream",
        dataUrl: "",
      },
    ];
  }
  return [];
}

export function formatGovernmentReviewKeysProofLabel(
  files: GovernmentReviewKeysProofFile[],
): string {
  if (files.length === 0) return "";
  if (files.length === 1) return files[0]!.fileName;
  return `${files.length} مرفقات: ${files.map((f) => f.fileName).join("، ")}`;
}

export function normalizeGovernmentReviewSubmission(
  payload: Partial<GovernmentReviewSubmission>,
): Partial<GovernmentReviewSubmission> & {
  keysProofFiles: GovernmentReviewKeysProofFile[];
  keyHandedToInspector: GovernmentReviewKeyHandedToInspector | "";
} {
  const keysProofFiles = normalizeGovernmentReviewKeysProofFiles(payload);
  const { keysProofFileName: _legacy, ...rest } = payload;
  const keyHandedToInspector =
    payload.keyHandedToInspector === "yes" ||
    payload.keyHandedToInspector === "no"
      ? payload.keyHandedToInspector
      : "";
  return { ...rest, keysProofFiles, keyHandedToInspector };
}

/** Overlay from PropertyKeyGateResolver onto legacy submission fields. */
export type GovernmentReviewKeyGateOverlay = {
  keysStatus?: string;
  keyHandedToInspector?: string;
  keyAvailable?: boolean;
  source?: string;
  envelopeMissingWarning?: boolean;
  studyHoldStatus?: string;
};

/**
 * Prefer envelope/court-access gate when present; keep submission as fallback.
 * Does not mutate the original draft — returns a view for finalize/queue badges.
 */
export function mergeGovernmentReviewWithKeyGate(
  submission: Pick<
    GovernmentReviewSubmission,
    "visitStatus" | "keyHandedToInspector" | "keysStatus"
  >,
  gate?: GovernmentReviewKeyGateOverlay | null,
): Pick<
  GovernmentReviewSubmission,
  "visitStatus" | "keyHandedToInspector" | "keysStatus"
> & {
  keyAvailable: boolean;
  envelopeMissingWarning: boolean;
  gateSource: string;
} {
  const source = gate?.source ?? "none";
  const preferGate = source === "envelope" || source === "court_access";

  const keysStatus = (
    preferGate && gate?.keysStatus
      ? gate.keysStatus
      : submission.keysStatus
  ) as GovernmentReviewKeysStatus | "";

  const keyHandedToInspector = (
    preferGate && gate?.keyHandedToInspector
      ? gate.keyHandedToInspector
      : submission.keyHandedToInspector
  ) as GovernmentReviewKeyHandedToInspector | "";

  const keyAvailable =
    gate?.keyAvailable === true ||
    keyHandedToInspector === "yes" ||
    keysStatus === "not_required" ||
    keysStatus === "received";

  const envelopeMissingWarning =
    gate?.envelopeMissingWarning === true ||
    (submission.keysStatus === "received" &&
      source !== "envelope" &&
      source !== "court_access");

  return {
    visitStatus: submission.visitStatus,
    keysStatus,
    keyHandedToInspector,
    keyAvailable,
    envelopeMissingWarning,
    gateSource: source,
  };
}

/** Finalize using gate overlay when envelope/court-access is the source of truth. */
export function canFinalizeGovernmentReviewWithGate(
  submission: Pick<
    GovernmentReviewSubmission,
    "visitStatus" | "keyHandedToInspector" | "keysStatus"
  >,
  gate?: GovernmentReviewKeyGateOverlay | null,
): boolean {
  return canFinalizeGovernmentReview(
    mergeGovernmentReviewWithKeyGate(submission, gate),
  );
}
