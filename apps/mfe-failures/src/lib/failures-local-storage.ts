import {
  findPropertyInRecord,
  updatePropertyInPo,
} from "@case-study/mfe/lib/prototype/po-intake-storage";
import {
  escalateTaskForObstruction,
  resolveObstructionForProperty,
} from "@case-study/mfe/lib/prototype/tasks-storage";
import { failureProblemTypeLabel } from "./failure-types-data";
import { notifyFailuresChanged } from "./failures-events";
import type {
  BourseObstructionInput,
  CreateFailureInput,
  FailureRecord,
  FailureStatus,
  ResolveFailureInput,
} from "./failures-types";
import { isActiveFailureStatus } from "./failures-types";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `f-${Date.now()}`;
}

function normalizeFailure(raw: FailureRecord): FailureRecord {
  return {
    ...raw,
    problemTypeId: raw.problemTypeId ?? "",
    severity: raw.severity ?? "internal",
    raisedByRole: raw.raisedByRole ?? "",
    resolutionReason: raw.resolutionReason ?? "",
    continueInstructions: raw.continueInstructions ?? "",
  };
}

let memoryFailures: FailureRecord[] = [];

function readFailures(): FailureRecord[] {
  return memoryFailures;
}

function writeFailures(list: FailureRecord[]): void {
  memoryFailures = list;
  notifyFailuresChanged();
}

function patchPropertyDeedStatus(
  poNumber: string,
  propertyId: string,
  deedStatus: string,
): void {
  void (async () => {
    const found = await findPropertyInRecord(poNumber, propertyId);
    if (!found) return;
    await updatePropertyInPo(poNumber, propertyId, {
      ...found.property,
      deedStatus,
    });
  })();
}

function failureTitle(input: CreateFailureInput): string {
  const fromCatalog = failureProblemTypeLabel(input.problemTypeId, input.title);
  return input.title?.trim() || fromCatalog;
}

function applyInternalSeveritySideEffects(
  input: CreateFailureInput,
  title: string,
): void {
  patchPropertyDeedStatus(input.poNumber, input.propertyId, "قيد التحقق");
  void escalateTaskForObstruction(
    input.poNumber,
    input.propertyId,
    title || input.internalNote?.trim() || "",
  );
}

export const localFailuresRepository = {
  loadFailures(): FailureRecord[] {
    return readFailures();
  },

  /** من بيانات البورصة — متعذر (صك غير فعال) → مباشرة لمراجعة المشرف. */
  reportBourseObstructionToSupervisor(
    input: BourseObstructionInput,
  ): FailureRecord {
    const record = localFailuresRepository.createFailure({
      poNumber: input.poNumber,
      propertyId: input.propertyId,
      deedNumber: input.deedNumber,
      problemTypeId: "deed-inactive",
      severity: "internal",
      raisedByRole: "الأخصائي",
      title: "متعذر — الصك غير فعال",
      internalNote: input.reason.trim(),
      specialist: input.specialist,
    });
    localFailuresRepository.submitFailureForReview(record.id);
    return record;
  },

  createFailure(input: CreateFailureInput): FailureRecord {
    const now = new Date().toISOString();
    const title = failureTitle(input);
    const record: FailureRecord = {
      id: newId(),
      poNumber: input.poNumber,
      propertyId: input.propertyId,
      deedNumber: input.deedNumber,
      title,
      problemTypeId: input.problemTypeId,
      severity: input.severity,
      raisedByRole: input.raisedByRole?.trim() || "الأخصائي",
      internalNote: input.internalNote?.trim() ?? "",
      finalNote: "",
      resolutionReason: "",
      continueInstructions: "",
      status: "internal",
      specialist: input.specialist,
      createdAt: now,
      updatedAt: now,
    };
    writeFailures([record, ...readFailures()]);
    if (input.severity === "internal") {
      applyInternalSeveritySideEffects(input, title);
    }
    return record;
  },

  upgradeFailureToInternal(id: string): FailureRecord | null {
    const list = readFailures();
    const idx = list.findIndex((f) => f.id === id);
    if (idx < 0) return null;
    const item = list[idx];
    if (
      item.status !== "internal" ||
      item.severity !== "suspected" ||
      !isActiveFailureStatus(item.status)
    ) {
      return null;
    }
    const next: FailureRecord = {
      ...item,
      severity: "internal",
      updatedAt: new Date().toISOString(),
    };
    list[idx] = next;
    writeFailures(list);
    applyInternalSeveritySideEffects(
      {
        poNumber: item.poNumber,
        propertyId: item.propertyId,
        deedNumber: item.deedNumber,
        problemTypeId: item.problemTypeId,
        severity: "internal",
        specialist: item.specialist,
        title: item.title,
        internalNote: item.internalNote,
      },
      item.title,
    );
    return next;
  },

  submitFailureForReview(id: string): FailureRecord | null {
    const list = readFailures();
    const idx = list.findIndex((f) => f.id === id);
    const item = list[idx];
    const status = item?.status;
    if (idx < 0 || (status !== "internal" && status !== "returned")) return null;
    const next = {
      ...item,
      status: "review" as const,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = next;
    writeFailures(list);
    void escalateTaskForObstruction(
      item.poNumber,
      item.propertyId,
      item.title.trim() || item.internalNote.trim(),
    );
    return next;
  },

  suspendFailure(id: string, note: string): FailureRecord | null {
    const list = readFailures();
    const idx = list.findIndex((f) => f.id === id);
    if (idx < 0 || list[idx].status !== "review") return null;
    const item = list[idx];
    const next: FailureRecord = {
      ...item,
      status: "suspended",
      finalNote: note.trim(),
      updatedAt: new Date().toISOString(),
    };
    list[idx] = next;
    writeFailures(list);
    return next;
  },

  resolveFailure(
    id: string,
    input: ResolveFailureInput,
  ): FailureRecord | null {
    const list = readFailures();
    const idx = list.findIndex((f) => f.id === id);
    if (idx < 0) return null;
    const item = list[idx];
    if (!isActiveFailureStatus(item.status)) return null;
    if (item.status === "approved") return null;

    const next: FailureRecord = {
      ...item,
      status: "resolved",
      resolutionReason: input.resolutionReason.trim(),
      continueInstructions: input.continueInstructions.trim(),
      updatedAt: new Date().toISOString(),
    };
    list[idx] = next;
    writeFailures(list);
    patchPropertyDeedStatus(item.poNumber, item.propertyId, "فعال");
    void resolveObstructionForProperty(item.poNumber, item.propertyId);
    return next;
  },

  approveFailure(id: string, finalNote: string): FailureRecord | null {
    const list = readFailures();
    const idx = list.findIndex((f) => f.id === id);
    if (idx < 0 || list[idx].status !== "review") return null;
    const item = list[idx];
    const next: FailureRecord = {
      ...item,
      status: "approved",
      finalNote: finalNote.trim(),
      updatedAt: new Date().toISOString(),
    };
    list[idx] = next;
    writeFailures(list);
    patchPropertyDeedStatus(item.poNumber, item.propertyId, "موقوف");
    return next;
  },

  returnFailure(id: string, finalNote: string): FailureRecord | null {
    const list = readFailures();
    const idx = list.findIndex((f) => f.id === id);
    if (idx < 0 || list[idx].status !== "review") return null;
    const item = list[idx];
    const next: FailureRecord = {
      ...item,
      status: "returned",
      finalNote: finalNote.trim(),
      updatedAt: new Date().toISOString(),
    };
    list[idx] = next;
    writeFailures(list);
    patchPropertyDeedStatus(item.poNumber, item.propertyId, "فعال");
    void resolveObstructionForProperty(item.poNumber, item.propertyId);
    return next;
  },

  deleteFailuresForPo(poNumber: string): void {
    const n = poNumber.trim();
    const next = readFailures().filter((f) => f.poNumber.trim() !== n);
    writeFailures(next);
  },

  getPropertyFailure(
    poNumber: string,
    propertyId: string,
  ): FailureRecord | null {
    return (
      readFailures().find(
        (f) =>
          f.poNumber === poNumber &&
          f.propertyId === propertyId &&
          isActiveFailureStatus(f.status),
      ) ?? null
    );
  },
};

export function failureStatusLabel(status: FailureStatus): string {
  if (status === "internal") return "مسودة داخلية";
  if (status === "review") return "عند مشرف دراسة الحالة";
  if (status === "suspended") return "معلقة";
  if (status === "approved") return "معتمد";
  if (status === "resolved") return "تم الحل";
  return "معاد للأخصائي";
}

export function failureSeverityLabel(severity: FailureRecord["severity"]): string {
  if (severity === "suspected") return "احتمال تعذر";
  return "تعذر داخلي";
}
