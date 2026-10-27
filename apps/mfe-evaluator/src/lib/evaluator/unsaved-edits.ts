// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • P19  New file — registry of manual-save sections with unsaved drafts (setSectionUnsaved /
//         hasUnsavedSections) and the test for a focused text field changed since focus (editableText,
//         focusedFieldChanged).
// Round 2 (1b19bedc)
//  • R2-2 New clearUnsavedSections, called only when the window unmounts — a screen hidden by <Activity> runs
//         the same cleanups, so sections never clear themselves on unmount.
// ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Problem 19 — what a refresh would lose. Two kinds of unsaved text:
 * 1. a field still being typed in (an adjustment cell, a cost line) whose value changed since it was
 *    focused — it saves on blur, and a refresh never blurs it;
 * 2. a section with a manual «حفظ» whose drafts differ from what the server holds (it registers here).
 * Pure registry + predicates; the window's beforeunload guard asks them.
 */

const dirtySections = new Map<string, boolean>();

/** A manual-save section reports whether its drafts differ from the saved state. */
export function setSectionUnsaved(key: string, unsaved: boolean): void {
  if (unsaved) dirtySections.set(key, true);
  else dirtySections.delete(key);
}

export function hasUnsavedSections(): boolean {
  return dirtySections.size > 0;
}

/**
 * The window is gone (unmounted): nothing it held can be saved or lost any more. Sections never
 * clear themselves on unmount — a screen hidden by <Activity> runs the same cleanups.
 */
export function clearUnsavedSections(): void {
  dirtySections.clear();
}

/** Test seam. */
export function resetUnsavedSectionsForTests(): void {
  clearUnsavedSections();
}

type EditableLike = {
  tagName?: string;
  type?: string;
  value?: unknown;
  isContentEditable?: boolean;
  textContent?: string | null;
  readOnly?: boolean;
  disabled?: boolean;
};

const NON_TEXT_INPUTS = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "file",
  "image",
  "range",
  "color",
  "hidden",
]);

/** The text an editable element holds, or null when it is not a text field. */
export function editableText(el: EditableLike | null | undefined): string | null {
  if (!el || el.readOnly || el.disabled) return null;
  const tag = (el.tagName ?? "").toUpperCase();
  if (tag === "TEXTAREA") return String(el.value ?? "");
  if (tag === "INPUT") {
    return NON_TEXT_INPUTS.has((el.type ?? "text").toLowerCase()) ? null : String(el.value ?? "");
  }
  if (el.isContentEditable) return el.textContent ?? "";
  return null;
}

/** The focused field was typed in since it got focus (its value at focus is `valueAtFocus`). */
export function focusedFieldChanged(
  el: EditableLike | null | undefined,
  valueAtFocus: string | null,
): boolean {
  const now = editableText(el);
  return now !== null && valueAtFocus !== null && now !== valueAtFocus;
}
