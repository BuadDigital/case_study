/**
 * Debounced soft autosave for «البيانات الأولية» / «استعلام بورصة» fields.
 * Keyed by `poNumber|propertyId` so each صك keeps its own draft and timers
 * never write across properties. Closing the panel flushes to the server.
 * Drafts are dropped after a successful persist, and reopen ignores a draft
 * that is older than the fetched property's updatedAt.
 */
import type { PoPropertyIntake } from "./po-intake-data";
import { updatePropertyInPo } from "./po-intake-commands";
import { notifyWorkOrderPropertyChanged } from "../work-orders-api-config";

const SAVE_DEBOUNCE_MS = 400;

const drafts = new Map<string, PoPropertyIntake>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Map<string, Promise<boolean>>();
/** False while the key has no real server property id yet — draft only, no network write. */
const persistable = new Map<string, boolean>();
/** Server updatedAt the draft was based on — reopen yields if the fetch is newer. */
const basedOnUpdatedAt = new Map<string, string>();
const queuedAtMs = new Map<string, number>();
/** Last successful persist for this key — the next draft is based on that write. */
const lastPersistedUpdatedAt = new Map<string, string>();
let pagehideBound = false;

export function propertyFieldAutosaveKey(
  poNumber: string,
  propertyId: string,
): string {
  return `${poNumber.trim()}|${propertyId.trim()}`;
}

function filled(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

/** True when the draft has at least one field the specialist actually entered. */
export function isMeaningfulPropertyDraft(
  property: PoPropertyIntake | null | undefined,
): property is PoPropertyIntake {
  if (!property) return false;
  if (
    filled(property.deedNumber) ||
    filled(property.realEstateRegNumber) ||
    filled(property.ownerName) ||
    filled(property.requestNumber) ||
    filled(property.city) ||
    filled(property.district) ||
    filled(property.area) ||
    filled(property.planNumber) ||
    filled(property.plotNumber) ||
    filled(property.classification) ||
    filled(property.propertyType) ||
    filled(property.deedOwnershipFileName) ||
    filled(property.realEstateRegFileName) ||
    filled(property.bourseDeedImageFileName)
  ) {
    return true;
  }
  if (
    (property.assignmentDocFileNames ?? []).some(filled) ||
    (property.delegationLetterFileNames ?? []).some(filled) ||
    (property.otherDocumentFileNames ?? []).some(filled)
  ) {
    return true;
  }
  return (property.contacts ?? []).some(
    (c) => filled(c.name) || filled(c.phone) || filled(c.nationalId),
  );
}

function bindPagehideFlush(): void {
  if (pagehideBound || typeof window === "undefined") return;
  pagehideBound = true;
  window.addEventListener("pagehide", () => {
    void flushAllPropertyFieldAutosaves();
  });
}

function clearTimer(key: string): void {
  const timer = timers.get(key);
  if (timer) clearTimeout(timer);
  timers.delete(key);
}

function dropKey(key: string, options?: { keepPersistedStamp?: boolean }): void {
  clearTimer(key);
  drafts.delete(key);
  persistable.delete(key);
  basedOnUpdatedAt.delete(key);
  queuedAtMs.delete(key);
  if (!options?.keepPersistedStamp) lastPersistedUpdatedAt.delete(key);
}

function parseUtcMs(value: string | null | undefined): number | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : null;
}

/** True when the fetched row was written after this draft was taken. */
function shouldYieldToServer(
  key: string,
  serverUpdatedAtUtc?: string | null,
): boolean {
  const serverMs = parseUtcMs(serverUpdatedAtUtc);
  if (serverMs == null) return false;
  const basedMs = parseUtcMs(basedOnUpdatedAt.get(key));
  if (basedMs != null) return serverMs > basedMs;
  const queued = queuedAtMs.get(key);
  return typeof queued === "number" && serverMs > queued;
}

async function persistKey(key: string): Promise<boolean> {
  const draft = drafts.get(key);
  if (!draft) return true;
  if (!isMeaningfulPropertyDraft(draft)) {
    dropKey(key);
    return true;
  }
  // No real server id yet (property not created — first حفظ still pending):
  // keep the draft for same-tab recovery, but there is nothing to PUT to yet.
  if (persistable.get(key) === false) return true;
  const [poNumber, propertyId] = key.split("|");
  if (!poNumber || !propertyId) return false;

  try {
    const result = await updatePropertyInPo(poNumber, propertyId, draft, {
      draft: true,
      silent: true,
    });
    if (!result.ok) {
      // Soft autosave failures stay quiet — explicit حفظ still validates loudly.
      return false;
    }
    const savedAt = result.data?.updatedAtUtc?.trim() ?? "";
    if (savedAt) lastPersistedUpdatedAt.set(key, savedAt);
    notifyWorkOrderPropertyChanged(poNumber);
    if (drafts.get(key) === draft) {
      dropKey(key, { keepPersistedStamp: true });
    } else if (savedAt) {
      const current = drafts.get(key);
      if (current) drafts.set(key, { ...current, updatedAtUtc: savedAt });
      basedOnUpdatedAt.set(key, savedAt);
    }
    return true;
  } catch {
    return false;
  }
}

/** Latest unsaved draft for this صك. Yields to a newer server copy on reopen. */
export function peekPropertyFieldAutosave(
  poNumber: string,
  propertyId: string | null | undefined,
  serverUpdatedAtUtc?: string | null,
): PoPropertyIntake | null {
  const id = (propertyId ?? "").trim();
  const po = poNumber.trim();
  if (!po || !id) return null;
  const key = propertyFieldAutosaveKey(po, id);
  const draft = drafts.get(key);
  if (!isMeaningfulPropertyDraft(draft)) return null;
  if (shouldYieldToServer(key, serverUpdatedAtUtc)) {
    dropKey(key);
    return null;
  }
  return draft;
}

/** Queue a soft save for this صك only. No-op without a real property id. */
export function queuePropertyFieldAutosave(
  poNumber: string,
  propertyId: string | null | undefined,
  property: PoPropertyIntake,
  options?: {
    /** False before the property has a real server id — draft only, no PUT. */
    persistable?: boolean;
  },
): void {
  const id = (propertyId ?? property.id ?? "").trim();
  const po = poNumber.trim();
  if (!po || !id || property.isRemoved) return;
  if (!isMeaningfulPropertyDraft(property)) return;

  bindPagehideFlush();
  const key = propertyFieldAutosaveKey(po, id);
  if (!basedOnUpdatedAt.has(key)) {
    basedOnUpdatedAt.set(
      key,
      lastPersistedUpdatedAt.get(key) || property.updatedAtUtc?.trim() || "",
    );
  }
  queuedAtMs.set(key, Date.now());
  drafts.set(key, { ...property, id });
  persistable.set(key, options?.persistable ?? true);
  clearTimer(key);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      const run = persistKey(key).finally(() => {
        if (inFlight.get(key) === run) inFlight.delete(key);
      });
      inFlight.set(key, run);
    }, SAVE_DEBOUNCE_MS),
  );
}

/** Flush pending keystrokes before explicit حفظ / صك switch / panel close. */
export async function flushPropertyFieldAutosave(
  poNumber: string,
  propertyId: string | null | undefined,
): Promise<void> {
  const id = (propertyId ?? "").trim();
  const po = poNumber.trim();
  if (!po || !id) return;
  const key = propertyFieldAutosaveKey(po, id);
  clearTimer(key);
  const pending = inFlight.get(key);
  if (pending) await pending;
  if (!drafts.has(key)) return;
  await persistKey(key);
}

export async function flushAllPropertyFieldAutosaves(): Promise<void> {
  const keys = [...new Set([...drafts.keys(), ...timers.keys(), ...inFlight.keys()])];
  await Promise.all(
    keys.map(async (key) => {
      const [poNumber, propertyId] = key.split("|");
      await flushPropertyFieldAutosave(poNumber, propertyId);
    }),
  );
}

/** Drop a pending timer without writing (e.g. discarded panel, successful explicit save). */
export function cancelPropertyFieldAutosave(
  poNumber: string,
  propertyId: string | null | undefined,
): void {
  const id = (propertyId ?? "").trim();
  const po = poNumber.trim();
  if (!po || !id) return;
  dropKey(propertyFieldAutosaveKey(po, id));
}
