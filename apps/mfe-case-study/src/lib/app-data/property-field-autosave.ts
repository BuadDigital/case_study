/**
 * Debounced soft autosave for «البيانات الأولية» / «استعلام بورصة» fields.
 * Keyed by `poNumber|propertyId` so each صك keeps its own draft and timers
 * never write across properties.
 */
import type { PoPropertyIntake } from "./po-intake-data";
import { updatePropertyInPo } from "./po-intake-commands";

const SAVE_DEBOUNCE_MS = 400;

const drafts = new Map<string, PoPropertyIntake>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Map<string, Promise<void>>();

export function propertyFieldAutosaveKey(
  poNumber: string,
  propertyId: string,
): string {
  return `${poNumber.trim()}|${propertyId.trim()}`;
}

function clearTimer(key: string): void {
  const timer = timers.get(key);
  if (timer) clearTimeout(timer);
  timers.delete(key);
}

async function persistKey(key: string): Promise<void> {
  const draft = drafts.get(key);
  if (!draft) return;
  const [poNumber, propertyId] = key.split("|");
  if (!poNumber || !propertyId) return;

  const result = await updatePropertyInPo(poNumber, propertyId, draft, {
    draft: true,
    silent: true,
  });
  if (!result.ok) {
    // Soft autosave failures stay quiet — explicit حفظ still validates loudly.
    return;
  }
}

/** Queue a soft save for this صك only. No-op without a real property id. */
export function queuePropertyFieldAutosave(
  poNumber: string,
  propertyId: string | null | undefined,
  property: PoPropertyIntake,
): void {
  const id = (propertyId ?? property.id ?? "").trim();
  const po = poNumber.trim();
  if (!po || !id || property.isRemoved) return;

  const key = propertyFieldAutosaveKey(po, id);
  drafts.set(key, { ...property, id });
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

/** Flush pending keystrokes before explicit حفظ / صك switch. */
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
  drafts.delete(key);
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
}
