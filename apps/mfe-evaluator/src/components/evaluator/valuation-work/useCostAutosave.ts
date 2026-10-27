// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Autosave  New file — the cost screen's writes: a debounced save after every appraiser edit plus the
//              explicit «حفظ أسلوب التكلفة»; saves never overlap (one queued), leaving the screen sends
//              pending edits, and pending edits raise the refresh warning (setSectionUnsaved).
// Round 2 (1b19bedc)
//  • The refresh-warning flag is no longer cleared by effect cleanup (an <Activity>-hidden screen
//          runs cleanups with edits still unsaved); it goes down on a real save or window unmount.
//  • New "leave" save mode: a refused save on leaving the screen calls onLeaveFailure (toast).
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  saveValuationCostApproach,
  type SaveValuationCostApproachRequest,
  type ValuationCostApproachDto,
} from "@platform/api-client";
import { useLatestRef } from "@platform/app-shared/hooks/use-latest-ref";

import {
  COST_AUTOSAVE_MS,
  COST_SAVE_IDLE,
  costAutosaveFailureMessage,
  costHasUnsavedEdits,
  type CostSaveState,
} from "./lib/cost-autosave";
import { apiConfig } from "./lib/shell-utils";
import { setSectionUnsaved } from "../../../lib/evaluator/unsaved-edits";

/** "leave": the save sent when the screen is left (hidden or unmounted) with edits pending. */
type SaveMode = "auto" | "manual" | "leave";

type CostSaveFailure = Extract<
  Awaited<ReturnType<typeof saveValuationCostApproach>>,
  { ok: false }
>;

/**
 * The cost screen's writes: a debounced save after every edit (like the market screen's cells)
 * and the explicit «حفظ أسلوب التكلفة». Saves never overlap — a save asked for while one is in
 * flight runs after it. Leaving the screen (or the window) with unsaved edits sends them; a refresh
 * with edits still pending warns first. Edits are counted by `editVersion` (user edits only —
 * hydration and the silent seeds never bump it, so they are not saved on their own).
 */
export function useCostAutosave({
  valuationRequestId,
  locked,
  editVersion,
  hydrateKey,
  buildRequest,
  onSavingChange,
  onSaved,
  onManualSaved,
  onManualFailure,
  onLeaveFailure,
}: {
  valuationRequestId: string | null;
  locked: boolean;
  editVersion: number;
  hydrateKey: number;
  buildRequest: () => SaveValuationCostApproachRequest;
  onSavingChange: (saving: boolean) => void;
  /** `editedSinceSend`: the drafts moved on while the save was in flight — keep them. */
  onSaved: (dto: ValuationCostApproachDto, editedSinceSend: boolean) => void;
  onManualSaved: () => void;
  onManualFailure: (failure: CostSaveFailure) => void;
  /** The save sent on leaving the screen was refused — nobody sees the status line any more. */
  onLeaveFailure?: (message: string) => void;
}) {
  const [savedVersion, setSavedVersion] = useState(0);
  const [saveState, setSaveState] = useState<CostSaveState & { version?: number }>(COST_SAVE_IDLE);

  // A full reload reseeds the drafts from the server: nothing typed is pending any more.
  const [hydratedKey, setHydratedKey] = useState(hydrateKey);
  if (hydratedKey !== hydrateKey) {
    setHydratedKey(hydrateKey);
    setSavedVersion(editVersion);
    setSaveState(COST_SAVE_IDLE);
  }

  const editVersionRef = useLatestRef(editVersion);
  const savedVersionRef = useLatestRef(savedVersion);
  const buildRequestRef = useLatestRef(buildRequest);
  const callbacksRef = useLatestRef({
    onSavingChange,
    onSaved,
    onManualSaved,
    onManualFailure,
    onLeaveFailure,
  });
  const inFlight = useRef(false);
  const queued = useRef<SaveMode | null>(null);

  const run = useCallback(
    async (asked: SaveMode): Promise<void> => {
      const config = apiConfig();
      if (!config || !valuationRequestId) return;
      if (inFlight.current) {
        // One more save after the current one — a manual ask outranks an automatic one.
        queued.current =
          asked === "manual" || queued.current === "manual"
            ? "manual"
            : asked === "leave" || queued.current === "leave"
              ? "leave"
              : "auto";
        return;
      }
      inFlight.current = true;
      let mode: SaveMode | null = asked;
      while (mode) {
        const sent = editVersionRef.current;
        const cb = callbacksRef.current;
        setSaveState({ status: "saving" });
        cb.onSavingChange(true);
        const res = await saveValuationCostApproach(config, valuationRequestId, buildRequestRef.current());
        cb.onSavingChange(false);
        if (res.ok) {
          setSavedVersion((v) => Math.max(v, sent));
          // Cleared here, not by the effect: a screen hidden by <Activity> runs no effects, and
          // its leave-save must still take the refresh warning down.
          if (editVersionRef.current === sent) setSectionUnsaved("cost-approach", false);
          cb.onSaved(res.data, editVersionRef.current !== sent);
          setSaveState({ status: "saved" });
          if (mode === "manual") cb.onManualSaved();
        } else {
          const message = costAutosaveFailureMessage(res);
          setSaveState({ status: "error", message, version: sent });
          if (mode === "manual") cb.onManualFailure(res);
          if (mode === "leave") cb.onLeaveFailure?.(message);
        }
        mode = queued.current;
        queued.current = null;
      }
      inFlight.current = false;
    },
    [buildRequestRef, callbacksRef, editVersionRef, valuationRequestId],
  );
  const runRef = useLatestRef(run);

  const autosaveOn = !locked && Boolean(valuationRequestId);
  const dirty = costHasUnsavedEdits(editVersion, savedVersion);

  // Debounced: every edit restarts the pause; a refused save waits for the next edit.
  useEffect(() => {
    if (!autosaveOn || !dirty) return;
    const timer = window.setTimeout(() => void runRef.current("auto"), COST_AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [autosaveOn, dirty, editVersion, runRef]);

  // Refresh / close with an edit still waiting for its save → the window's unsaved-edits prompt.
  // No cleanup: <Activity> hiding the screen runs effect cleanups too, and the edits are still
  // unsaved then. The flag goes down on a real save (above / here) or when the window unmounts.
  useEffect(() => {
    setSectionUnsaved("cost-approach", autosaveOn && dirty);
  }, [autosaveOn, dirty]);

  // Leaving the screen (hidden or unmounted) sends what is still pending; a refusal is toasted.
  const autosaveOnRef = useLatestRef(autosaveOn);
  useEffect(
    () => () => {
      if (
        autosaveOnRef.current &&
        costHasUnsavedEdits(editVersionRef.current, savedVersionRef.current)
      ) {
        void runRef.current("leave");
      }
    },
    [autosaveOnRef, editVersionRef, runRef, savedVersionRef],
  );

  const status: CostSaveState =
    saveState.status === "saving"
      ? saveState
      : dirty && !(saveState.status === "error" && saveState.version === editVersion)
        ? { status: "pending" }
        : saveState;

  const saveNow = useCallback(() => run("manual"), [run]);

  return { saveState: status, saveNow };
}
