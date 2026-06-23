import type { PartyTaskSubmissionDto } from "@platform/api-client";
import {
  governmentReviewStatusLabel,
  isGovernmentReviewFormLocked,
  type GovernmentReviewSubmission,
} from "./government-review-work-data";
import type { WorkflowTask } from "./tasks-storage";

function submissionFromDto(
  dto: PartyTaskSubmissionDto | null | undefined,
): GovernmentReviewSubmission | null {
  if (!dto) return null;
  const payload = dto.payload as Partial<GovernmentReviewSubmission>;
  return {
    ...payload,
    taskId: dto.taskId,
    propertyId: payload.propertyId ?? dto.propertyId ?? "",
    poNumber: payload.poNumber ?? dto.poNumber ?? "",
    visitStatus: payload.visitStatus ?? "",
    visitDate: payload.visitDate ?? "",
    courtName: payload.courtName ?? "",
    keysStatus: payload.keysStatus ?? "",
    keysDescription: payload.keysDescription ?? "",
    accessBlockReason: payload.accessBlockReason ?? "",
    reviewNotes: payload.reviewNotes ?? "",
    propertyZoneStatus: payload.propertyZoneStatus ?? "",
    keysProofFileName: payload.keysProofFileName ?? "",
    confirmed: payload.confirmed ?? false,
    status: (payload.status ?? dto.status) as GovernmentReviewSubmission["status"],
    submittedAtUtc: dto.submittedAtUtc ?? payload.submittedAtUtc ?? null,
    updatedAtUtc: dto.updatedAtUtc ?? payload.updatedAtUtc ?? "",
  };
}

export function governmentReviewTaskStatusBadge(
  task: WorkflowTask,
  submissionDto?: PartyTaskSubmissionDto | null,
): { label: string; className: string } | null {
  const sub = submissionFromDto(submissionDto);

  if (sub?.status === "submitted" || task.status === "completed") {
    return { label: governmentReviewStatusLabel("submitted"), className: "b-done" };
  }
  if (!sub) {
    return { label: "جديدة", className: "b-new" };
  }
  if (sub.visitStatus && sub.keysStatus) {
    return { label: "قيد التنفيذ", className: "b-prog" };
  }
  if (sub.visitStatus || sub.keysStatus) {
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
