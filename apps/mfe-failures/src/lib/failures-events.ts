/** Failures persist via `/api/failures`. */

export const FAILURES_CHANGED_EVENT = "failures-changed";

export function notifyFailuresChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FAILURES_CHANGED_EVENT));
  }
}
