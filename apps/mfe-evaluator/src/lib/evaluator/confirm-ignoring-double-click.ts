/**
 * «اعتماد التقرير» double-clicked: the first click opens the confirm, the second landed on the dialog's
 * backdrop and dismissed it — the appraiser saw nothing happen. While a confirm opened by a click is
 * fresh, the rest of that double-click is swallowed (capture phase, before React sees it), and a
 * second call while one is still open is ignored, so the dialog opens once and stays.
 */
import { confirmAction, type ActionConfirmRequest as ConfirmActionRequest } from "@platform/ui-kit";

/** How long after opening a click can still be the tail of the opening double-click. */
export const DOUBLE_CLICK_GRACE_MS = 500;
/** Faster than anyone reads a dialog: any click this soon after opening is a stray. */
const STRAY_CLICK_MS = 250;

let open = false;

export async function confirmIgnoringDoubleClick(
  request: ConfirmActionRequest,
  confirm: (request: ConfirmActionRequest) => Promise<boolean> = confirmAction,
): Promise<boolean | null> {
  if (open) return null; // already asking — the second click of a double-click
  open = true;
  const openedAt = Date.now();
  const swallow = (e: MouseEvent) => {
    const age = Date.now() - openedAt;
    if (age > DOUBLE_CLICK_GRACE_MS) return;
    if (age < STRAY_CLICK_MS || e.detail >= 2) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  const target = typeof window !== "undefined" ? window : null;
  target?.addEventListener("click", swallow, true);
  const timer = setTimeout(
    () => target?.removeEventListener("click", swallow, true),
    DOUBLE_CLICK_GRACE_MS,
  );
  try {
    return await confirm(request);
  } finally {
    clearTimeout(timer);
    target?.removeEventListener("click", swallow, true);
    open = false;
  }
}
