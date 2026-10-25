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

type SaveMode = "auto" | "manual";

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
  const callbacksRef = useLatestRef({ onSavingChange, onSaved, onManualSaved, onManualFailure });
  const inFlight = useRef(false);
  const queued = useRef<SaveMode | null>(null);

  const run = useCallback(
    async (asked: SaveMode): Promise<void> => {
      const config = apiConfig();
      if (!config || !valuationRequestId) return;
      if (inFlight.current) {
        // One more save after the current one — a manual ask outranks an automatic one.
        queued.current = asked === "manual" || queued.current === "manual" ? "manual" : "auto";
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
          cb.onSaved(res.data, editVersionRef.current !== sent);
          setSaveState({ status: "saved" });
          if (mode === "manual") cb.onManualSaved();
        } else {
          setSaveState({ status: "error", message: costAutosaveFailureMessage(res), version: sent });
          if (mode === "manual") cb.onManualFailure(res);
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
  useEffect(() => {
    setSectionUnsaved("cost-approach", autosaveOn && dirty);
    return () => setSectionUnsaved("cost-approach", false);
  }, [autosaveOn, dirty]);

  // Leaving the screen for good sends what is still pending (fire and forget).
  const autosaveOnRef = useLatestRef(autosaveOn);
  useEffect(
    () => () => {
      if (
        autosaveOnRef.current &&
        costHasUnsavedEdits(editVersionRef.current, savedVersionRef.current)
      ) {
        void runRef.current("auto");
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
