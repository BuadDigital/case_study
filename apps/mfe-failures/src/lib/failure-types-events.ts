import { FAILURE_TYPES_CHANGED_EVENT } from "@platform/app-shared/events/app-events";

export function notifyFailureTypesChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FAILURE_TYPES_CHANGED_EVENT));
}
