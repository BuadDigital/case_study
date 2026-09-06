import {
  downloadAttachmentBlob,
  type PrototypeModulesApiConfig,
  type PrototypeModulesResult,
} from "@platform/api-client";

/**
 * One `GET /api/attachments/{id}` per attachment id per page load.
 *
 * Every preview path on the property detail page (intake documents, inspector
 * photos, task-scoped party files) ends in `downloadAttachmentBlob`, and the
 * effects that drive them re-run while the first download is still in flight —
 * measured at 36 downloads for 19 distinct ids
 * (docs/architecture/property-detail-fanout-2026-09-04.md). This is the
 * non-hook equivalent of one shared TanStack query key with a `staleTime`:
 * concurrent callers share the in-flight promise, and a successful result stays
 * fresh for `STALE_MS` so the thumbnail and the viewer read the same bytes.
 * Failures are not retained, so a retry can still succeed.
 */
const STALE_MS = 10 * 60_000;

type Entry = {
  promise: Promise<PrototypeModulesResult<Blob>>;
  /** `null` while in flight; set on success so staleness can be checked. */
  settledAt: number | null;
};

const entries = new Map<string, Entry>();

function isFresh(entry: Entry, now: number): boolean {
  return entry.settledAt === null || now - entry.settledAt < STALE_MS;
}

export function downloadAttachmentBlobOnce(
  config: PrototypeModulesApiConfig,
  id: string,
): Promise<PrototypeModulesResult<Blob>> {
  const key = id.trim();
  if (!key) return downloadAttachmentBlob(config, id);

  const existing = entries.get(key);
  if (existing && isFresh(existing, Date.now())) return existing.promise;

  const entry: Entry = {
    promise: Promise.resolve({ ok: false, kind: "network" }),
    settledAt: null,
  };
  entry.promise = downloadAttachmentBlob(config, key).then(
    (result) => {
      if (entries.get(key) === entry) {
        if (result.ok) entry.settledAt = Date.now();
        else entries.delete(key);
      }
      return result;
    },
    (error: unknown) => {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    },
  );
  entries.set(key, entry);
  return entry.promise;
}

/** Drop one cached blob — after the attachment is deleted or replaced. */
export function forgetAttachmentBlob(id: string): void {
  entries.delete(id.trim());
}

/** Test seam: forget everything. */
export function clearAttachmentBlobCache(): void {
  entries.clear();
}
