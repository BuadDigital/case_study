/**
 * Property document uploads — persisted via `/api/attachments`.
 * Filenames are also saved on the work-order property API.
 * Decree / delegation support multiple files per property; keys-proof stays single.
 */
import {
  deleteAttachment,
  downloadAttachmentBlob,
  listAttachments,
  uploadAttachment,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import {
  pdfBlobToFirstPageDataUrl,
  pdfFileToFirstPageDataUrl,
} from "./pdf-first-page-preview";

export type PropertyDocKind = "decree" | "delegation" | "keys-proof" | "other";

const API_SCOPE: Record<PropertyDocKind, string> = {
  decree: "property-decree",
  delegation: "property-delegation",
  "keys-proof": "government-keys-proof",
  other: "property-other",
};

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_PREVIEW_BYTES = 20 * 1024 * 1024;

export type CachedAssignmentDoc = {
  fileName: string;
  mimeType: string;
  dataUrl?: string;
  attachmentId?: string;
};

export type DocCacheResult = { ok: true } | { ok: false; error: string };

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

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
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
      payload.dataUrl = await readAsDataUrl(file);
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
  options?: { replaceAll?: boolean },
): Promise<DocCacheResult> {
  if (!poNumber.trim() || !propertyId) {
    return { ok: false, error: "بيانات العقار ناقصة." };
  }

  const replaceAll = options?.replaceAll ?? kind === "keys-proof";
  const key = cacheKey(kind, poNumber, propertyId);
  const generation = bumpWriteGeneration(key);

  if (replaceAll) {
    docCache.delete(key);
    notifyCacheListeners();
  }

  const payload = await buildPreviewPayload(file);
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
      fileName: file.name,
      contentType: payload.mimeType,
      contentBase64: await fileToBase64(file),
    });

    if (!isCurrentGeneration(key, generation)) {
      return { ok: true };
    }

    if (!upload.ok) {
      return {
        ok: false,
        error: "تعذّر رفع الملف — تحقق من الاتصال وحاول مجدداً.",
      };
    }
    payload.attachmentId = upload.data.id;
    if (replaceAll) {
      setCachedDocs(key, [payload], generation);
    } else {
      upsertCachedDoc(key, payload, generation);
    }
  }

  return { ok: true };
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

export async function cacheKeysProofDoc(
  poNumber: string,
  propertyId: string,
  file: File,
): Promise<DocCacheResult> {
  return writeCachedDoc("keys-proof", poNumber, propertyId, file, {
    replaceAll: true,
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

function readCachedDoc(
  kind: PropertyDocKind,
  poNumber: string,
  propertyId: string,
): CachedAssignmentDoc | null {
  return readCachedDocs(kind, poNumber, propertyId)[0] ?? null;
}

export function getCachedAssignmentDoc(
  poNumber: string,
  propertyId: string,
): CachedAssignmentDoc | null {
  return readCachedDoc("decree", poNumber, propertyId);
}

export function getCachedDelegationDoc(
  poNumber: string,
  propertyId: string,
): CachedAssignmentDoc | null {
  return readCachedDoc("delegation", poNumber, propertyId);
}

export function getCachedKeysProofDoc(
  poNumber: string,
  propertyId: string,
): CachedAssignmentDoc | null {
  return readCachedDoc("keys-proof", poNumber, propertyId);
}

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
  return docs.find((d) => d.fileName === expected) ?? null;
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

  const blobResult = await downloadAttachmentBlob(config, meta.id);
  if (!isCurrentGeneration(key, generationAtStart)) return;

  const payload: CachedAssignmentDoc = {
    fileName: meta.fileName,
    mimeType: meta.contentType,
    attachmentId: meta.id,
  };

  if (!blobResult.ok) {
    upsertCachedDoc(key, payload, generationAtStart);
    return;
  }

  if (
    meta.contentType.startsWith("image/") &&
    blobResult.data.size <= MAX_IMAGE_BYTES
  ) {
    try {
      payload.dataUrl = await blobToDataUrl(blobResult.data);
    } catch {
      /* metadata only */
    }
  } else if (
    isPdfMeta(meta.contentType, meta.fileName) &&
    blobResult.data.size <= MAX_PDF_PREVIEW_BYTES
  ) {
    try {
      payload.dataUrl = await pdfBlobToFirstPageDataUrl(blobResult.data);
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

export async function prefetchPropertyDocAttachments(
  poNumber: string,
  propertyId: string,
  options?: { kind?: PropertyDocKind; expectedFileName?: string },
): Promise<void> {
  if (options?.kind) {
    await hydrateKindFromApi(
      options.kind,
      poNumber,
      propertyId,
      options.expectedFileName,
    );
    return;
  }
  await Promise.all([
    hydrateKindFromApi("decree", poNumber, propertyId),
    hydrateKindFromApi("delegation", poNumber, propertyId),
  ]);
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
