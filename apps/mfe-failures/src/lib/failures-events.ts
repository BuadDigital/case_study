import { FAILURES_CHANGED_EVENT } from "@platform/app-shared/events/app-events";

/** Failures persist via `/api/failures`. */

export function notifyFailuresChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FAILURES_CHANGED_EVENT));
  }
}
