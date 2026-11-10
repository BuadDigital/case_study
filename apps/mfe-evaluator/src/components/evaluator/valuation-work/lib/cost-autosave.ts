// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Autosave  New file — pure parts of the cost-screen autosave: the 1200 ms pause, the save states and
//              their status text, the one-line refusal reason (costAutosaveFailureMessage) and
//              costHasUnsavedEdits. The cost screen had no autosave.
// Grey areas (2026-11-10)
//  • Two tabs  costLoadedStamp / newerCostSaveStamp — the stamp the save sends back as expectedUpdatedAtUtc.
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

/**
 * What: the concurrency stamp a loaded cost DTO gives the next save (`expectedUpdatedAtUtc`).
 * How it works: the DTO's `updatedAtUtc`; null (never saved) → "" so the server refuses the save once
 * another tab created the row first; no DTO, or a server without the field → undefined (no check).
 * Edge cases (2026-11-10): new — two tabs on the same cost screen overwrote each other silently.
 */
export function costLoadedStamp(
  cost: { updatedAtUtc?: string | null } | null | undefined,
): string | undefined {
  if (!cost || cost.updatedAtUtc === undefined) return undefined;
  return cost.updatedAtUtc ?? "";
}

/**
 * What: the later of two stamps — what the screen keeps when a full reload and its own save race.
 * How it works: a known stamp beats undefined; a saved stamp (ISO) beats "" (never saved); two ISO
 * stamps compare by time, then as text (same fixed-width round-trip format) when the milliseconds tie.
 * Edge cases: a reload that left before the screen's own save landed must not roll the stamp back —
 * the next autosave would then be refused as stale although nobody else saved.
 */
export function newerCostSaveStamp(
  a: string | undefined,
  b: string | undefined,
): string | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (!a) return b;
  if (!b) return a;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta > tb ? a : b;
  return a >= b ? a : b;
}
