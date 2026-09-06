"use client";

/**
 * Every write `ValuationWorkShell` performs, composed by concern: the
 * market-approach header (`useMarketApproachCommands`), the comparables bank
 * (`useComparablesCommands`) and the adjustments matrix
 * (`useAdjustmentsMatrixCommands`) — all sharing one write pipeline
 * (`useComparableMarketSaver`). It reads and mutates the state owned by
 * `useValuationWorkData` and returns the stable handlers plus the two matrix
 * dispatchers the tables consume.
 */
import { useAdjustmentsMatrixCommands } from "./useAdjustmentsMatrixCommands";
import { useComparableMarketSaver } from "./useComparableMarketSaver";
import { useComparablesCommands } from "./useComparablesCommands";
import { useMarketApproachCommands } from "./useMarketApproachCommands";
import type { ValuationWorkData } from "./useValuationWorkData";

export function useValuationWorkCommands(data: ValuationWorkData) {
  const saver = useComparableMarketSaver(data);
  const approach = useMarketApproachCommands(data, saver);
  const bank = useComparablesCommands(data, saver);
  const matrix = useAdjustmentsMatrixCommands(data, saver, approach);

  return {
    saveSubjectArea: approach.saveSubjectArea,
    clearAnalysisNotes: approach.clearAnalysisNotes,
    onAdoptMarket: bank.onAdoptMarket,
    onAdoptLand: bank.onAdoptLand,
    onSaveBankOverride: bank.onSaveBankOverride,
    dispatchMarketMatrix: matrix.dispatchMarketMatrix,
    dispatchLandMatrix: matrix.dispatchLandMatrix,
  };
}
