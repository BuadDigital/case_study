// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • P19  New file — remembers the active tab per task and restores a remembered approach tab («طريقة
//         المقارنة» / «طريقة المقاول» / income) once the shell reports it; the restore is dropped if the
//         appraiser picks a tab first.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import {
  readRememberedEvaluatorTab,
  rememberEvaluatorTab,
  tabWaitsForApproaches,
} from "../../lib/evaluator/evaluator-tab-memory";
import type { EvaluatorWindowTab } from "./evaluator-window-tabs";

/**
 * Problem 19 — the window remembers its tab per task (sessionStorage) so a refresh lands where the
 * appraiser was. Always-shown tabs open directly (`initialEvaluatorTab`); «طريقة المقارنة» /
 * «طريقة المقاول» exist only once the settings load, so their restore waits for the shell to report
 * them — and is dropped as soon as the appraiser picks a tab himself.
 */
export function useEvaluatorTabMemory({
  taskId,
  activeTab,
  setActiveTab,
  navAvail,
}: {
  taskId: string;
  activeTab: EvaluatorWindowTab;
  setActiveTab: (tab: EvaluatorWindowTab) => void;
  navAvail: { market: boolean; cost: boolean; income?: boolean };
}): void {
  const [restore, setRestore] = useState<{
    tab: "market" | "cost" | "income";
    from: EvaluatorWindowTab;
  } | null>(
    () => {
      const remembered = readRememberedEvaluatorTab(taskId);
      return remembered && tabWaitsForApproaches(remembered)
        ? { tab: remembered, from: activeTab }
        : null;
    },
  );
  if (restore) {
    if (activeTab !== restore.from) {
      setRestore(null); // the appraiser moved on before the approach tab appeared
    } else if (navAvail[restore.tab]) {
      setRestore(null);
      setActiveTab(restore.tab);
    }
  }

  useEffect(() => {
    if (!restore) rememberEvaluatorTab(taskId, activeTab);
  }, [activeTab, restore, taskId]);
}
