import {
  labelFromActionElement,
  progressMessageForActionLabel,
  shouldShowGlobalActionToast,
  successMessageForActionLabel,
} from "./action-progress-message";

type ActiveToast = {
  id: string;
  label: string;
  sawBusy: boolean;
  observer: MutationObserver;
  pollTimer: number;
};

const activeToasts = new WeakMap<HTMLElement, ActiveToast>();

function isActionTrigger(element: HTMLElement | null): element is HTMLElement {
  if (!element) return false;
  if (element instanceof HTMLButtonElement) return true;
  if (element instanceof HTMLInputElement) {
    return element.type === "submit" || element.type === "button";
  }
  return false;
}

function elementLooksBusy(element: HTMLElement): boolean {
  if (element.getAttribute("aria-busy") === "true") return true;
  if ("disabled" in element && (element as HTMLButtonElement).disabled) return true;
  return false;
}

function dismissFor(
  element: HTMLElement,
  dismissToast: (id: string) => void,
  showSuccessToast?: (message: string) => void,
  options?: { forceSuccess?: boolean },
) {
  const entry = activeToasts.get(element);
  if (!entry) return;

  dismissToast(entry.id);
  entry.observer.disconnect();
  window.clearInterval(entry.pollTimer);
  activeToasts.delete(element);

  if (
    showSuccessToast &&
    (entry.sawBusy || options?.forceSuccess)
  ) {
    showSuccessToast(successMessageForActionLabel(entry.label));
  }
}

function watchActionElement(
  element: HTMLElement,
  toastId: string,
  label: string,
  dismissToast: (id: string) => void,
  showSuccessToast?: (message: string) => void,
) {
  let sawBusy = elementLooksBusy(element);

  const observer = new MutationObserver(() => {
    const busy = elementLooksBusy(element);
    if (busy) sawBusy = true;
    if (sawBusy && !busy) {
      const entry = activeToasts.get(element);
      if (entry) entry.sawBusy = true;
      dismissFor(element, dismissToast, showSuccessToast);
    }
  });

  observer.observe(element, {
    attributes: true,
    attributeFilter: ["aria-busy", "disabled", "class"],
  });

  const pollTimer = window.setInterval(() => {
    if (!document.contains(element)) {
      dismissFor(element, dismissToast, showSuccessToast);
      return;
    }
    const busy = elementLooksBusy(element);
    if (busy) sawBusy = true;
    const entry = activeToasts.get(element);
    if (entry) entry.sawBusy = sawBusy;
    if (sawBusy && !busy) {
      dismissFor(element, dismissToast, showSuccessToast);
    }
  }, 200);

  activeToasts.set(element, {
    id: toastId,
    label,
    sawBusy,
    observer,
    pollTimer,
  });
}

const SYNC_ACTION_DISMISS_MS = 50;

function scheduleSyncActionDismiss(
  element: HTMLElement,
  dismissToast: (id: string) => void,
  showSuccessToast?: (message: string) => void,
) {
  window.setTimeout(() => {
    const entry = activeToasts.get(element);
    if (!entry || entry.sawBusy) return;
    dismissFor(element, dismissToast, showSuccessToast, {
      forceSuccess: true,
    });
  }, SYNC_ACTION_DISMISS_MS);
}

export function bindGlobalActionToast(
  showProgressToast: (message: string) => string,
  dismissToast: (id: string) => void,
  showSuccessToast?: (message: string) => void,
): () => void {
  function onPointerDown(event: Event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const element = target.closest(
      "button, input[type='submit'], input[type='button']",
    ) as HTMLElement | null;
    if (!isActionTrigger(element)) return;

    const label = labelFromActionElement(element);
    if (!shouldShowGlobalActionToast(element, label)) return;

    dismissFor(element, dismissToast, showSuccessToast);
    const toastId = showProgressToast(progressMessageForActionLabel(label));
    watchActionElement(element, toastId, label, dismissToast, showSuccessToast);
    scheduleSyncActionDismiss(element, dismissToast, showSuccessToast);
  }

  document.addEventListener("pointerdown", onPointerDown, true);
  return () => document.removeEventListener("pointerdown", onPointerDown, true);
}
