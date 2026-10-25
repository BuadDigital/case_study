"use client";

import { useEffect, type RefObject } from "react";
import { useLatestRef } from "@platform/app-shared/hooks/use-latest-ref";
import {
  editableText,
  focusedFieldChanged,
  hasUnsavedSections,
} from "../../lib/evaluator/unsaved-edits";

/**
 * Problem 19 — warns before a refresh / close would lose typed text inside the window: a field still
 * focused and changed (it saves on blur, which a refresh never fires), a pending autosave, or a
 * manual-save section with unsaved drafts. The focused field is blurred first, so its own save runs
 * if the appraiser chooses to stay.
 */
export function useUnsavedEditsGuard(
  rootRef: RefObject<HTMLElement | null>,
  hasPendingAutosave: () => boolean,
): void {
  const pendingRef = useLatestRef(hasPendingAutosave);
  useEffect(() => {
    let focused: { el: HTMLElement; value: string | null } | null = null;
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || !rootRef.current?.contains(el)) return;
      focused = { el, value: editableText(el) };
    };
    const onFocusOut = (e: FocusEvent) => {
      if (focused?.el === e.target) focused = null;
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const typing =
        focused !== null &&
        document.activeElement === focused.el &&
        focusedFieldChanged(focused.el, focused.value);
      if (!typing && !pendingRef.current() && !hasUnsavedSections()) return;
      if (typing) focused?.el.blur();
      e.preventDefault();
      // Older browsers show the prompt only when returnValue is set.
      e.returnValue = "";
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [rootRef, pendingRef]);
}
