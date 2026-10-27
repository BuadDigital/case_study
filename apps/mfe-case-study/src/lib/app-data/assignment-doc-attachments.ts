import {
  deleteAttachment,
  downloadAttachmentBlob,
  listAttachments,
  listAttachmentsForProperty,
  uploadAttachment,
  type FileAttachmentMetaDto,
} from "@platform/api-client";
import { downloadAttachmentBlobOnce } from "@platform/app-shared/app-data/attachment-blob-cache";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";
import { currentOfflineUserId } from "@platform/app-shared/offline/offline-write";
import { getOfflineBlob } from "@platform/offline-client";
import {
  blobToDataUrl,
  fileToBase64,
} from "@platform/app-shared/media/file-encoding";
import {
  pdfBlobToFirstPageDataUrl,
  pdfFileToFirstPageDataUrl,
} from "./pdf-first-page-preview";
import {
  prepareEvidencePhotoUpload,
  type EvidencePhotoMetadata,
} from "@platform/app-shared/media/evidence-photo-upload";

export type PropertyDocKind =
  | "decree"
  | "delegation"
  | "deed"
  | "bourse-deed"
  | "keys-proof"
  | "other"
  | "registry"
  | "boundaries";

const API_SCOPE: Record<PropertyDocKind, string> = {
  decree: "property-decree",
  delegation: "property-delegation",
  deed: "property-deed-ownership",
  "bourse-deed": "property-bourse-deed",
  "keys-proof": "government-keys-proof",
  other: "property-other",
  registry: "property-registry",
  boundaries: "property-boundaries",
};

const KIND_BY_API_SCOPE: Partial<Record<string, PropertyDocKind>> =
  Object.fromEntries(
    (Object.entries(API_SCOPE) as [PropertyDocKind, string][]).map(
      ([kind, scope]) => [scope, kind],
    ),
  );

/** Kinds the property detail page hydrates together — keys-proof stays on its own path. */
const PROPERTY_DOC_PREFETCH_KINDS: readonly PropertyDocKind[] = [
  "decree",
  "delegation",
  "deed",
  "bourse-deed",
  "registry",
  "other",
  "boundaries",
];

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_PREVIEW_BYTES = 20 * 1024 * 1024;

export type CachedAssignmentDoc = {
  fileName: string;
  mimeType: string;
  dataUrl?: string;
  attachmentId?: string;
};

/** `fileName` is the name the server stored — the form keeps that one, not the local file's. */
type DocCacheResult = { ok: true; fileName?: string } | { ok: false; error: string };

/** Name + reason the server requires for a document outside the defined list («other»). */
type UnlistedDocumentDetails = {
  customDocumentLabel: string;
  customDocumentReason: string;
};

const docCache = new Map<string, CachedAssignmentDoc[]>();
const writeGeneration = new Map<string, number>();
const cacheListeners = new Set<() => void>();

function cacheKey(
  kind: PropertyDocKind,
  poNumber: string,
  propertyId: string,
): string {
  return `${kind}:${poNumber.trim()}:${propertyId}`;
}

function scopeKey(poNumber: string, propertyId: string): string {
  return `${poNumber.trim()}:${propertyId}`;
}

function notifyCacheListeners() {
  cacheListeners.forEach((listener) => listener());
}

export function subscribeAssignmentDocCache(listener: () => void): () => void {
  cacheListeners.add(listener);
  return () => {
    cacheListeners.delete(listener);
  };
}

function bumpWriteGeneration(key: string): number {
  const next = (writeGeneration.get(key) ?? 0) + 1;
  writeGeneration.set(key, next);
  return next;
}

function isCurrentGeneration(key: string, generation: number): boolean {
  return (writeGeneration.get(key) ?? 0) === generation;
}

function setCachedDocs(
  key: string,
  docs: CachedAssignmentDoc[],
  generation?: number,
): boolean {
  if (generation != null && !isCurrentGeneration(key, generation)) {
    return false;
  }
  docCache.set(key, docs);
  notifyCacheListeners();
  return true;
}

function upsertCachedDoc(
  key: string,
  payload: CachedAssignmentDoc,
  generation?: number,
): boolean {
  if (generation != null && !isCurrentGeneration(key, generation)) {
    return false;
  }
  const current = docCache.get(key) ?? [];
  const next = [
    ...current.filter((d) => d.fileName !== payload.fileName),
    payload,
  ];
  docCache.set(key, next);
  notifyCacheListeners();
  return true;
}

export function clearCachedPropertyDoc(
  kind: PropertyDocKind,
  poNumber: string,
  propertyId: string,
): void {
  if (!poNumber.trim() || !propertyId) return;
  const key = cacheKey(kind, poNumber, propertyId);
  bumpWriteGeneration(key);
  docCache.delete(key);
  forgetPropertyDocMetas(poNumber, propertyId);
  notifyCacheListeners();
  const config = prototypeModulesApiConfig();
  if (!config) return;
  void replaceScopeAttachments(API_SCOPE[kind], scopeKey(poNumber, propertyId));
}

export async function removeCachedPropertyDoc(
  kind: PropertyDocKind,
  poNumber: string,
  propertyId: string,
  fileName: string,
): Promise<void> {
  if (!poNumber.trim() || !propertyId || !fileName.trim()) return;
  const key = cacheKey(kind, poNumber, propertyId);
  const target = fileName.trim();
  const current = docCache.get(key) ?? [];
  const removed = current.find((d) => d.fileName === target);
  const next = current.filter((d) => d.fileName !== target);
  bumpWriteGeneration(key);
  if (next.length === 0) docCache.delete(key);
  else docCache.set(key, next);
  forgetPropertyDocMetas(poNumber, propertyId);
  notifyCacheListeners();

  const config = prototypeModulesApiConfig();
  if (!config) return;
  if (removed?.attachmentId) {
    await deleteAttachment(config, removed.attachmentId);
    return;
  }
  const listed = await listAttachments(
    config,
    API_SCOPE[kind],
    scopeKey(poNumber, propertyId),
  );
  if (!listed.ok) return;
  const match = listed.data.find((m) => m.fileName === target);
  if (match) await deleteAttachment(config, match.id);
}

async function replaceScopeAttachments(
  scope: string,
  key: string,
): Promise<void> {
  const config = prototypeModulesApiConfig();
  if (!config) return;
  const existing = await listAttachments(config, scope, key);
  if (!existing.ok) return;
  await Promise.all(
    existing.data.map((meta) => deleteAttachment(config, meta.id)),
  );
}

async function buildPreviewPayload(file: File): Promise<CachedAssignmentDoc> {
  const payload: CachedAssignmentDoc = {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
  };
  if (file.type.startsWith("image/") && file.size <= MAX_IMAGE_BYTES) {
    try {
      payload.dataUrl = await blobToDataUrl(file);
    } catch {
      /* metadata only */
    }
  } else if (isPdfFile(file) && file.size <= MAX_PDF_PREVIEW_BYTES) {
    try {
      payload.dataUrl = await pdfFileToFirstPageDataUrl(file);
    } catch {
      /* metadata only */
    }
  }
  return payload;
}

async function writeCachedDoc(
  kind: PropertyDocKind,
  poNumber: string,
  propertyId: string,
  file: File,
  options?: { replaceAll?: boolean; unlisted?: UnlistedDocumentDetails },
): Promise<DocCacheResult> {
  if (!poNumber.trim() || !propertyId) {
    return { ok: false, error: "بيانات العقار ناقصة." };
  }

  let uploadFile = file;
  let photoMetadata: EvidencePhotoMetadata | undefined;

  // Keys-proof images follow the evidence pipeline; PDFs/other docs stay raw.
  if (
    kind === "keys-proof" &&
    !isPdfFile(file) &&
    (file.type.startsWith("image/") ||
      /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name))
  ) {
    const prepared = await prepareEvidencePhotoUpload(file);
    if (!prepared.ok) return prepared;
    uploadFile = prepared.file;
    photoMetadata = prepared.photoMetadata;
  }

  const replaceAll = options?.replaceAll ?? kind === "keys-proof";
  const key = cacheKey(kind, poNumber, propertyId);
  const generation = bumpWriteGeneration(key);
  forgetPropertyDocMetas(poNumber, propertyId);

  if (replaceAll) {
    docCache.delete(key);
    notifyCacheListeners();
  }

  const payload = await buildPreviewPayload(uploadFile);
  if (!isCurrentGeneration(key, generation)) {
    return { ok: true };
  }

  if (replaceAll) {
    setCachedDocs(key, [{ ...payload }], generation);
  } else {
    upsertCachedDoc(key, { ...payload }, generation);
  }

  const config = prototypeModulesApiConfig();
  if (config) {
    const scope = API_SCOPE[kind];
    const sk = scopeKey(poNumber, propertyId);
    if (replaceAll) {
      await replaceScopeAttachments(scope, sk);
    }
    if (!isCurrentGeneration(key, generation)) {
      return { ok: true };
    }

    const upload = await uploadAttachment(config, {
      scope,
      scopeKey: sk,
      fileName: uploadFile.name,
      contentType: payload.mimeType,
      contentBase64: await fileToBase64(uploadFile),
      photoMetadata,
      customDocumentLabel: options?.unlisted?.customDocumentLabel ?? null,
      customDocumentReason: options?.unlisted?.customDocumentReason ?? null,
    });

    if (!isCurrentGeneration(key, generation)) {
      return { ok: true };
    }

    if (!upload.ok) {
      return {
        ok: false,
        error:
          upload.kind === "validation" && upload.message
            ? upload.message
            : "تعذّر رفع الملف — تحقق من الاتصال وحاول مجدداً.",
      };
    }
    payload.attachmentId = upload.data.id;
    // The server stores a cleaned-up name («.az.pdf» → «az.pdf»); the property keeps whatever name the cache
    // holds and later matches its documents by that name, so the cache must carry the stored one.
    const storedName = upload.data.fileName?.trim();
    if (storedName && storedName !== payload.fileName) {
      const localName = payload.fileName;
      payload.fileName = storedName;
      if (!replaceAll) {
        docCache.set(
          key,
          (docCache.get(key) ?? []).filter((d) => d.fileName !== localName),
        );
      }
    }
    if (replaceAll) {
      setCachedDocs(key, [payload], generation);
    } else {
      upsertCachedDoc(key, payload, generation);
    }
  }

  return { ok: true, fileName: payload.fileName };
}

export async function cacheAssignmentDoc(
  poNumber: string,
  propertyId: string,
  file: File,
): Promise<DocCacheResult> {
  return writeCachedDoc("decree", poNumber, propertyId, file, {
    replaceAll: false,
  });
}

export async function cacheDelegationDoc(
  poNumber: string,
  propertyId: string,
  file: File,
): Promise<DocCacheResult> {
  return writeCachedDoc("delegation", poNumber, propertyId, file, {
    replaceAll: false,
  });
}

export async function cacheRegistryDoc(
  poNumber: string,
  propertyId: string,
  file: File,
): Promise<DocCacheResult> {
  return writeCachedDoc("registry", poNumber, propertyId, file, {
    replaceAll: true,
  });
}

export async function cacheDeedOwnershipDoc(
  poNumber: string,
  propertyId: string,
  file: File,
): Promise<DocCacheResult> {
  return writeCachedDoc("deed", poNumber, propertyId, file, {
    replaceAll: true,
  });
}

export async function cacheBourseDeedImageDoc(
  poNumber: string,
  propertyId: string,
  file: File,
): Promise<DocCacheResult> {
  return writeCachedDoc("bourse-deed", poNumber, propertyId, file, {
    replaceAll: true,
  });
}

/** «مستند الحدود» from the bourse step — one file, replaced on re-upload. */
export async function cacheBoundariesDoc(
  poNumber: string,
  propertyId: string,
  file: File,
): Promise<DocCacheResult> {
  return writeCachedDoc("boundaries", poNumber, propertyId, file, {
    replaceAll: true,
  });
}

/** «Other documents» are unlisted: the server keeps them for review with the name and reason. */
export async function cacheOtherPropertyDoc(
  poNumber: string,
  propertyId: string,
  file: File,
  unlisted: UnlistedDocumentDetails,
): Promise<DocCacheResult> {
  return writeCachedDoc("other", poNumber, propertyId, file, {
    replaceAll: false,
    unlisted,
  });
}

function readCachedDocs(
  kind: PropertyDocKind,
  poNumber: string,
  propertyId: string,
): CachedAssignmentDoc[] {
  if (!poNumber.trim() || !propertyId) return [];
  return docCache.get(cacheKey(kind, poNumber, propertyId)) ?? [];
}

/**
 * Finds the cached document of one kind that a property's saved file name points at.
 *
 * How it works: reads the cached documents of (kind, PO, property). With no expected name it returns the first
 * one. Otherwise it returns the document whose name is equal to the expected name, or equal once both sides
 * are reduced with `storedFileNameOf`.
 *
 * Edge cases and how they were fixed: forms keep the name of the file the user picked, while the attachments
 * service stores a cleaned-up name (a file called `.deed.pdf` is stored as `deed.pdf`). An exact comparison
 * therefore missed the document, and the deed vanished from the documents checklist ("mandatory document
 * not uploaded"). Comparing the stored forms closes that gap. No document at all returns `null`.
 */
export function getCachedPropertyDocMatching(
  kind: PropertyDocKind,
  poNumber: string,
  propertyId: string,
  expectedFileName?: string,
): CachedAssignmentDoc | null {
  const docs = readCachedDocs(kind, poNumber, propertyId);
  if (docs.length === 0) return null;
  const expected = expectedFileName?.trim();
  if (!expected) return docs[0] ?? null;
  const expectedStored = storedFileNameOf(expected);
  return (
    docs.find(
      (d) => d.fileName === expected || storedFileNameOf(d.fileName) === expectedStored,
    ) ?? null
  );
}

/**
 * The name the attachments service keeps for an uploaded file.
 *
 * How it works (mirrors `AttachmentUploadRules.SanitizeFileName` on the server, in this order): keep only the part
 * after the last `\`, `/` or `:`; remove reserved characters (`<>:"/\|?*` and control characters); trim; strip
 * leading and trailing dots; trim again; keep only the LAST 200 characters of a long name.
 *
 * Edge cases: forms keep the user's own file name, so every lookup by name must compare both sides through this
 * function (`.deed.pdf` and `deed.pdf` are the same stored file). If the server's rule changes, change this
 * function with it — `stored-file-name.test.ts` pins the cases.
 */
export function storedFileNameOf(name: string): string {
  const base = name.trim().split(/[\\/:]/).pop() ?? "";
  const cleaned = base
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .trim();
  // The service keeps only the last 200 characters of a long name.
  return cleaned.length > STORED_FILE_NAME_MAX ? cleaned.slice(-STORED_FILE_NAME_MAX) : cleaned;
}

const STORED_FILE_NAME_MAX = 200;

/**
 * Deletes every per-field document row of a property. Used for the client-side id a new
 * property was uploaded under once its files were copied onto the server id, so nothing
 * lingers under a key no screen will ever list.
 */
export async function discardPropertyDocuments(
  poNumber: string,
  propertyId: string,
): Promise<void> {
  if (!poNumber.trim() || !propertyId) return;
  const config = prototypeModulesApiConfig();
  if (!config) return;
  await Promise.all(
    PROPERTY_DOC_PREFETCH_KINDS.map((kind) =>
      replaceScopeAttachments(API_SCOPE[kind], scopeKey(poNumber, propertyId)),
    ),
  );
  for (const kind of PROPERTY_DOC_PREFETCH_KINDS) {
    docCache.delete(cacheKey(kind, poNumber, propertyId));
  }
  forgetPropertyDocMetas(poNumber, propertyId);
  notifyCacheListeners();
}

async function hydrateOneMeta(
  kind: PropertyDocKind,
  poNumber: string,
  propertyId: string,
  meta: { id: string; fileName: string; contentType: string },
  generationAtStart: number,
): Promise<void> {
  const key = cacheKey(kind, poNumber, propertyId);
  const config = prototypeModulesApiConfig();
  if (!config) return;

  const existing = getCachedPropertyDocMatching(
    kind,
    poNumber,
    propertyId,
    meta.fileName,
  );
  if (existing?.dataUrl) return;

  const blobResult = await downloadAttachmentBlobOnce(config, meta.id);
  if (!isCurrentGeneration(key, generationAtStart)) return;

  const payload: CachedAssignmentDoc = {
    fileName: meta.fileName,
    mimeType: meta.contentType,
    attachmentId: meta.id,
  };

  let blob: Blob | null = blobResult.ok ? blobResult.data : null;
  if (!blob) {
    const userId = currentOfflineUserId();
    if (userId) {
      const cached = await getOfflineBlob(userId, meta.id);
      if (cached?.bytes) {
        blob = new Blob([cached.bytes], { type: cached.contentType });
      }
    }
  }

  if (!blob) {
    upsertCachedDoc(key, payload, generationAtStart);
    return;
  }

  if (
    meta.contentType.startsWith("image/") &&
    blob.size <= MAX_IMAGE_BYTES
  ) {
    try {
      payload.dataUrl = await blobToDataUrl(blob);
    } catch {
      /* metadata only */
    }
  } else if (
    isPdfMeta(meta.contentType, meta.fileName) &&
    blob.size <= MAX_PDF_PREVIEW_BYTES
  ) {
    try {
      payload.dataUrl = await pdfBlobToFirstPageDataUrl(blob);
    } catch {
      /* metadata only */
    }
  }

  if (!isCurrentGeneration(key, generationAtStart)) return;
  upsertCachedDoc(key, payload, generationAtStart);
}

async function hydrateKindFromApi(
  kind: PropertyDocKind,
  poNumber: string,
  propertyId: string,
  expectedFileName?: string,
): Promise<void> {
  const config = prototypeModulesApiConfig();
  if (!config || !poNumber.trim() || !propertyId) return;

  const key = cacheKey(kind, poNumber, propertyId);
  const generationAtStart = writeGeneration.get(key) ?? 0;
  const expected = expectedFileName?.trim();

  if (expected) {
    const existing = getCachedPropertyDocMatching(
      kind,
      poNumber,
      propertyId,
      expected,
    );
    if (existing?.dataUrl) return;
  }

  const listed = await listAttachments(
    config,
    API_SCOPE[kind],
    scopeKey(poNumber, propertyId),
  );
  if (!isCurrentGeneration(key, generationAtStart)) return;
  if (!listed.ok || listed.data.length === 0) return;

  const metas = expected
    ? listed.data.filter((m) => m.fileName === expected)
    : listed.data;

  await Promise.all(
    metas.map((meta) =>
      hydrateOneMeta(kind, poNumber, propertyId, meta, generationAtStart),
    ),
  );
}

type PropertyDocMetasByKind = Map<PropertyDocKind, FileAttachmentMetaDto[]>;

/**
 * The `for-property` list, shared: the primary-photo path on the basic tab and
 * the full prefetch on the documents tab both need it, so the first caller pays
 * the request and the other reuses it while fresh. Any write to a property
 * scope forgets it (`forgetPropertyDocMetas`).
 */
const META_STALE_MS = 60_000;
const propertyDocMetas = new Map<
  string,
  { promise: Promise<PropertyDocMetasByKind | null>; settledAt: number | null }
>();

function forgetPropertyDocMetas(poNumber: string, propertyId: string): void {
  propertyDocMetas.delete(scopeKey(poNumber, propertyId));
}

/**
 * Every document scope of one property in a single request.
 *
 * `GET /api/attachments/for-property` matches `scopeKey == needle` or
 * `scopeKey startsWith needle + ":"`, and property documents are keyed
 * `po:propertyId`, so the compound scope key is the needle. Rows carry `scope`,
 * so they group by kind client-side — this replaces seven parallel per-scope
 * `GET /api/attachments` calls (fanout doc, 2026-09-04).
 */
function fetchPropertyDocMetas(
  poNumber: string,
  propertyId: string,
): Promise<PropertyDocMetasByKind | null> {
  const config = prototypeModulesApiConfig();
  if (!config || !poNumber.trim() || !propertyId) return Promise.resolve(null);

  const sk = scopeKey(poNumber, propertyId);
  const existing = propertyDocMetas.get(sk);
  if (
    existing &&
    (existing.settledAt === null ||
      Date.now() - existing.settledAt < META_STALE_MS)
  ) {
    return existing.promise;
  }

  const entry = {
    promise: Promise.resolve<PropertyDocMetasByKind | null>(null),
    settledAt: null as number | null,
  };
  entry.promise = listAttachmentsForProperty(config, sk).then((listed) => {
    if (propertyDocMetas.get(sk) !== entry) return null;
    if (!listed.ok) {
      propertyDocMetas.delete(sk);
      return null;
    }
    entry.settledAt = Date.now();
    const byKind: PropertyDocMetasByKind = new Map();
    for (const meta of listed.data) {
      if (meta.scopeKey !== sk) continue;
      const kind = KIND_BY_API_SCOPE[meta.scope];
      if (!kind || !PROPERTY_DOC_PREFETCH_KINDS.includes(kind)) continue;
      const bucket = byKind.get(kind);
      if (bucket) bucket.push(meta);
      else byKind.set(kind, [meta]);
    }
    return byKind;
  });
  propertyDocMetas.set(sk, entry);
  return entry.promise;
}

/**
 * Cache the *metadata* of every property document (name, type, attachment id)
 * without downloading anything, so `collectIntakeDocuments` can list them.
 * Entries that already hold a preview are left alone. One request at most.
 */
export async function primePropertyDocMetadata(
  poNumber: string,
  propertyId: string,
): Promise<void> {
  const metas = await fetchPropertyDocMetas(poNumber, propertyId);
  if (!metas) return;
  for (const [kind, rows] of metas) {
    const key = cacheKey(kind, poNumber, propertyId);
    for (const meta of rows) {
      const existing = getCachedPropertyDocMatching(
        kind,
        poNumber,
        propertyId,
        meta.fileName,
      );
      if (existing) continue;
      upsertCachedDoc(key, {
        fileName: meta.fileName,
        mimeType: meta.contentType,
        attachmentId: meta.id,
      });
    }
  }
}

/**
 * Download the preview for exactly one cached property document (by attachment
 * id) — the basic tab's primary photo. Goes through the same per-kind cache and
 * blob once-cache as the full prefetch, so opening the documents tab later
 * reuses it instead of downloading again.
 */
export async function hydrateCachedPropertyDocPreview(
  poNumber: string,
  propertyId: string,
  attachmentId: string,
): Promise<void> {
  const id = attachmentId.trim();
  if (!id || !poNumber.trim() || !propertyId) return;
  for (const kind of PROPERTY_DOC_PREFETCH_KINDS) {
    const match = readCachedDocs(kind, poNumber, propertyId).find(
      (doc) => doc.attachmentId === id,
    );
    if (!match) continue;
    if (match.dataUrl) return;
    const key = cacheKey(kind, poNumber, propertyId);
    await hydrateOneMeta(
      kind,
      poNumber,
      propertyId,
      { id, fileName: match.fileName, contentType: match.mimeType },
      writeGeneration.get(key) ?? 0,
    );
    return;
  }
}

async function hydrateAllKindsFromApi(
  poNumber: string,
  propertyId: string,
): Promise<void> {
  const generationAtStart = new Map<PropertyDocKind, number>(
    PROPERTY_DOC_PREFETCH_KINDS.map((kind) => [
      kind,
      writeGeneration.get(cacheKey(kind, poNumber, propertyId)) ?? 0,
    ]),
  );

  const byKind = await fetchPropertyDocMetas(poNumber, propertyId);
  if (!byKind || byKind.size === 0) return;

  await Promise.all(
    [...byKind].map(async ([kind, metas]) => {
      const generation = generationAtStart.get(kind) ?? 0;
      if (!isCurrentGeneration(cacheKey(kind, poNumber, propertyId), generation)) {
        return;
      }
      await Promise.all(
        metas.map((meta) =>
          hydrateOneMeta(kind, poNumber, propertyId, meta, generation),
        ),
      );
    }),
  );
}

/** The documents effect re-runs as task ids resolve — share the run, not the requests. */
const inFlightPropertyPrefetch = new Map<string, Promise<void>>();

export function prefetchPropertyDocAttachments(
  poNumber: string,
  propertyId: string,
  options?: { kind?: PropertyDocKind; expectedFileName?: string },
): Promise<void> {
  if (options?.kind) {
    return hydrateKindFromApi(
      options.kind,
      poNumber,
      propertyId,
      options.expectedFileName,
    );
  }

  const key = scopeKey(poNumber, propertyId);
  const pending = inFlightPropertyPrefetch.get(key);
  if (pending) return pending;

  const run = hydrateAllKindsFromApi(poNumber, propertyId);
  inFlightPropertyPrefetch.set(key, run);
  void run.finally(() => {
    if (inFlightPropertyPrefetch.get(key) === run) {
      inFlightPropertyPrefetch.delete(key);
    }
  });
  return run;
}

export async function prefetchKeysProofDoc(
  poNumber: string,
  propertyId: string,
  expectedFileName?: string,
): Promise<void> {
  await hydrateKindFromApi(
    "keys-proof",
    poNumber,
    propertyId,
    expectedFileName,
  );
}

export type ClonedPropertyDocNames = {
  assignmentDocFileNames: string[];
  delegationLetterFileNames: string[];
  otherDocumentFileNames: string[];
  realEstateRegFileName: string;
  deedOwnershipFileName: string;
  bourseDeedImageFileName: string;
  boundariesExternalDocName: string;
};

/**
 * Clone attachment bytes from a prior property (PO + id) onto the current slot.
 * Replaces target scopes so the new transaction has its own independent copies.
 */
export async function clonePropertyDocumentsFromPrior(
  sourcePo: string,
  sourcePropertyId: string,
  targetPo: string,
  targetPropertyId: string,
): Promise<ClonedPropertyDocNames> {
  const empty: ClonedPropertyDocNames = {
    assignmentDocFileNames: [],
    delegationLetterFileNames: [],
    otherDocumentFileNames: [],
    realEstateRegFileName: "",
    deedOwnershipFileName: "",
    bourseDeedImageFileName: "",
    boundariesExternalDocName: "",
  };
  const fromPo = sourcePo.trim();
  const toPo = targetPo.trim();
  const fromId = sourcePropertyId.trim();
  const toId = targetPropertyId.trim();
  if (!fromPo || !toPo || !fromId || !toId) return empty;
  if (fromPo === toPo && fromId === toId) return empty;

  const config = prototypeModulesApiConfig();
  if (!config) return empty;

  return cloneAllPropertyDocKinds(config, fromPo, fromId, toPo, toId);
}

/**
 * Copies every document kind of one property onto another (a new transaction) and returns the
 * copied file names per kind.
 *
 * How it works: runs `clonePropertyDocKind` for the seven kinds (decree, delegation, other,
 * registry, deed, bourse-deed, boundaries) in parallel; each kind wipes the target first, then
 * copies. Multi-file kinds return their name lists; single-file kinds return the first name or "".
 *
 * Edge cases: removed the grouped-property "fill-empty" mode with grouped
 * properties (linked deeds now share one transaction instead of copying files), so cloning only
 * replaces.
 */
async function cloneAllPropertyDocKinds(
  config: NonNullable<ReturnType<typeof prototypeModulesApiConfig>>,
  fromPo: string,
  fromId: string,
  toPo: string,
  toId: string,
): Promise<ClonedPropertyDocNames> {
  const cloneKind = (kind: PropertyDocKind) =>
    clonePropertyDocKind(config, kind, fromPo, fromId, toPo, toId);
  const [decree, delegation, other, registry, deedOwnership, bourseDeed, boundaries] =
    await Promise.all([
      cloneKind("decree"),
      cloneKind("delegation"),
      cloneKind("other"),
      cloneKind("registry"),
      cloneKind("deed"),
      cloneKind("bourse-deed"),
      cloneKind("boundaries"),
    ]);
  return {
    assignmentDocFileNames: decree,
    delegationLetterFileNames: delegation,
    otherDocumentFileNames: other,
    realEstateRegFileName: registry[0] ?? "",
    deedOwnershipFileName: deedOwnership[0] ?? "",
    bourseDeedImageFileName: bourseDeed[0] ?? "",
    boundariesExternalDocName: boundaries[0] ?? "",
  };
}

/**
 * Copies one document kind from the source property's scope to the target's.
 *
 * How it works: 1) lists the source scope; 2) wipes the target scope and clears its write
 * generation, doc metas and cache entry, then notifies listeners; 3) downloads each source file,
 * re-uploads it to the target scope (keeping an unlisted document's label and reason) and adds it
 * to the target cache. Returns the names that were copied.
 *
 * Edge cases: an unreadable or empty source returns [] before the target is touched; a file that
 * fails to download or upload is left out of the result. The "fill-empty" branch (copy only onto
 * an empty target) was removed with grouped properties.
 */
async function clonePropertyDocKind(
  config: NonNullable<ReturnType<typeof prototypeModulesApiConfig>>,
  kind: PropertyDocKind,
  fromPo: string,
  fromId: string,
  toPo: string,
  toId: string,
): Promise<string[]> {
  const listed = await listAttachments(config, API_SCOPE[kind], scopeKey(fromPo, fromId));
  if (!listed.ok || listed.data.length === 0) return [];

  const targetCacheKey = cacheKey(kind, toPo, toId);
  // Wipe target scope first so we do not mix old and new names.
  await replaceScopeAttachments(API_SCOPE[kind], scopeKey(toPo, toId));
  bumpWriteGeneration(targetCacheKey);
  forgetPropertyDocMetas(toPo, toId);
  docCache.delete(targetCacheKey);
  notifyCacheListeners();

  const names = await Promise.all(
    listed.data.map(async (meta) => {
      const blobResult = await downloadAttachmentBlob(config, meta.id);
      if (!blobResult.ok) return null;
      const contentBase64 = await blobToBase64(blobResult.data);
      const upload = await uploadAttachment(config, {
        scope: API_SCOPE[kind],
        scopeKey: scopeKey(toPo, toId),
        fileName: meta.fileName,
        contentType: meta.contentType || "application/octet-stream",
        contentBase64,
        // Unlisted copies keep the original name + reason (the server requires them).
        customDocumentLabel: meta.customDocumentLabel ?? null,
        customDocumentReason: meta.customDocumentReason ?? null,
      });
      if (!upload.ok) return null;
      upsertCachedDoc(targetCacheKey, {
        fileName: upload.data.fileName || meta.fileName,
        mimeType: upload.data.contentType || meta.contentType,
        attachmentId: upload.data.id,
      });
      return upload.data.fileName || meta.fileName;
    }),
  );
  return names.filter((name): name is string => name !== null);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function isPdfMime(mimeType: string, fileName = ""): boolean {
  return isPdfMeta(mimeType, fileName);
}

function isPdfFile(file: File): boolean {
  return isPdfMeta(file.type, file.name);
}

function isPdfMeta(mimeType: string, fileName: string): boolean {
  return (
    mimeType === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf")
  );
}
