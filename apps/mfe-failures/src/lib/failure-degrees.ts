import type { RoleId } from "@platform/types";
import type { FailureSeverity } from "@platform/app-shared/failures/failures-types";
import { OTHER_FAILURE_TYPE_ID } from "./failure-types-data";

/**
 * The three degrees of a failure, in their ladder order (Omar 2026-11-11):
 * «تعذّر محتمل» ← «تعذّر داخلي» ← «تعذّر نهائي». The first two are the severity a raise is stored
 * with; the final one is the transaction's final failure (`POST /api/failures/final`).
 * Pure: no React.
 */
export type FailureDegree = FailureSeverity | "final";

export const FAILURE_DEGREE_LABELS: Record<FailureDegree, { label: string; hint: string }> = {
  suspected: { label: "تعذّر محتمل", hint: "العمل يستمر، ويتابعه الأخصائي" },
  internal: { label: "تعذّر داخلي", hint: "يوقف العمل على العقار" },
  final: { label: "تعذّر نهائي", hint: "يوقف المعاملة نهائياً" },
};

/**
 * «تعذّر نهائي» — the case specialist (any sub-role), the section supervisor and the CDO.
 * Mirrors `FailureRecordRules.CanRecordFinalFailure`.
 *
 * How it works: a plain role match. Edge cases: until 2026-11-11 only the supervisor and the CDO
 * passed. Not `isSuperAdmin` — that also admits any role holding `manage-system-config`, which the
 * server would refuse with 403; the general manager is view-only on failures and is left out on
 * both sides.
 */
export function canRecordFinalFailure(role: RoleId): boolean {
  return role === "case-specialist" || role === "section-supervisor" || role === "cdo";
}

/**
 * «تعذّر داخلي» — the failure that stops the work at once — is raised by the same roles; every
 * other role raises «تعذّر محتمل» only. Mirrors `FailureRecordRules.CanRaiseInternalFailure`
 * (the server lowers an `internal` sent by any other role to `suspected`).
 */
export function canRaiseInternalFailure(role: RoleId): boolean {
  return canRecordFinalFailure(role);
}

/** The severities a role may raise a failure with, in ladder order. */
export function raiseSeveritiesForRole(role: RoleId): FailureSeverity[] {
  return canRaiseInternalFailure(role) ? ["suspected", "internal"] : ["suspected"];
}

/** The severity a role's raise form starts on: internal for whoever may stop the work, possible otherwise. */
export function defaultRaiseSeverity(role: RoleId): FailureSeverity {
  return canRaiseInternalFailure(role) ? "internal" : "suspected";
}

/**
 * The degrees «تسجيل تعذّر» offers a viewer on one deed.
 *
 * How it works: the role's severities, plus «تعذّر نهائي» for whoever may record it. A deed that
 * already carries an open failure takes no second raise, so only the final degree is left — and
 * nothing at all once the failure is final.
 * Edge cases: a role that raises «تعذّر محتمل» only gets an empty list on a deed with an open
 * failure; the host hides or disables the action then.
 */
export function failureDegreesFor(
  role: RoleId,
  openFailureStatus: string | null,
): FailureDegree[] {
  if (openFailureStatus === "approved") return [];
  const final: FailureDegree[] = canRecordFinalFailure(role) ? ["final"] : [];
  if (openFailureStatus !== null) return final;
  return [...raiseSeveritiesForRole(role), ...final];
}

/**
 * Whether the raise must carry a written reason.
 *
 * How it works: «تعذّر داخلي» and «تعذّر نهائي» always need one; a possible failure may go without —
 * unless its type is «أخرى» (Omar 2026-11-12), whose name says nothing about what happened.
 * Edge cases: no type chosen yet → the degree alone decides.
 */
export function failureReasonRequired(degree: FailureDegree, problemTypeId = ""): boolean {
  return degree !== "suspected" || problemTypeId === OTHER_FAILURE_TYPE_ID;
}
