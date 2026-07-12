/**

 * Property document uploads — persisted via `/api/attachments`.

 * Filenames are also saved on the work-order property API.

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



const docCache = new Map<string, CachedAssignmentDoc>();

/** Bumps whenever a write/clear starts so in-flight prefetches cannot overwrite newer data. */

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



function setCachedDoc(

  key: string,

  payload: CachedAssignmentDoc,

  generation?: number,

): boolean {

  if (generation != null && !isCurrentGeneration(key, generation)) {

    return false;

  }

  docCache.set(key, payload);

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

  if (docCache.delete(key)) {

    notifyCacheListeners();

  } else {

    notifyCacheListeners();

  }

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

): Promise<DocCacheResult> {

  if (!poNumber.trim() || !propertyId) {

    return { ok: false, error: "بيانات العقار ناقصة." };

  }



  const key = cacheKey(kind, poNumber, propertyId);

  const generation = bumpWriteGeneration(key);

  // Drop the previous preview immediately so the UI never shows a stale file.

  docCache.delete(key);

  notifyCacheListeners();



  const payload = await buildPreviewPayload(file);

  if (!isCurrentGeneration(key, generation)) {

    return { ok: true };

  }



  // Show the new preview as soon as it is ready (before API upload finishes).

  setCachedDoc(key, { ...payload }, generation);



  const config = prototypeModulesApiConfig();

  if (config) {

    const scope = API_SCOPE[kind];

    const sk = scopeKey(poNumber, propertyId);

    await replaceScopeAttachments(scope, sk);



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

      return { ok: false, error: "تعذّر رفع الملف — تحقق من الاتصال وحاول مجدداً." };

    }

    payload.attachmentId = upload.data.id;

    setCachedDoc(key, payload, generation);

  }



  return { ok: true };

}



export async function cacheAssignmentDoc(

  poNumber: string,

  propertyId: string,

  file: File,

): Promise<DocCacheResult> {

  return writeCachedDoc("decree", poNumber, propertyId, file);

}



export async function cacheDelegationDoc(

  poNumber: string,

  propertyId: string,

  file: File,

): Promise<DocCacheResult> {

  return writeCachedDoc("delegation", poNumber, propertyId, file);

}



export async function cacheKeysProofDoc(

  poNumber: string,

  propertyId: string,

  file: File,

): Promise<DocCacheResult> {

  return writeCachedDoc("keys-proof", poNumber, propertyId, file);

}



function readCachedDoc(

  kind: PropertyDocKind,

  poNumber: string,

  propertyId: string,

): CachedAssignmentDoc | null {

  if (!poNumber.trim() || !propertyId) return null;

  return docCache.get(cacheKey(kind, poNumber, propertyId)) ?? null;

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



/**

 * Prefer the in-memory cache only when it matches the expected file name.

 * Prevents showing a previous image/PDF under a newly chosen file name.

 */

export function getCachedPropertyDocMatching(

  kind: PropertyDocKind,

  poNumber: string,

  propertyId: string,

  expectedFileName?: string,

): CachedAssignmentDoc | null {

  const cached = readCachedDoc(kind, poNumber, propertyId);

  if (!cached) return null;

  const expected = expectedFileName?.trim();

  if (expected && cached.fileName !== expected) return null;

  return cached;

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



  const existing = docCache.get(key);

  if (existing && (!expected || existing.fileName === expected) && existing.dataUrl) {

    return;

  }



  const scope = API_SCOPE[kind];

  const sk = scopeKey(poNumber, propertyId);

  const listed = await listAttachments(config, scope, sk);

  if (!isCurrentGeneration(key, generationAtStart)) return;

  if (!listed.ok || listed.data.length === 0) return;



  const meta = listed.data[0]!;

  if (expected && meta.fileName !== expected) {

    // API still has the previous file while a replace is in flight.

    return;

  }



  const blobResult = await downloadAttachmentBlob(config, meta.id);

  if (!isCurrentGeneration(key, generationAtStart)) return;



  if (!blobResult.ok) {

    setCachedDoc(

      key,

      {

        fileName: meta.fileName,

        mimeType: meta.contentType,

        attachmentId: meta.id,

      },

      generationAtStart,

    );

    return;

  }



  const payload: CachedAssignmentDoc = {

    fileName: meta.fileName,

    mimeType: meta.contentType,

    attachmentId: meta.id,

  };



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

  setCachedDoc(key, payload, generationAtStart);

}



/** Hydrate in-memory previews from the attachments API (e.g. after page reload). */

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



/** Hydrate keys-proof preview for government review (after reload). */

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


