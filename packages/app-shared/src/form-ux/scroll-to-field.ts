import { invalidPulseRingClass } from "./invalid-styles";

export type ScrollToFormFieldOptions = {
  /** When false, only scroll/pulse — do not focus an inner control. Default true. */
  focus?: boolean;
  /**
   * Extra attempts when the node is not in the DOM yet (wizard step / tab
   * switch). `scrollToFormField` uses 0; `scheduleScrollToFormField` defaults
   * to 12 (~600ms) so the user lands on the field after paint.
   */
  retries?: number;
  /** Delay between retries. Default 50ms. */
  retryMs?: number;
};

function findScrollContainer(target: HTMLElement): HTMLElement | null {
  let scrollContainer: HTMLElement | null = target.parentElement;
  while (scrollContainer) {
    const overflowY = window.getComputedStyle(scrollContainer).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return scrollContainer;
    scrollContainer = scrollContainer.parentElement;
  }
  return null;
}

/**
 * Smooth-scroll the first invalid control into view (page or nearest overflow container),
 * pulse a danger ring, then focus the control if possible.
 * @returns false when the target id is not in the document yet.
 */
export function scrollToFormField(
  targetId: string,
  options?: ScrollToFormFieldOptions,
): boolean {
  if (typeof document === "undefined") return false;
  const target = document.getElementById(targetId);
  if (!target) return false;

  const scrollContainer = findScrollContainer(target);

  if (scrollContainer) {
    const targetRect = target.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const centeredOffset = Math.max(
      0,
      (containerRect.height - targetRect.height) / 2,
    );
    const top =
      scrollContainer.scrollTop +
      targetRect.top -
      containerRect.top -
      centeredOffset;
    scrollContainer.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  } else {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const pulseTokens = invalidPulseRingClass.split(/\s+/).filter(Boolean);
  target.classList.add(...pulseTokens);
  window.setTimeout(() => {
    target.classList.remove(...pulseTokens);
  }, 2200);

  if (options?.focus !== false) {
    const focusable =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLButtonElement
        ? target
        : target.querySelector<
            | HTMLInputElement
            | HTMLTextAreaElement
            | HTMLSelectElement
            | HTMLButtonElement
          >("input,select,textarea,button");
    if (focusable) {
      window.setTimeout(() => focusable.focus({ preventScroll: true }), 280);
    }
  }

  return true;
}

const DEFAULT_SCHEDULE_RETRIES = 12;
const DEFAULT_RETRY_MS = 50;

/** Defer scroll until after React paints field errors / step or tab switches. */
export function scheduleScrollToFormField(
  targetId: string | null | undefined,
  delayMs = 60,
  options?: ScrollToFormFieldOptions,
): void {
  if (!targetId || typeof window === "undefined") return;
  let remaining = options?.retries ?? DEFAULT_SCHEDULE_RETRIES;
  const retryMs = options?.retryMs ?? DEFAULT_RETRY_MS;

  const attempt = () => {
    if (scrollToFormField(targetId, options)) return;
    if (remaining <= 0) return;
    remaining -= 1;
    window.setTimeout(attempt, retryMs);
  };

  window.setTimeout(attempt, delayMs);
}
