import {
  confirmKeyEnvelopeAssignment,
  confirmKeyEnvelopeHandoff,
  createKeyEnvelope,
  createKeyEnvelopeHandoff,
  deleteKeyEnvelope,
  getKeyEnvelope,
  listKeyEnvelopeFeeReport,
  listKeyEnvelopeLinkedProperties,
  listKeyEnvelopes,
  listPropertyCourtAccess,
  markKeyReceiptFeeCollected,
  setKeyEnvelopeAssignmentKeyLocation,
  uploadAttachment,
  upsertPropertyCourtAccess,
  type CreateKeyEnvelopeHandoffRequest,
  type CreateKeyEnvelopeRequest,
  type KeyEnvelopeDto,
  type PropertyCourtAccessDto,
  type PrototypeModulesApiConfig,
  type PrototypeModulesResult,
  type SetKeyLocationRequest,
  type UpsertPropertyCourtAccessRequest,
} from "@platform/api-client";
import { apiErrorMessage, resolveApiError, type MutationResult, } from "@platform/app-shared/app-data/work-orders-api-config";
import {
  prepareEvidencePhotoUpload,
  type EvidencePhotoMetadata,
} from "@platform/app-shared/media/evidence-photo-upload";
import { fileToBase64 } from "@platform/app-shared/media/file-encoding";
import { currentOfflineUserId, isBrowserOffline, uploadAttachmentWithOfflineFallback } from "@platform/app-shared/offline/offline-write";
import { isOfflineFieldSession } from "@platform/app-shared/offline/offline-access-cache";
import { beginOfflineLease, enqueueOutbox, listOutboxItems, randomUuid, type OutboxKind } from "@platform/offline-client";
import {
  KEY_ENVELOPES_PREFETCH_ID,
  readPrefetchedJson,
  savePrefetchedJson,
} from "@platform/app-shared/offline/prefetch-read";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";
import type {
  KeyAssignmentMatchStatus,
  KeyEnvelopeFeeReportRow,
  KeyEnvelopeLinkedProperty,
  KeyEnvelopeRow,
  PropertyCourtAccessRow,
} from "./keys-envelope-types";

function mapEnvelope(dto: KeyEnvelopeDto): KeyEnvelopeRow {
  return {
    id: dto.id,
    requestNumber: dto.requestNumber,
    referenceNumber: dto.referenceNumber ?? null,
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
    revenueEntitlementAtUtc: dto.revenueEntitlementAtUtc ?? null,
    createdByUserId: dto.createdByUserId ?? null,
    createdByName: dto.createdByName,
    createdAtUtc: dto.createdAtUtc,
    operationsTaskId: dto.operationsTaskId ?? null,
    // The envelope's one explicit holder; rows from before it default to the reviewer.
    holderKind: dto.holderKind ?? "reviewer",
    holderUserId: dto.holderUserId ?? null,
    holderLabel: dto.holderLabel ?? null,
    holderSinceUtc: dto.holderSinceUtc ?? null,
    readyForCourtReturn: dto.readyForCourtReturn ?? false,
    assignments: dto.assignments ?? [],
    handoffs: dto.handoffs ?? [],
    timeline: dto.timeline ?? [],
    linkedProperties: dto.linkedProperties ?? [],
  };
}

function pendingAccessStub(
  body: UpsertPropertyCourtAccessRequest,
): PropertyCourtAccessRow {
  const now = new Date().toISOString();
  return mapAccess({
    id: body.propertyId,
    propertyId: body.propertyId,
    poNumber: "",
    deedNumber: "",
    requestNumber: "",
    hasEnablingLetter: body.hasEnablingLetter,
    enablingLetterAttachmentId: body.enablingLetterAttachmentId ?? null,
    hasEvictionNotice: body.hasEvictionNotice,
    evictionNoticeAttachmentId: body.evictionNoticeAttachmentId ?? null,
    studyHoldStatus: "pending_sync",
    contactPhones: body.contactPhones ?? null,
    notes: body.notes ?? null,
    updatedByName: "",
    updatedAtUtc: now,
  });
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

function pendingEnvelopeStub(
  body: CreateKeyEnvelopeRequest,
  clientId: string,
): KeyEnvelopeRow {
  const now = new Date().toISOString();
  return {
    id: clientId,
    requestNumber: body.requestNumber,
    court: body.court,
    circuit: body.circuit,
    keysCountLabeled: body.keysCountLabeled,
    keysCountActual: body.keysCountActual,
    countMismatch: body.keysCountLabeled !== body.keysCountActual,
    receiptAttachmentId: body.receiptAttachmentId,
    photoAttachmentId: body.photoAttachmentId,
    thirdPartyLetterAttachmentId: body.thirdPartyLetterAttachmentId,
    contactPhones: body.contactPhones,
    notes: body.notes,
    receiveScenario: body.receiveScenario ?? "court",
    status: "reviewer",
    feeGenerated: false,
    feeAmountSar: null,
    revenueEntitlementAtUtc: null,
    createdByName: "",
    createdAtUtc: now,
    operationsTaskId: body.operationsTaskId ?? null,
    assignments: [],
    handoffs: [],
    timeline: [],
    linkedProperties: [],
  };
}

async function enqueueKeyEnvelopeWrite(
  kind: OutboxKind,
  envelopeId: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<boolean> {
  const userId = currentOfflineUserId();
  if (!userId || !isOfflineFieldSession()) return false;
  await enqueueOutbox({
    userId,
    kind,
    targetId: envelopeId,
    payloadJson: JSON.stringify({ envelopeId, ...payload }),
    idempotencyKey,
  });
  await beginOfflineLease(userId);
  return true;
}

/** Outbox an envelope write and answer with the envelope id only — the list refreshes after sync. */
async function queueEnvelopeWrite(
  kind: OutboxKind,
  envelopeId: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<MutationResult<KeyEnvelopeRow>> {
  await enqueueKeyEnvelopeWrite(kind, envelopeId, payload, idempotencyKey);
  return { ok: true, data: { id: envelopeId } as KeyEnvelopeRow, queued: true };
}

/**
 * A field-session write: queued to the outbox when offline (or signed out of the API) in a
 * field session, and again when the call fails on the network or throws; else the server's answer.
 */
async function writeOrQueue<TDto, TRow>({
  config,
  call,
  toRow,
  failMessage,
  queue,
}: {
  config: PrototypeModulesApiConfig | null;
  call: (config: PrototypeModulesApiConfig) => Promise<PrototypeModulesResult<TDto>>;
  toRow: (dto: TDto) => TRow;
  failMessage: string;
  /** Puts the write in the outbox and answers with the pending row. */
  queue: (userId: string) => Promise<MutationResult<TRow>>;
}): Promise<MutationResult<TRow>> {
  const userId = currentOfflineUserId();
  if ((!config || isBrowserOffline()) && userId && isOfflineFieldSession()) {
    return queue(userId);
  }
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  try {
    const result = await call(config);
    if (!result.ok) {
      if (result.kind === "network" && userId && isOfflineFieldSession()) {
        // Awaited inside the try: a failed outbox write falls through to the catch below.
        return await queue(userId);
      }
      return fail(result, failMessage);
    }
    return { ok: true, data: toRow(result.data) };
  } catch (err) {
    if (userId && isOfflineFieldSession()) return queue(userId);
    return {
      ok: false,
      error: err instanceof Error ? err.message : failMessage,
    };
  }
}

/* ─── Offline reads (government reviewer, spec) ─── */

type KeysOfflineSnapshot = {
  envelopes: KeyEnvelopeDto[];
  /** Court-access rows keyed by request number. */
  courtAccess: Record<string, PropertyCourtAccessDto[]>;
};

/** Court-access lookups per prefetch — one per distinct request number. */
const MAX_PREFETCH_COURT_ACCESS = 40;

/**
 * Keeps the reviewer's envelopes (assignments, handoffs and timeline come with each
 * row) and the court access of their requests on the device while online, so the
 * keys screens open offline.
 */
export async function prefetchKeyEnvelopesForOffline(): Promise<void> {
  const config = prototypeModulesApiConfig();
  const userId = currentOfflineUserId();
  if (!config || !userId) return;
  const list = await listKeyEnvelopes(config);
  if (!list.ok) return;
  const requestNumbers = [
    ...new Set(list.data.map((e) => e.requestNumber?.trim()).filter(Boolean)),
  ].slice(0, MAX_PREFETCH_COURT_ACCESS) as string[];
  const courtAccess: KeysOfflineSnapshot["courtAccess"] = {};
  for (const requestNumber of requestNumbers) {
    const access = await listPropertyCourtAccess(config, requestNumber);
    if (access.ok) courtAccess[requestNumber] = access.data;
  }
  const snapshot: KeysOfflineSnapshot = { envelopes: list.data, courtAccess };
  await savePrefetchedJson(KEY_ENVELOPES_PREFETCH_ID(userId), "key-envelopes", snapshot);
}

async function readKeysSnapshot(): Promise<KeysOfflineSnapshot | null> {
  const userId = currentOfflineUserId();
  if (!userId) return null;
  return readPrefetchedJson<KeysOfflineSnapshot>(KEY_ENVELOPES_PREFETCH_ID(userId));
}

/** Envelopes registered offline and not yet synced — shown as pending rows. */
async function pendingEnvelopeRows(): Promise<KeyEnvelopeRow[]> {
  const userId = currentOfflineUserId();
  if (!userId) return [];
  try {
    const items = await listOutboxItems(userId);
    return items
      .filter(
        (item) =>
          item.kind === "key-envelope-create" &&
          item.status !== "done" &&
          item.status !== "terminal",
      )
      .flatMap((item) => {
        try {
          const body = JSON.parse(item.payloadJson) as CreateKeyEnvelopeRequest & {
            clientEnvelopeId?: string;
          };
          return [pendingEnvelopeStub(body, body.clientEnvelopeId ?? item.targetId)];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function isLocalPendingEnvelopeId(id: string): boolean {
  return id.startsWith("local-pending:");
}

export async function loadKeyEnvelopes(): Promise<KeyEnvelopeRow[]> {
  const config = prototypeModulesApiConfig();
  const pending = await pendingEnvelopeRows();
  if (config && !isBrowserOffline()) {
    const result = await listKeyEnvelopes(config);
    if (result.ok) return [...pending, ...result.data.map(mapEnvelope)];
    if (result.kind !== "network") return pending;
  }
  const snapshot = await readKeysSnapshot();
  return [...pending, ...(snapshot?.envelopes.map(mapEnvelope) ?? [])];
}

export async function loadKeyEnvelope(
  id: string,
): Promise<MutationResult<KeyEnvelopeRow>> {
  if (isLocalPendingEnvelopeId(id)) {
    const pending = (await pendingEnvelopeRows()).find((row) => row.id === id);
    return pending
      ? { ok: true, data: pending }
      : { ok: false, error: "تمت مزامنة الظرف — افتحه من القائمة" };
  }
  const config = prototypeModulesApiConfig();
  if (config && !isBrowserOffline()) {
    const result = await getKeyEnvelope(config, id);
    if (result.ok) return { ok: true, data: mapEnvelope(result.data) };
    if (result.kind !== "network") return fail(result, "تعذّر تحميل الظرف");
  } else if (!config && !isBrowserOffline()) {
    return { ok: false, error: apiErrorMessage("auth") };
  }
  const cached = (await readKeysSnapshot())?.envelopes.find((e) => e.id === id);
  return cached
    ? { ok: true, data: mapEnvelope(cached) }
    : { ok: false, error: "الظرف غير محفوظ على الجهاز" };
}

export async function removeKeyEnvelope(
  id: string,
): Promise<MutationResult<true>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await deleteKeyEnvelope(config, id);
  if (!result.ok) return fail(result, "تعذّر حذف الظرف");
  return { ok: true, data: true };
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
  if (config && !isBrowserOffline()) {
    const result = await listPropertyCourtAccess(config, requestNumber);
    if (result.ok) return result.data.map(mapAccess);
    if (result.kind !== "network") return [];
  }
  const key = requestNumber?.trim();
  if (!key) return [];
  const cached = (await readKeysSnapshot())?.courtAccess[key] ?? [];
  return cached.map(mapAccess);
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

  let uploadFile = file;
  let photoMetadata: EvidencePhotoMetadata | undefined;

  if (kind === "photo") {
    const prepared = await prepareEvidencePhotoUpload(file);
    if (!prepared.ok) return prepared;
    uploadFile = prepared.file;
    photoMetadata = prepared.photoMetadata;
  }

  const bytes = await uploadFile.arrayBuffer();
  const offlineUpload = await uploadAttachmentWithOfflineFallback({
    scope,
    scopeKey: scopeKey.trim() || "draft",
    fileName: uploadFile.name,
    contentType: uploadFile.type || "application/octet-stream",
    bytes,
    uploadExtras: photoMetadata ? { photoMetadata } : undefined,
    onlineUpload: async () => {
      if (!config) throw new Error(apiErrorMessage("auth"));
      const upload = await uploadAttachment(config, {
        scope,
        scopeKey: scopeKey.trim() || "draft",
        fileName: uploadFile.name,
        contentType: uploadFile.type || "application/octet-stream",
        contentBase64: await fileToBase64(uploadFile),
        photoMetadata,
      });
      if (!upload.ok) {
        throw new Error(
          resolveApiError(upload.kind, undefined, "تعذّر رفع الملف"),
        );
      }
      return upload.data.id;
    },
  });

  return {
    ok: true,
    data: {
      id: offlineUpload.attachmentId,
      fileName: uploadFile.name,
    },
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
  operationsTaskId?: string;
  assignments?: { deedNumber: string; propertyId?: string }[];
};

export async function registerKeyEnvelope(
  input: CreateEnvelopeInput,
  idempotencyKey?: string,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
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
    operationsTaskId: input.operationsTaskId?.trim() || null,
    assignments: input.assignments?.map((a) => ({
      deedNumber: a.deedNumber,
      propertyId: a.propertyId ?? null,
    })),
  };

  return writeOrQueue({
    config,
    call: (cfg) => createKeyEnvelope(cfg, body, idempotencyKey),
    toRow: mapEnvelope,
    failMessage: "تعذّر تسجيل الظرف",
    queue: async (userId) => {
      const clientId = `local-pending:${randomUuid()}`;
      await enqueueOutbox({
        userId,
        kind: "key-envelope-create",
        targetId: clientId,
        payloadJson: JSON.stringify({ ...body, clientEnvelopeId: clientId }),
        idempotencyKey,
      });
      await beginOfflineLease(userId);
      return { ok: true, data: pendingEnvelopeStub(body, clientId), queued: true };
    },
  });
}

/**
 * Records the field trial of one deed's key: the match result, its note and where the
 * matching key went.
 *
 * How it works: builds `{ status, notes, keyLocation }` and sends it through `writeOrQueue`:
 * online it calls `confirmKeyEnvelopeAssignment` and maps the returned envelope; in an offline
 * field session (or on a network failure there) the same body goes to the outbox as
 * `key-envelope-assignment-confirm` and replays later.
 *
 * Edge cases: — `keyLocation` travels in both the live and the queued body
 * so a trial recorded offline keeps the key's place; null lets the server default it
 * (in_envelope on matched/partial, missing on missing; with_user holder = the actor).
 */
export async function confirmEnvelopeAssignment(
  envelopeId: string,
  assignmentId: string,
  status: KeyAssignmentMatchStatus,
  notes?: string,
  idempotencyKey?: string,
  /** Where the matching key went after the trial; empty = back in the envelope. */
  keyLocation?: string | null,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
  const body = { assignmentId, status, notes: notes ?? null, keyLocation: keyLocation ?? null };
  return writeOrQueue({
    config,
    call: (cfg) =>
      confirmKeyEnvelopeAssignment(
        cfg,
        envelopeId,
        assignmentId,
        { status, notes: notes ?? null, keyLocation: keyLocation ?? null },
        idempotencyKey,
      ),
    toRow: mapEnvelope,
    failMessage: "تعذّر تحديث الإسناد",
    queue: () =>
      queueEnvelopeWrite(
        "key-envelope-assignment-confirm",
        envelopeId,
        body,
        idempotencyKey,
      ),
  });
}

/**
 * The reviewer corrects where a deed's key is. Online only — a desk action.
 *
 * How it works: without an API config returns the auth error; otherwise calls
 * `setKeyEnvelopeAssignmentKeyLocation` with the body (place, and the holder when the key is
 * with a user) and the idempotency key, and returns the mapped envelope or an Arabic failure.
 *
 * Edge cases: never queued offline — unlike the field trial, a correction needs the server's
 * answer at once.
 */
export async function setEnvelopeKeyLocation(
  envelopeId: string,
  assignmentId: string,
  body: SetKeyLocationRequest,
  idempotencyKey?: string,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await setKeyEnvelopeAssignmentKeyLocation(
    config,
    envelopeId,
    assignmentId,
    body,
    idempotencyKey,
  );
  if (!result.ok) return fail(result, "تعذّر تحديث مكان المفتاح");
  return { ok: true, data: mapEnvelope(result.data) };
}

export async function createEnvelopeHandoff(
  envelopeId: string,
  body: CreateKeyEnvelopeHandoffRequest,
  idempotencyKey?: string,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
  return writeOrQueue({
    config,
    call: (cfg) => createKeyEnvelopeHandoff(cfg, envelopeId, body, idempotencyKey),
    toRow: mapEnvelope,
    failMessage: "تعذّر تسجيل المناولة",
    queue: () =>
      queueEnvelopeWrite(
        "key-envelope-handoff-create",
        envelopeId,
        { ...body },
        idempotencyKey,
      ),
  });
}

export async function confirmEnvelopeHandoff(
  envelopeId: string,
  handoffId: string,
  idempotencyKey?: string,
): Promise<MutationResult<KeyEnvelopeRow>> {
  const config = prototypeModulesApiConfig();
  return writeOrQueue({
    config,
    call: (cfg) => confirmKeyEnvelopeHandoff(cfg, envelopeId, handoffId, idempotencyKey),
    toRow: mapEnvelope,
    failMessage: "تعذّر تأكيد المناولة",
    queue: () =>
      queueEnvelopeWrite(
        "key-envelope-handoff-confirm",
        envelopeId,
        { handoffId },
        idempotencyKey,
      ),
  });
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
  const targetId = String(body.propertyId ?? "").trim();
  return writeOrQueue({
    config,
    call: (cfg) => upsertPropertyCourtAccess(cfg, body),
    toRow: mapAccess,
    failMessage: "تعذّر حفظ مسار الدخول",
    queue: async (userId) => {
      await enqueueOutbox({
        userId,
        kind: "property-court-access",
        targetId: targetId || randomUuid(),
        payloadJson: JSON.stringify(body),
      });
      await beginOfflineLease(userId);
      return { ok: true, data: pendingAccessStub(body) };
    },
  });
}
