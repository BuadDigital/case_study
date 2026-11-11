import type { RoleId } from "@platform/types";
import { isSuperAdmin } from "@platform/app-shared/app-data/role-access";
import {
  holdsSubRole,
  type StaffAccess,
} from "@platform/app-shared/app-data/case-specialist-sub-roles";

export type { StaffAccess };

// Ruling 2026-11-02: each case-specialist decision belongs to one sub-role — coordination,
// study or review — held by any number of specialists (shared queues, never by assignment).
// Helpers that read a sub-role take `StaffAccess` (`useAppAccess().access`); the rest take the role.

/**
 * Receive a work order from Enfaz — the section supervisor and the coordination sub-role (not the
 * CDO); mirrors `PoRoleMatrixRules.CanReceivePo`.
 */
export function canReceivePo(access: StaffAccess): boolean {
  return access.role === "section-supervisor" || holdsSubRole(access, "coordination");
}

// «تعذّر نهائي» and «تعذّر داخلي» — the case specialist, the section supervisor and the CDO
// (Omar 2026-11-11); the rule lives with the failure degrees.
export {
  canRaiseInternalFailure,
  canRecordFinalFailure,
} from "@failures/mfe/lib/failure-degrees";

/**
 * Approve / reject a «إلغاء المعاملة» request and reactivate a cancelled transaction — the section
 * supervisor and the CDO. Mirrors `PoRoleMatrixRules.CanDecideTransactionCancel`.
 */
export function canDecideTransactionCancel(role: RoleId): boolean {
  return role === "cdo" || role === "section-supervisor";
}

/**
 * Ask for «إلغاء المعاملة» — the coordination sub-role; the supervisor and the CDO too (their
 * request is approved at once). Mirrors `PoRoleMatrixRules.CanRequestTransactionCancel`.
 */
export function canRequestTransactionCancel(access: StaffAccess): boolean {
  return canDecideTransactionCancel(access.role) || holdsSubRole(access, "coordination");
}

export function canEditPoHeader(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "section-supervisor";
}

/**
 * The assignment specialist's name is provisional at receipt and confirmed later — the coordination
 * sub-role corrects it, beside the header editors. Mirrors `PoRoleMatrixRules.CanEditAssignmentSpecialist`.
 */
export function canEditAssignmentSpecialist(access: StaffAccess): boolean {
  return canEditPoHeader(access.role) || holdsSubRole(access, "coordination");
}

/**
 * Register a property's initial data (Enfaz stage) and bourse inquiry, link a property, and advance
 * the task after them — the coordination sub-role and the CDO. Mirrors `PoRoleMatrixRules.CanAdvanceIntake`.
 */
export function canAdvanceIntake(access: StaffAccess): boolean {
  return isSuperAdmin(access.role) || holdsSubRole(access, "coordination");
}

/**
 * Edit a property's data and documents after intake — every case-specialist sub-role, the appraiser
 * and the CDO (ruling 2026-11-02, with a server-side change log). Mirrors `PoRoleMatrixRules.CanEditPropertyData`.
 */
export function canEditPropertyData(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "case-specialist" || role === "real-estate-appraiser";
}

/**
 * Send a task one phase back (distribution → bourse → Enfaz) — the coordination sub-role, the CDO
 * and the section supervisor; mirrors `CanRevertTaskPhase`.
 */
export function canRevertTaskPhase(access: StaffAccess): boolean {
  return (
    isSuperAdmin(access.role) ||
    access.role === "section-supervisor" ||
    holdsSubRole(access, "coordination")
  );
}

/**
 * Confirm or edit a transaction's distribution — the coordination sub-role, the section
 * supervisor, the general manager and the CDO. Mirrors `PoRoleMatrixRules.CanDistribute`.
 */
export function canDistribute(access: StaffAccess): boolean {
  return (
    isSuperAdmin(access.role) ||
    access.role === "section-supervisor" ||
    access.role === "general-manager" ||
    holdsSubRole(access, "coordination")
  );
}

/**
 * «إرسال المعاملة للدراسة» — the coordination sub-role, the section supervisor and the CDO; mirrors
 * `PoRoleMatrixRules.CanFormallyReceive`.
 */
export function canFormallyReceive(access: StaffAccess): boolean {
  return (
    isSuperAdmin(access.role) ||
    access.role === "section-supervisor" ||
    holdsSubRole(access, "coordination")
  );
}

export function isCaseStudySpecialist(role: RoleId): boolean {
  return role === "case-specialist";
}

/**
 * The technical acceptance of party work — accept, return to the inspector, reopen a package,
 * write «مكونات العقار» — every case-specialist sub-role (Omar 2026-11-08: the three share all of the
 * transaction's data and edit it at the same level) and management. Mirrors
 * `PoRoleMatrixRules.CanAcceptPartyWork`.
 */
export function canAcceptPartyWork(access: StaffAccess): boolean {
  return (
    isSuperAdmin(access.role) ||
    access.role === "section-supervisor" ||
    access.role === "general-manager" ||
    access.role === "case-specialist"
  );
}

/** Send the study to review («إرسال الدراسة للمراجع والمقيّم») — the study sub-role. Mirrors `CanFinishStudy`. */
export const canFinishStudy = (access: StaffAccess) => holdsSubRole(access, "study");
/**
 * Reopen the sent study (Omar 2026-11-08): the study takes it back while review has not approved it;
 * review returns it to the study at any time («إرجاع للدراسة»). Mirrors `CanReopenCaseStudyReport`;
 * the server refuses the study once review approved.
 */
export const canReopenCaseStudyReport = (access: StaffAccess) =>
  holdsSubRole(access, "study") || holdsSubRole(access, "review");
export const canDecideAppraisalRecall = (access: StaffAccess) => holdsSubRole(access, "study");
export const canPrepareReportDraft = (access: StaffAccess) => holdsSubRole(access, "study");
/** Record the Enfaz upload and take a returned transaction back — the review sub-role. */
export const canHandOverToEnfaz = (access: StaffAccess) => holdsSubRole(access, "review");
/**
 * «إعادة فتح المعاملة» after review approved it (Omar 2026-11-05): any case specialist whatever his sub-role,
 * the section supervisor and the CDO. Mirrors `PoRoleMatrixRules.CanReopenTransaction`.
 */
export const canReopenTransaction = (access: StaffAccess) =>
  isSuperAdmin(access.role) || access.role === "section-supervisor" || access.role === "case-specialist";
/** Record the «قيمة» deposit and open a new version (n+1) — the review sub-role. */
export const canRecordValuationDeposit = (access: StaffAccess) => holdsSubRole(access, "review");
/**
 * Review's decisions (Omar 2026-11-08): approve the sent study or return it, accept the appraiser's value
 * or return it, issue the draft to the appraiser and pull it back. Mirrors `CanReviewTransaction`.
 */
export const canReviewTransaction = (access: StaffAccess) => holdsSubRole(access, "review");
export const canReopenValuationReport = (access: StaffAccess) => holdsSubRole(access, "review");
/** Lift the survey freeze of a failure — coordination, which follows failures. */
export const canLiftSurveyFreeze = (access: StaffAccess) => holdsSubRole(access, "coordination");
/** Merge deeds / take one out — the stage owner: coordination or study. Mirrors `CanMergeTransactions`. */
export const canMergeTransactions = (access: StaffAccess) =>
  holdsSubRole(access, "coordination") || holdsSubRole(access, "study");

/**
 * The stage gate of a merge, an unmerge or a link-kind change: coordination before the formal
 * receipt, study after it (ruling 2026-11-02). Mirrors `PoRoleMatrixRules.CanMergeAtStage`.
 */
export const canMergeAtStage = (access: StaffAccess, transactionReceived: boolean) =>
  holdsSubRole(access, transactionReceived ? "study" : "coordination");

/** View details via the eye button — not for the case-study specialist (opens from the row or edit). */
export function canViewPoEye(role: RoleId): boolean {
  return isSuperAdmin(role) || !isCaseStudySpecialist(role);
}

export function canDeletePo(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "section-supervisor";
}

export function canDeleteProperty(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "section-supervisor";
}

/** Delete a transaction from primary-data / bourse / distribution queues — supervisor or admin only. */
export function canDeleteTransaction(role: RoleId): boolean {
  return canDeleteProperty(role);
}

/** Supervisor and specialist (any sub-role — whoever finds it) may raise a failure from the property screen. */
export function canRaisePropertyFailure(role: RoleId): boolean {
  return canEditPropertyData(role) || canEditPoHeader(role);
}

/** Timeline and party status on property detail — case-study specialist, section supervisor, and system admin (not the appraiser). */
export function canViewPropertyTimelineRail(role: RoleId): boolean {
  return canRaisePropertyFailure(role);
}

/**
 * Upload / classify governed documents from the property documents tab —
 * mirrors backend `PoRoleMatrixRules.CanUploadPropertyDocuments`.
 */
export function canUploadPropertyDocuments(role: RoleId): boolean {
  return (
    isSuperAdmin(role) ||
    role === "case-specialist" ||
    role === "section-supervisor" ||
    role === "real-estate-appraiser"
  );
}

/**
 * Upload a «مستند ذو قيمة» — mirrors backend `PoRoleMatrixRules.CanUploadValuedDocuments`:
 * the specialist, the appraiser, management, the field inspector and the engineering office.
 */
export function canUploadValuedDocuments(role: RoleId): boolean {
  return (
    isSuperAdmin(role) ||
    role === "case-specialist" ||
    role === "real-estate-appraiser" ||
    role === "section-supervisor" ||
    role === "general-manager" ||
    role === "field-inspector" ||
    role === "engineering-office"
  );
}

/** Approve / reject a «مستند ذو قيمة» — the study sub-role; mirrors `PoRoleMatrixRules.CanReviewValuedDocuments`. */
export function canReviewValuedDocuments(access: StaffAccess): boolean {
  return isSuperAdmin(access.role) || holdsSubRole(access, "study");
}

/**
 * «تجاوز المكتب الهندسي» (Omar 2026-11-11) — the study sub-role decides whether the engineering office
 * is needed before the study reaches the appraiser; section-supervisor+ may too. Mirrors
 * `EngineeringSurveySettlementRules.CanSkip`.
 */
export function canSkipEngineeringSurvey(access: StaffAccess): boolean {
  return (
    isSuperAdmin(access.role) ||
    access.role === "section-supervisor" ||
    access.role === "general-manager" ||
    holdsSubRole(access, "study")
  );
}

/**
 * Reassign case-study parties (and add the engineering survey) — section-supervisor+ and the
 * coordination sub-role; mirrors `WorkflowTaskLifecycleRules.CanRedistributeParties`.
 */
export function canRedistributeParties(access: StaffAccess): boolean {
  return (
    isSuperAdmin(access.role) ||
    access.role === "section-supervisor" ||
    access.role === "general-manager" ||
    holdsSubRole(access, "coordination")
  );
}
