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

export type PropertyDocKind = "decree" | "delegation" | "keys-proof" | "other";

const API_SCOPE: Record<PropertyDocKind, string> = {
  decree: "property-decree",
  delegation: "property-delegation",
  "keys-proof": "government-keys-proof",
  other: "property-other",
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type CachedAssignmentDoc = {
  fileName: string;
  mimeType: string;
  dataUrl?: string;
  attachmentId?: string;
};

export type DocCacheResult = { ok: true } | { ok: false; error: string };

const docCache = new Map<string, CachedAssignmentDoc>();

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
  }

  const config = prototypeModulesApiConfig();
  if (config) {
    const scope = API_SCOPE[kind];
    const sk = scopeKey(poNumber, propertyId);
    await replaceScopeAttachments(scope, sk);

    const upload = await uploadAttachment(config, {
      scope,
      scopeKey: sk,
      fileName: file.name,
      contentType: payload.mimeType,
      contentBase64: await fileToBase64(file),
    });

    if (!upload.ok) {
      return { ok: false, error: "تعذّر رفع الملف — تحقق من الاتصال وحاول مجدداً." };
    }
    payload.attachmentId = upload.data.id;
  }

  docCache.set(key, payload);
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

/** Hydrate in-memory previews from the attachments API (e.g. after page reload). */
export async function prefetchPropertyDocAttachments(
  poNumber: string,
  propertyId: string,
): Promise<void> {
  const config = prototypeModulesApiConfig();
  if (!config || !poNumber.trim() || !propertyId) return;

  const sk = scopeKey(poNumber, propertyId);
  const kinds: PropertyDocKind[] = ["decree", "delegation"];

  await Promise.all(
    kinds.map(async (kind) => {
      const scope = API_SCOPE[kind];
      const listed = await listAttachments(config, scope, sk);
      if (!listed.ok || listed.data.length === 0) return;

      const meta = listed.data[0]!;
      const blobResult = await downloadAttachmentBlob(config, meta.id);
      if (!blobResult.ok) {
        docCache.set(cacheKey(kind, poNumber, propertyId), {
          fileName: meta.fileName,
          mimeType: meta.contentType,
          attachmentId: meta.id,
        });
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
      }

      docCache.set(cacheKey(kind, poNumber, propertyId), payload);
    }),
  );
}

/** Hydrate keys-proof preview for government review (after reload). */
export async function prefetchKeysProofDoc(
  poNumber: string,
  propertyId: string,
): Promise<void> {
  const config = prototypeModulesApiConfig();
  if (!config || !poNumber.trim() || !propertyId) return;

  const kind: PropertyDocKind = "keys-proof";
  const scope = API_SCOPE[kind];
  const sk = scopeKey(poNumber, propertyId);
  const listed = await listAttachments(config, scope, sk);
  if (!listed.ok || listed.data.length === 0) return;

  const meta = listed.data[0]!;
  const blobResult = await downloadAttachmentBlob(config, meta.id);
  if (!blobResult.ok) {
    docCache.set(cacheKey(kind, poNumber, propertyId), {
      fileName: meta.fileName,
      mimeType: meta.contentType,
      attachmentId: meta.id,
    });
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
  }

  docCache.set(cacheKey(kind, poNumber, propertyId), payload);
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}
