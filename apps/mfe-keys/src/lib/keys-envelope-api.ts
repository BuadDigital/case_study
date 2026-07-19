import {
  addKeyEnvelopeAssignment,
  confirmKeyEnvelopeAssignment,
  confirmKeyEnvelopeHandoff,
  createKeyEnvelope,
  createKeyEnvelopeHandoff,
  getKeyEnvelope,
  listKeyEnvelopeFeeReport,
  listKeyEnvelopeLinkedProperties,
  listKeyEnvelopes,
  listPropertyCourtAccess,
  markKeyReceiptFeeCollected,
  uploadAttachment,
  upsertPropertyCourtAccess,
  type CreateKeyEnvelopeHandoffRequest,
  type CreateKeyEnvelopeRequest,
  type KeyEnvelopeDto,
  type PropertyCourtAccessDto,
  type UpsertPropertyCourtAccessRequest,
} from "@platform/api-client";
import {
  apiErrorMessage,
  resolveApiError,
  type MutationResult,
} from "@platform/app-shared/prototype/work-orders-api-config";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import type {
  KeyEnvelopeFeeReportRow,
  KeyEnvelopeLinkedProperty,
  KeyEnvelopeRow,
  PropertyCourtAccessRow,
} from "./keys-envelope-types";

function mapEnvelope(dto: KeyEnvelopeDto): KeyEnvelopeRow {
  return {
    id: dto.id,
    requestNumber: dto.requestNumber,
    court: dto.court,
    circuit: dto.circuit,
    keysCountLabeled: dto.keysCountLabeled,
    keysCountActual: dto.keysCountActual,
    countMismatch: dto.countMismatch,
    receiptAttachmentId: dto.receiptAttachmentId,
    photoAttachmentId: dto.photoAttachmentId,
    thirdPartyLetterAttachmentId: dto.thirdPartyLetterAttachmentId,
    contactPhones: dto.contactPhones,
    notes: dto.notes,
    receiveScenario: dto.receiveScenario,
    status: dto.status,
    feeGenerated: dto.feeGenerated,
    feeAmountSar: dto.feeAmountSar,
    createdByName: dto.createdByName,
    createdAtUtc: dto.createdAtUtc,
    assignments: dto.assignments ?? [],
    handoffs: dto.handoffs ?? [],
    timeline: dto.timeline ?? [],
    linkedProperties: dto.linkedProperties ?? [],
  };
}

function mapAccess(dto: PropertyCourtAccessDto): PropertyCourtAccessRow {
  return { ...dto };
}

function fail(result: { kind: string; message?: string }, fallback: string) {
  return {
    ok: false as const,
    error: result.message ?? resolveApiError(result.kind, undefined, fallback),
  };
}

export async function loadKeyEnvelopes(): Promise<KeyEnvelopeRow[]> {
  const config = prototypeModulesApiConfig();
  if (!config) return [];
  const result = await listKeyEnvelopes(config);
  if (!result.ok) return [];
  return result.data.map(mapEnvelope);
}

export async function loadKeyEnvelope(
  id: string,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await getKeyEnvelope(config, id);
  if (!result.ok) return fail(result, "تعذّر تحميل الظرف");
  return { ok: true, data: mapEnvelope(result.data) };
}

export async function loadKeyEnvelopeFeeReport(): Promise<KeyEnvelopeFeeReportRow[]> {
  const config = prototypeModulesApiConfig();
  if (!config) return [];
  const result = await listKeyEnvelopeFeeReport(config);
  if (!result.ok) return [];
  return result.data;
}

export async function loadPropertyCourtAccess(
  requestNumber?: string,
): Promise<PropertyCourtAccessRow[]> {
  const config = prototypeModulesApiConfig();
  if (!config) return [];
  const result = await listPropertyCourtAccess(config, requestNumber);
  if (!result.ok) return [];
  return result.data.map(mapAccess);
}

export async function fetchLinkedPropertiesByRequestNumber(
  requestNumber: string,
): Promise<MutationResult<KeyEnvelopeLinkedProperty[]>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const trimmed = requestNumber.trim();
  if (!trimmed) return { ok: false, error: "رقم الطلب مطلوب" };
  const result = await listKeyEnvelopeLinkedProperties(config, trimmed);
  if (!result.ok) return fail(result, "تعذّر تحميل العقارات المرتبطة");
  return { ok: true, data: result.data };
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function uploadEnvelopeAttachment(
  kind:
    | "receipt"
    | "photo"
    | "third-party"
    | "handoff-letter"
    | "enabling"
    | "eviction",
  scopeKey: string,
  file: File,
): Promise<MutationResult<{ id: string; fileName: string }>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const scope =
    kind === "receipt"
      ? "key-envelope-receipt"
      : kind === "photo"
        ? "key-envelope-photo"
        : kind === "third-party"
          ? "key-envelope-third-party"
          : kind === "handoff-letter"
            ? "key-envelope-handoff-letter"
            : kind === "enabling"
              ? "property-enabling-letter"
              : "property-eviction-notice";

  const upload = await uploadAttachment(config, {
    scope,
    scopeKey: scopeKey.trim() || "draft",
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    contentBase64: await fileToBase64(file),
  });

  if (!upload.ok) {
    return {
      ok: false,
      error: resolveApiError(upload.kind, undefined, "تعذّر رفع الملف"),
    };
  }

  return {
    ok: true,
    data: { id: upload.data.id, fileName: upload.data.fileName },
  };
}

export type CreateEnvelopeInput = {
  requestNumber: string;
  court: string;
  circuit: string;
  keysCountLabeled: number;
  keysCountActual: number;
  receiveScenario: string;
  receiptAttachmentId?: string;
  photoAttachmentId?: string;
  thirdPartyLetterAttachmentId?: string;
  contactPhones?: string;
  notes?: string;
  assignments?: { deedNumber: string; propertyId?: string }[];
};

export async function registerKeyEnvelope(
  input: CreateEnvelopeInput,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const body: CreateKeyEnvelopeRequest = {
    requestNumber: input.requestNumber.trim(),
    court: input.court.trim(),
    circuit: input.circuit.trim(),
    keysCountLabeled: input.keysCountLabeled,
    keysCountActual: input.keysCountActual,
    receiveScenario: input.receiveScenario,
    receiptAttachmentId: input.receiptAttachmentId ?? null,
    photoAttachmentId: input.photoAttachmentId ?? null,
    thirdPartyLetterAttachmentId: input.thirdPartyLetterAttachmentId ?? null,
    contactPhones: input.contactPhones?.trim() || null,
    notes: input.notes?.trim() || null,
    assignments: input.assignments?.map((a) => ({
      deedNumber: a.deedNumber,
      propertyId: a.propertyId ?? null,
    })),
  };

  const result = await createKeyEnvelope(config, body);
  if (!result.ok) return fail(result, "تعذّر تسجيل الظرف");
  return { ok: true, data: mapEnvelope(result.data) };
}

export async function addEnvelopeAssignment(
  envelopeId: string,
  deedNumber: string,
  propertyId?: string,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await addKeyEnvelopeAssignment(config, envelopeId, {
    deedNumber,
    propertyId: propertyId ?? null,
  });
  if (!result.ok) return fail(result, "تعذّر إضافة الإسناد");
  return { ok: true, data: mapEnvelope(result.data) };
}

export async function confirmEnvelopeAssignment(
  envelopeId: string,
  assignmentId: string,
  status: "matched" | "unmatched",
  notes?: string,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await confirmKeyEnvelopeAssignment(
    config,
    envelopeId,
    assignmentId,
    { status, notes: notes ?? null },
  );
  if (!result.ok) return fail(result, "تعذّر تحديث الإسناد");
  return { ok: true, data: mapEnvelope(result.data) };
}

export async function createEnvelopeHandoff(
  envelopeId: string,
  body: CreateKeyEnvelopeHandoffRequest,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await createKeyEnvelopeHandoff(config, envelopeId, body);
  if (!result.ok) return fail(result, "تعذّر تسجيل المناولة");
  return { ok: true, data: mapEnvelope(result.data) };
}

export async function confirmEnvelopeHandoff(
  envelopeId: string,
  handoffId: string,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await confirmKeyEnvelopeHandoff(config, envelopeId, handoffId);
  if (!result.ok) return fail(result, "تعذّر تأكيد المناولة");
  return { ok: true, data: mapEnvelope(result.data) };
}

export async function markEnvelopeFeeCollected(
  envelopeId: string,
  invoiceReference?: string,
): Promise<MutationResult<KeyEnvelopeFeeReportRow>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await markKeyReceiptFeeCollected(config, envelopeId, {
    invoiceReference,
  });
  if (!result.ok) return fail(result, "تعذّر تحديث حالة التحصيل");
  return { ok: true, data: result.data };
}

export async function savePropertyCourtAccess(
  body: UpsertPropertyCourtAccessRequest,
): Promise<MutationResult<PropertyCourtAccessRow>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await upsertPropertyCourtAccess(config, body);
  if (!result.ok) return fail(result, "تعذّر حفظ مسار الدخول");
  return { ok: true, data: mapAccess(result.data) };
}
