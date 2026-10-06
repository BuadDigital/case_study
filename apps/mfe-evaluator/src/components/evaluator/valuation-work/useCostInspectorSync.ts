"use client";

/**
 * Keeps the cost screen honest while the specialist's components table and the inspector's data
 * keep moving under the appraiser's draft:
 * - an UNTOUCHED seed (every line from the inventory, no unit cost entered) is rebuilt silently;
 * - otherwise a drift (new rows / changed quantities / removed rows) is reported with two explicit
 *   actions that never overwrite an entered `unitCostSar`;
 * - when the inspector's age changed and differs from the entered actual age, a notice offers to
 *   apply it.
 * Everything stays in the local draft until the appraiser saves.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { getBuildingInventory, type ValuationCostLineDto } from "@platform/api-client";

import { fetchInspectorWorkspace } from "../../../lib/case-study-bridge";
import { inspectorAgeNeedsApply } from "../../../lib/evaluator/inspector-data-changes";
import {
  appendNewInventoryLines,
  applyInventoryAreaChanges,
  costInventoryDrift,
  inspectorAgeYearsForCostField,
  isUntouchedCostSeed,
  reseedUntouchedCostLines,
  type CostApproachFields,
  type CostSeedInventoryLine,
} from "./lib/cost-approach-state";
import { apiConfig } from "./lib/shell-utils";

/** Same event string as case-study `FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT`. */
const FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT = "field-inspection-submission-changed";
const REFETCH_MIN_GAP_MS = 20_000;

export function useCostInspectorSync({
  poNumber,
  propertyId,
  inspectionTaskId,
  hydrateKey,
  costDraft,
  setCostDraft,
  fields,
  setActualAge,
  inspectorChangedGroups,
  locked = false,
}: {
  poNumber?: string;
  propertyId: string;
  inspectionTaskId?: string | null;
  hydrateKey: number;
  costDraft: ValuationCostLineDto[];
  setCostDraft: Dispatch<SetStateAction<ValuationCostLineDto[]>>;
  fields: CostApproachFields;
  setActualAge: (age: string) => void;
  inspectorChangedGroups?: readonly string[] | null;
  /** The package is handed to the specialist — the numbers are closed, nothing is rebuilt under them. */
  locked?: boolean;
}) {
  const [inventory, setInventory] = useState<CostSeedInventoryLine[] | null>(null);
  const lastFetchRef = useRef(0);

  const loadInventory = useCallback(
    (force: boolean) => {
      const config = apiConfig();
      if (!config || !poNumber || !propertyId) return () => {};
      const now = Date.now();
      if (!force && now - lastFetchRef.current < REFETCH_MIN_GAP_MS) return () => {};
      lastFetchRef.current = now;
      let stop = false;
      void getBuildingInventory(config, poNumber, propertyId)
        .then((inv) => {
          if (stop || !inv.ok) return;
          setInventory(inv.data.lines);
        })
        .catch(() => {
          /* best-effort — no inventory means no drift report */
        });
      return () => {
        stop = true;
      };
    },
    [poNumber, propertyId],
  );

  // Fresh read on every full load, then whenever the appraiser comes back to the window.
  useEffect(() => loadInventory(true), [hydrateKey, loadInventory]);
  useEffect(() => {
    const refresh = () => {
      loadInventory(false);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, refresh);
    };
  }, [loadInventory]);

  // An empty draft is the seed-from-components path's job (it also announces itself).
  const drift = useMemo(
    () =>
      inventory && costDraft.length > 0
        ? costInventoryDrift(costDraft, inventory)
        : null,
    [inventory, costDraft],
  );

  // Untouched seed + inventory moved: rebuild silently (never with an empty inventory).
  useEffect(() => {
    if (locked) return;
    if (!inventory || inventory.length === 0 || !drift?.hasDrift) return;
    if (!isUntouchedCostSeed(costDraft)) return;
    setCostDraft(reseedUntouchedCostLines(costDraft, inventory));
  }, [locked, inventory, drift, costDraft, setCostDraft]);

  const visibleDrift =
    drift?.hasDrift && !isUntouchedCostSeed(costDraft) ? drift : null;

  const addNewInventoryLines = useCallback(() => {
    if (!drift) return;
    setCostDraft((prev) => appendNewInventoryLines(prev, drift.added));
  }, [drift, setCostDraft]);

  const updateInventoryAreas = useCallback(() => {
    if (!drift) return;
    setCostDraft((prev) => applyInventoryAreaChanges(prev, drift.changedArea));
  }, [drift, setCostDraft]);

  // The inspector's age, read (never written) only once the age group changed.
  const ageChanged = Boolean(inspectorChangedGroups?.includes("age"));
  const [inspectorAge, setInspectorAge] = useState("");
  useEffect(() => {
    const taskId = inspectionTaskId?.trim();
    if (!ageChanged || !taskId) {
      setInspectorAge("");
      return;
    }
    let cancelled = false;
    void fetchInspectorWorkspace(taskId)
      .then((workspace) => {
        if (cancelled) return;
        setInspectorAge(inspectorAgeYearsForCostField(workspace?.propertyAgeYears));
      })
      .catch(() => {
        if (!cancelled) setInspectorAge("");
      });
    return () => {
      cancelled = true;
    };
  }, [ageChanged, inspectionTaskId]);

  const ageNotice = inspectorAgeNeedsApply({
    changedGroups: inspectorChangedGroups,
    inspectorAgeYears: inspectorAge,
    enteredAgeYears: fields.actualAge,
  })
    ? { inspectorAge, enteredAge: fields.actualAge }
    : null;

  const applyInspectorAge = useCallback(() => {
    if (inspectorAge) setActualAge(inspectorAge);
  }, [inspectorAge, setActualAge]);

  return {
    drift: visibleDrift,
    addNewInventoryLines,
    updateInventoryAreas,
    ageNotice,
    applyInspectorAge,
  };
}
