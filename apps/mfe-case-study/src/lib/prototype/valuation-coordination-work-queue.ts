import type { PartyTaskSubmissionDto } from "@platform/api-client";
import {
  isValuationCoordinationFormLocked,
  valuationCoordinationStatusLabel,
  type ValuationCoordinationSubmission,
} from "./valuation-coordination-work-data";

function submissionFromDto(
  dto: PartyTaskSubmissionDto | null | undefined,
): ValuationCoordinationSubmission | null {
  if (!dto) return null;
  const payload = dto.payload as Partial<ValuationCoordinationSubmission>;
  return {
    ...payload,
    taskId: dto.taskId,
    propertyId: payload.propertyId ?? dto.propertyId ?? "",
    poNumber: payload.poNumber ?? dto.poNumber ?? "",
    receiptConfirmed: payload.receiptConfirmed ?? false,
    receiptDate: payload.receiptDate ?? "",
    inspectorName: payload.inspectorName ?? "",
    appraiserName: payload.appraiserName ?? "",
    priority: payload.priority ?? "normal",
    coordinationNotes: payload.coordinationNotes ?? "",
    inspectorInstructions: payload.inspectorInstructions ?? "",
    appraiserInstructions: payload.appraiserInstructions ?? "",
    status: (payload.status ?? dto.status) as ValuationCoordinationSubmission["status"],
    submittedAtUtc: dto.submittedAtUtc ?? payload.submittedAtUtc ?? null,
    updatedAtUtc: dto.updatedAtUtc ?? payload.updatedAtUtc ?? "",
  };
}

export function valuationCoordinationTaskStatusBadge(
  taskId: string,
  submissionDto?: PartyTaskSubmissionDto | null,
  taskStatus?: string,
): { label: string; className: string } | null {
  if (taskStatus === "completed") {
    return {
      label: valuationCoordinationStatusLabel("submitted"),
      className: "b-done",
    };
  }
  const sub = submissionFromDto(submissionDto);
  if (sub?.status === "submitted") {
    return {
      label: valuationCoordinationStatusLabel("submitted"),
      className: "b-done",
    };
  }
  if (sub?.receiptConfirmed && sub.coordinationNotes.trim()) {
    return { label: "قيد التنسيق", className: "b-prog" };
  }
  if (sub && (sub.receiptConfirmed || sub.coordinationNotes.trim())) {
    return { label: "مسودة", className: "b-new" };
  }
  return { label: "بانتظار الاستلام", className: "b-new" };
}

export function isValuationCoordinationLocked(
  taskId: string,
  submissionDto?: PartyTaskSubmissionDto | null,
): boolean {
  const sub = submissionFromDto(submissionDto);
  return sub ? isValuationCoordinationFormLocked(sub.status) : false;
}
