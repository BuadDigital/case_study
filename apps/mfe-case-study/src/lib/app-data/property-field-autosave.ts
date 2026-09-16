/**
 * Debounced soft autosave for «البيانات الأولية» / «استعلام بورصة» fields.
 * Keyed by `poNumber|propertyId` so each صك keeps its own draft and timers
 * never write across properties. Closing the panel flushes to the server and
 * invalidates that PO cache so reopen shows the last typed values.
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

async function persistKey(key: string): Promise<boolean> {
  const draft = drafts.get(key);
  if (!draft) return true;
  if (!isMeaningfulPropertyDraft(draft)) {
    drafts.delete(key);
    persistable.delete(key);
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
  } catch {
    return false;
  }
  notifyWorkOrderPropertyChanged(poNumber);
  return true;
}

/** Latest unsaved-or-saving draft for this صك, if the panel was closed mid-edit. */
export function peekPropertyFieldAutosave(
  poNumber: string,
  propertyId: string | null | undefined,
): PoPropertyIntake | null {
  const id = (propertyId ?? "").trim();
  const po = poNumber.trim();
  if (!po || !id) return null;
  const draft = drafts.get(propertyFieldAutosaveKey(po, id));
  return isMeaningfulPropertyDraft(draft) ? draft : null;
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
  // Keep the in-memory draft so close → reopen can hydrate immediately,
  // even while React Query still holds a stale PO record.
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

/** Drop a pending timer without writing (e.g. discarded panel). */
export function cancelPropertyFieldAutosave(
  poNumber: string,
  propertyId: string | null | undefined,
): void {
  const id = (propertyId ?? "").trim();
  const po = poNumber.trim();
  if (!po || !id) return;
  const key = propertyFieldAutosaveKey(po, id);
  clearTimer(key);
  drafts.delete(key);
  persistable.delete(key);
}
