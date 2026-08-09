import { invalidPulseRingClass } from "./invalid-styles";

export type ScrollToFormFieldOptions = {
  /** When false, only scroll/pulse — do not focus an inner control. Default true. */
  focus?: boolean;
};

/**
 * Smooth-scroll the first invalid control into view (page or nearest overflow container),
 * pulse a danger ring, then focus the control if possible.
 */
export function scrollToFormField(
  targetId: string,
  options?: ScrollToFormFieldOptions,
): void {
  if (typeof document === "undefined") return;
  const target = document.getElementById(targetId);
  if (!target) return;

  let scrollContainer: HTMLElement | null = target.parentElement;
  while (scrollContainer) {
    const overflowY = window.getComputedStyle(scrollContainer).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") break;
    scrollContainer = scrollContainer.parentElement;
  }

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
}

/** Defer scroll until after React paints field errors / tab switches. */
export function scheduleScrollToFormField(
  targetId: string | null | undefined,
  delayMs = 60,
  options?: ScrollToFormFieldOptions,
): void {
  if (!targetId || typeof window === "undefined") return;
  window.setTimeout(() => scrollToFormField(targetId, options), delayMs);
}
