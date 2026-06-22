import {
  labelFromActionElement,
  progressMessageForActionLabel,
  shouldShowGlobalActionToast,
} from "./action-progress-message";

type ActiveToast = {
  id: string;
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

function dismissFor(element: HTMLElement, dismissToast: (id: string) => void) {
  const entry = activeToasts.get(element);
  if (!entry) return;
  dismissToast(entry.id);
  entry.observer.disconnect();
  window.clearInterval(entry.pollTimer);
  activeToasts.delete(element);
}

function watchActionElement(
  element: HTMLElement,
  toastId: string,
  dismissToast: (id: string) => void,
) {
  let sawBusy = elementLooksBusy(element);

  const observer = new MutationObserver(() => {
    const busy = elementLooksBusy(element);
    if (busy) sawBusy = true;
    if (sawBusy && !busy) {
      dismissFor(element, dismissToast);
    }
  });

  observer.observe(element, {
    attributes: true,
    attributeFilter: ["aria-busy", "disabled", "class"],
  });

  const pollTimer = window.setInterval(() => {
    if (!document.contains(element)) {
      dismissFor(element, dismissToast);
      return;
    }
    const busy = elementLooksBusy(element);
    if (busy) sawBusy = true;
    if (sawBusy && !busy) {
      dismissFor(element, dismissToast);
    }
  }, 200);

  activeToasts.set(element, { id: toastId, observer, pollTimer });
}

export function bindGlobalActionToast(
  showProgressToast: (message: string) => string,
  dismissToast: (id: string) => void,
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

    dismissFor(element, dismissToast);
    const toastId = showProgressToast(progressMessageForActionLabel(label));
    watchActionElement(element, toastId, dismissToast);
  }

  document.addEventListener("pointerdown", onPointerDown, true);
  return () => document.removeEventListener("pointerdown", onPointerDown, true);
}
