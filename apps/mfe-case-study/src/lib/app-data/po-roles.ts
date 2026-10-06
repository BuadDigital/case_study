import type { RoleId } from "@platform/types";
import { isSuperAdmin } from "@platform/app-shared/app-data/role-access";

/** Receive a work order from Enfaz — specialist and supervisor only (not the CDO); mirrors `PoRoleMatrixRules.CanReceivePo`. */
export function canReceivePo(role: RoleId): boolean {
  return role === "section-supervisor" || role === "case-specialist";
}

export function canEditPoHeader(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "section-supervisor";
}

/**
 * Write a property's initial data (Enfaz stage) and bourse inquiry, and advance the task after them —
 * any case specialist, by role, and the system admin (CDO) as before. Mirrors `PoRoleMatrixRules.CanEditProperty`.
 */
export function canEditProperty(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "case-specialist";
}

/** Send a task one phase back (distribution → bourse → Enfaz) — case specialist, CDO, section supervisor; mirrors `CanRevertTaskPhase`. */
export function canRevertTaskPhase(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "case-specialist" || role === "section-supervisor";
}

export function isCaseStudySpecialist(role: RoleId): boolean {
  return role === "case-specialist";
}

/**
 * The case specialist's own decisions on a study — issuing / reopening the case-study report,
 * deciding an appraisal recall, handing over to Enfaz and taking it back, lifting the survey freeze.
 * Any case specialist, by role; the supervisor, general manager and CDO do not take them.
 * Mirrors `PoRoleMatrixRules.IsCaseSpecialistDecision` (and its Can… wrappers).
 */
export function canMakeSpecialistDecision(role: RoleId): boolean {
  return role === "case-specialist";
}

export const canIssueCaseStudyReport = canMakeSpecialistDecision;
export const canReopenCaseStudyReport = canMakeSpecialistDecision;
export const canDecideAppraisalRecall = canMakeSpecialistDecision;
export const canHandOverToEnfaz = canMakeSpecialistDecision;
export const canReturnFromEnfaz = canMakeSpecialistDecision;
export const canLiftSurveyFreeze = canMakeSpecialistDecision;
export const canPrepareReportDraft = canMakeSpecialistDecision;
export const canReopenValuationReport = canMakeSpecialistDecision;

/** View details via the eye button — not for the case-study specialist (opens from the row or edit). */
export function canViewPoEye(role: RoleId): boolean {
  return isSuperAdmin(role) || !isCaseStudySpecialist(role);
}

export function isPoViewOnly(role: RoleId): boolean {
  return !isSuperAdmin(role) && role === "general-manager";
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

/** Supervisor and specialist may raise a failure from the property screen. */
export function canRaisePropertyFailure(role: RoleId): boolean {
  return canEditProperty(role) || canEditPoHeader(role);
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
    role === "section-supervisor"
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

/** Approve / reject a «مستند ذو قيمة» — mirrors `PoRoleMatrixRules.CanReviewValuedDocuments`. */
export function canReviewValuedDocuments(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "case-specialist";
}

/** Reassign case-study parties — section-supervisor+ and the case specialist on the file. */
export function canRedistributeParties(role: RoleId): boolean {
  return (
    isSuperAdmin(role) ||
    role === "section-supervisor" ||
    role === "general-manager" ||
    role === "case-specialist"
  );
}
