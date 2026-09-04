"use client";

import { useMemo, useState } from "react";
import type {
  ValuationComparableAdjustmentLineDto,
  ValuationComparableSelectionDto,
  ValuationComparableSelectionListDto,
} from "@platform/api-client";

import { AUTO_AREA_KEY } from "./lib/factor-registry";
import type { MatrixDispatch } from "./lib/matrix-actions";
import {
  addableFactorOptions,
  buildMatrixAlerts,
  factorKeysFromLines,
  matrixBasisView,
  matrixFactorRows,
} from "./lib/adjustments-matrix-state";
import { pct } from "./AdjustmentsMatrixCells";

export type AdjustmentsMatrixModelArgs = {
  selection: ValuationComparableSelectionListDto;
  adopted: ValuationComparableSelectionDto[];
  subjectArea: string;
  catalogFactors?: { factorKey: string; labelAr: string }[];
  dispatch: MatrixDispatch;
};

/**
 * Row model behind the adjustments matrix: the per-(comparable, factor) line
 * index, the justification lookups and the derived row/alert lists. Cell drafts
 * stay in the cells; this hook holds only what the table shape needs.
 */
export function useAdjustmentsMatrixModel({
  selection,
  adopted,
  subjectArea,
  catalogFactors,
  dispatch,
}: AdjustmentsMatrixModelArgs) {
  /** Two-step delete — “Delete? ✓ ×” (one confirm slot at a time, as in the form). */
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const saveRationale = (factorKey: string, text: string) =>
    dispatch({ type: "save-rationale", factorKey, text });
  const saveLineRationale = (
    selectionId: string,
    factorKey: string,
    text: string,
  ) => void dispatch({ type: "save-line-rationale", selectionId, factorKey, text });

  // js-index-maps: line index per (comparable, factor) instead of find() in every cell each render.
  const linesByItem = useMemo(() => {
    const map = new Map<string, Map<string, ValuationComparableAdjustmentLineDto>>();
    for (const item of adopted) {
      const inner = new Map<string, ValuationComparableAdjustmentLineDto>();
      for (const line of item.market?.adjustmentLines ?? []) {
        if (!inner.has(line.factorKey)) inner.set(line.factorKey, line);
      }
      map.set(item.id, inner);
    }
    return map;
  }, [adopted]);
  const lineOf = (item: ValuationComparableSelectionDto, factorKey: string) =>
    linesByItem.get(item.id)?.get(factorKey);
  const linePct = (item: ValuationComparableSelectionDto, factorKey: string) => {
    const line = lineOf(item, factorKey);
    if (line) return line.percent;
    if (factorKey === AUTO_AREA_KEY)
      return item.market?.suggestedAreaAdjustmentPct ?? 0;
    return 0;
  };

  // Cache of per-factor override lines — cleared when adopted set / lines change.
  const overridesCacheRef = useMemo(
    () => new Map<string, { id: string; label: string; value: string }[]>(),
    [adopted, linesByItem],
  );

  const factorKeysFromData = useMemo(
    () => factorKeysFromLines(adopted),
    [adopted],
  );
  const { sequentialKeys, removedSequential, differenceKeys } =
    matrixFactorRows(factorKeysFromData);

  // Rule Q-8-1: factor justification from its own table; legacy line justification is back-compat only.
  const factorRationaleByKey = new Map(
    (selection.factorRationales ?? []).map((r) => [r.factorKey, r.rationaleAr]),
  );
  const justValue = (factorKey: string) =>
    factorRationaleByKey.get(factorKey) ??
    lineOf(adopted[0]!, factorKey)?.rationale ??
    "";

  /** Rule Q-8-1: per-comparable override lines — shown under the factor justification on demand.
      Cached per factor — used to allocate a new object array for every JustCell each render (js-cache-function-results). */
  const overridesFor = (factorKey: string) => {
    let cached = overridesCacheRef.get(factorKey);
    if (!cached) {
      cached = adopted.map((item, i) => ({
        id: item.id,
        label: `مقارن ${i + 1}`,
        value: lineOf(item, factorKey)?.rationale ?? "",
      }));
      overridesCacheRef.set(factorKey, cached);
    }
    return cached;
  };

  return {
    confirmDelete,
    setConfirmDelete,
    saveRationale,
    saveLineRationale,
    lineOf,
    linePct,
    justValue,
    overridesFor,
    basisView: matrixBasisView(selection, adopted, subjectArea),
    sequentialKeys,
    removedSequential,
    differenceKeys,
    alerts: buildMatrixAlerts(adopted, pct),
    addableFactors: addableFactorOptions(catalogFactors, differenceKeys),
  };
}
