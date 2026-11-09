export function dispatchWorkflowSubmitted(eventName: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(eventName));
}
