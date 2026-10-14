/**
 * Lets the inspector's «جدول الحصر» card hand the workflow a way to flush its pending save
 * before the inspection is submitted, without the workflow importing the card.
 */
type Flusher = () => Promise<void>;

const flushers = new Set<Flusher>();

/** A card registers its flusher while mounted; returns the unregister function. */
export function registerInspectorInventoryFlusher(flush: Flusher): () => void {
  flushers.add(flush);
  return () => {
    flushers.delete(flush);
  };
}

/** Awaits every registered flusher (a no-op when no inventory card is mounted). */
export async function flushInspectorInventorySave(): Promise<void> {
  await Promise.all([...flushers].map((flush) => flush()));
}
