// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Autosave  New file — pure parts of the cost-screen autosave: the 1200 ms pause, the save states and
//              their status text, the one-line refusal reason (costAutosaveFailureMessage) and
//              costHasUnsavedEdits. The cost screen had no autosave.
// ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Cost-screen autosave (like the market screen's cells): edits are saved after a short pause,
 * and the screen says where the save stands. Pure — the hook is `useCostAutosave`.
 */
import {
  normalizeValuationWorkErrors,
  valuationWorkErrorMessage,
} from "./valuation-work-error-targets";

/** Pause after the last edit before the cost save goes out. */
export const COST_AUTOSAVE_MS = 1200;

export type CostSaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export type CostSaveState = { status: CostSaveStatus; message?: string };

export const COST_SAVE_IDLE: CostSaveState = { status: "idle" };

/** The status line under the cost screen; null when there is nothing to say. */
export function costSaveStatusText(state: CostSaveState): string | null {
  switch (state.status) {
    case "pending":
      return "يُحفظ تلقائياً…";
    case "saving":
      return "جاري الحفظ…";
    case "saved":
      return "تم الحفظ تلقائياً";
    case "error":
      return state.message
        ? `لم يُحفظ تلقائياً: ${state.message}`
        : "لم يُحفظ تلقائياً — أكمل البيانات أو اضغط «حفظ أسلوب التكلفة»";
    default:
      return null;
  }
}

/** The one-line reason an automatic save was refused (no toast — the status line carries it). */
export function costAutosaveFailureMessage(failure: {
  kind?: string;
  message?: string;
  errors?: Record<string, string | string[]> | null;
}): string {
  const fieldMessage = valuationWorkErrorMessage(normalizeValuationWorkErrors(failure.errors));
  if (fieldMessage) return fieldMessage;
  if (failure.message?.trim()) return failure.message.trim();
  if (failure.kind === "auth") return "انتهت الجلسة — سجّل الدخول مجدداً";
  if (failure.kind === "network") return "تعذّر الاتصال بالخادم";
  return "تعذّر حفظ التكلفة";
}

/** Edits newer than the last save (or the last send that is still in flight). */
export function costHasUnsavedEdits(editVersion: number, savedVersion: number): boolean {
  return editVersion > savedVersion;
}
