import type { PartyTaskSubmissionDto } from "@platform/api-client";
import {
  isGovernmentReviewFormLocked,
  mergeGovernmentReviewWithKeyGate,
  normalizeGovernmentReviewSubmission,
  type GovernmentReviewKeyGateOverlay,
  type GovernmentReviewSubmission,
} from "./government-review-work-data";
import type { WorkflowTask } from "./tasks-storage";

function submissionFromDto(
  dto: PartyTaskSubmissionDto | null | undefined,
): GovernmentReviewSubmission | null {
  if (!dto) return null;
  const payload = dto.payload as Partial<GovernmentReviewSubmission>;
  const normalized = normalizeGovernmentReviewSubmission(payload);
  return {
    ...normalized,
    taskId: dto.taskId,
    propertyId: normalized.propertyId ?? dto.propertyId ?? "",
    poNumber: normalized.poNumber ?? dto.poNumber ?? "",
    visitStatus: normalized.visitStatus ?? "",
    visitDate: normalized.visitDate ?? "",
    courtName: normalized.courtName ?? "",
    keysStatus: normalized.keysStatus ?? "",
    keysDescription: normalized.keysDescription ?? "",
    keyHandedToInspector: normalized.keyHandedToInspector ?? "",
    accessBlockReason: normalized.accessBlockReason ?? "",
    reviewNotes: normalized.reviewNotes ?? "",
    propertyZoneStatus: normalized.propertyZoneStatus ?? "",
    confirmed: normalized.confirmed ?? false,
    status: (normalized.status ?? dto.status) as GovernmentReviewSubmission["status"],
    submittedAtUtc: dto.submittedAtUtc ?? normalized.submittedAtUtc ?? null,
    updatedAtUtc: dto.updatedAtUtc ?? normalized.updatedAtUtc ?? "",
  } as GovernmentReviewSubmission;
}

export function governmentReviewTaskStatusBadge(
  task: WorkflowTask,
  submissionDto?: PartyTaskSubmissionDto | null,
  gate?: GovernmentReviewKeyGateOverlay | null,
): { label: string; className: string } | null {
  const sub = submissionFromDto(submissionDto);
  const keysView = sub
    ? mergeGovernmentReviewWithKeyGate(sub, gate)
    : null;

  if (sub?.status === "submitted" || task.status === "completed") {
    return { label: "مكتملة", className: "b-done" };
  }
  if (!sub) {
    return { label: "جديدة", className: "b-new" };
  }
  if (sub.visitStatus === "scheduled") {
    return { label: "بالانتظار", className: "b-prog" };
  }
  if (sub.visitStatus === "blocked") {
    return { label: "تعذر الوصول", className: "b-prog" };
  }
  if (
    sub.visitStatus === "completed" &&
    keysView?.keyHandedToInspector === "no"
  ) {
    return { label: "قيد التنفيذ", className: "b-prog" };
  }
  if (keysView?.envelopeMissingWarning) {
    return { label: "بانتظار الظرف", className: "b-prog" };
  }
  if (sub.visitStatus && keysView?.keysStatus) {
    return { label: "قيد التنفيذ", className: "b-prog" };
  }
  if (sub.visitStatus || keysView?.keysStatus) {
    return { label: "مسودة", className: "b-new" };
  }
  return { label: "جديدة", className: "b-new" };
}

export function isGovernmentReviewLocked(
  taskId: string,
  taskStatus?: string,
  submissionDto?: PartyTaskSubmissionDto | null,
): boolean {
  if (taskStatus === "completed") return true;
  const sub = submissionFromDto(submissionDto);
  return sub ? isGovernmentReviewFormLocked(sub.status) : false;
}
