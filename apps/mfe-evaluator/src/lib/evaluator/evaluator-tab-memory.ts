/**
 * Problem 19 — a refresh keeps the appraiser on the tab he was working in. The tab is remembered per
 * task in sessionStorage (per browser tab, gone when it closes); storage that throws or is empty
 * (private window, blocked site data) just falls back to the window's default tab.
 */
/** Same union as the window's `EvaluatorWindowTab` (kept here so lib does not import components). */
type EvaluatorWindowTab = "basic" | "market" | "cost" | "income" | "final" | "review" | "output";

const KNOWN_TABS: readonly EvaluatorWindowTab[] = [
  "basic",
  "market",
  "cost",
  "income",
  "final",
  "review",
  "output",
];

/** Approach tabs appear only after the valuation settings load — their restore waits for them. */
export function tabWaitsForApproaches(
  tab: EvaluatorWindowTab,
): tab is "market" | "cost" | "income" {
  return tab === "market" || tab === "cost" || tab === "income";
}

function storageKey(taskId: string): string {
  return `evaluator:tab:${taskId}`;
}

export function readRememberedEvaluatorTab(taskId: string): EvaluatorWindowTab | null {
  if (!taskId) return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(taskId));
    return raw && (KNOWN_TABS as readonly string[]).includes(raw)
      ? (raw as EvaluatorWindowTab)
      : null;
  } catch {
    return null;
  }
}

export function rememberEvaluatorTab(taskId: string, tab: EvaluatorWindowTab): void {
  if (!taskId) return;
  try {
    window.sessionStorage.setItem(storageKey(taskId), tab);
  } catch {
    /* storage unavailable — the tab is simply not remembered */
  }
}

/**
 * The tab the window opens on: the remembered one when it is always shown, else the default (an
 * approach tab is restored later, once the settings say it exists).
 */
export function initialEvaluatorTab(
  taskId: string,
  fallback: EvaluatorWindowTab,
): EvaluatorWindowTab {
  const remembered = readRememberedEvaluatorTab(taskId);
  return remembered && !tabWaitsForApproaches(remembered) ? remembered : fallback;
}
