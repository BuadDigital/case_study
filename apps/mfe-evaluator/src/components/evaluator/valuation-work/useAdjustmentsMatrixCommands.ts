"use client";

/**
 * Adjustments-matrix writes for both tables (market and land-within-cost):
 * cell entries, descriptions, weights, justifications, the ✓ toggle and the
 * factor rows themselves. The market-approach fields the matrix also edits
 * (basis, area factor, subject spec) come from `useMarketApproachCommands`;
 * everything is exposed as one stable dispatcher per context.
 */
import { useCallback, useRef } from "react";
import {
  saveAdjustmentFactorRationale,
  type ValuationComparableSelectionDto,
} from "@platform/api-client";
import {
  AUTO_AREA_KEYS,
  SEQUENTIAL_KEYS,
  STANDARD_FACTORS,
} from "./lib/market-save-mappers";
import { runMatrixAction, type MatrixDispatch } from "./lib/matrix-actions";
import { LAND_WITHIN_COST, MARKET_CONTEXT, parseDecimal } from "./lib/shell-state";
import {
  JUSTIFICATION_TOO_SHORT_MESSAGE,
  RESET_WEIGHTS_PATCH,
  isFactorIncluded,
  isJustificationTooShort,
  itemsMissingFactor,
  linesWithCellPercent,
  linesWithDescription,
  linesWithFactorAppended,
  linesWithIncluded,
  linesWithRationaleOverride,
  linesWithoutFactor,
  manualWeightPatch,
  savedLines,
  withFactorIncluded,
} from "./lib/market-commands-state";
import type { ComparableMarketSaver } from "./useComparableMarketSaver";
import type { useMarketApproachCommands } from "./useMarketApproachCommands";
import type { ValuationWorkData } from "./useValuationWorkData";

type MarketApproachCommands = ReturnType<typeof useMarketApproachCommands>;

export function useAdjustmentsMatrixCommands(
  data: ValuationWorkData,
  saver: ComparableMarketSaver,
  approach: MarketApproachCommands,
) {
  const { showToast, setSelection, setLandSelection, setSaving, reload } = data;
  const {
    writeContext,
    contextOfItem,
    adoptedFor,
    factorRowsFor,
    saveOne,
    saveMany,
  } = saver;
  const unlocked = () => writeContext({ requireUnlocked: true });

  async function saveMatrixCell(
    item: ValuationComparableSelectionDto,
    factorKey: string,
    raw: string,
  ): Promise<boolean> {
    const ctx = unlocked();
    if (!ctx) return false;
    const percent = parseDecimal(raw) || 0;
    const lines = linesWithCellPercent(
      item,
      factorKey,
      percent,
      factorRowsFor(contextOfItem(item)),
    );
    return saveOne(ctx, item, lines, "تعذّر حفظ التسوية");
  }

  /** compSpec: comparable description for a given difference factor — one cell per comparable. */
  async function saveCellDescription(
    item: ValuationComparableSelectionDto,
    factorKey: string,
    text: string,
  ) {
    const ctx = unlocked();
    if (!ctx) return;
    await saveOne(
      ctx,
      item,
      linesWithDescription(item, factorKey, text),
      "تعذّر حفظ وصف المقارن",
    );
  }

  /** Remove a sequential adjustment (financing/type) from the table — restorable via the restore chip. */
  async function removeSequentialFactor(
    factorKey: string,
    context: string = MARKET_CONTEXT,
  ) {
    if (factorKey === "market") return;
    const ctx = unlocked();
    if (!ctx) return;
    await saveMany(ctx, {
      items: adoptedFor(context),
      linesFor: (item) => linesWithoutFactor(item, factorKey),
      errorMessage: "تعذّر حذف البند",
    });
  }

  /** Restore a deleted sequential adjustment to its default values. */
  async function restoreSequentialFactor(
    factorKey: string,
    context: string = MARKET_CONTEXT,
  ) {
    const ctx = unlocked();
    if (!ctx) return;
    const label =
      STANDARD_FACTORS.find((f) => f.factorKey === factorKey)?.labelAr ?? factorKey;
    await saveMany(ctx, {
      items: itemsMissingFactor(adoptedFor(context), factorKey),
      linesFor: (item) => linesWithFactorAppended(item, factorKey, label),
      errorMessage: "تعذّر استعادة البند",
    });
  }

  async function saveWeight(
    item: ValuationComparableSelectionDto,
    rawPct: string,
    weightRationale: string,
  ): Promise<boolean> {
    const ctx = unlocked();
    if (!ctx) return false;
    return saveOne(
      ctx,
      item,
      savedLines(item),
      "تعذّر حفظ الوزن",
      manualWeightPatch(item, rawPct, weightRationale),
    );
  }

  async function resetWeights(
    context: string = MARKET_CONTEXT,
  ): Promise<boolean> {
    const ctx = unlocked();
    if (!ctx) return false;
    return saveMany(ctx, {
      items: adoptedFor(context),
      linesFor: savedLines,
      extra: RESET_WEIGHTS_PATCH,
      errorMessage: "تعذّر إعادة ضبط الأوزان",
      successMessage: "أُعيد ضبط الأوزان للاقتراح الآلي",
    });
  }

  async function saveFactorRationale(
    factorKey: string,
    rawText: string,
    context: string = MARKET_CONTEXT,
  ) {
    const ctx = unlocked();
    if (!ctx) return;
    const text = rawText.trim();
    // Weight justification is stored on the weight field, not as an adjustment line.
    if (factorKey === "weight") {
      await saveMany(ctx, {
        items: adoptedFor(context).filter((item) => item.market?.weightIsManual),
        linesFor: savedLines,
        extra: { weightOverrideRationale: text || null },
        errorMessage: "تعذّر حفظ مبرر الوزن",
      });
      return;
    }
    // Rule Q-8-1: one factor-level justification — single request instead of per-comparable fan-out;
    // Line justifications stay as per-comparable overrides edited from the comparable cell.
    if (isJustificationTooShort(text)) {
      showToast(JUSTIFICATION_TOO_SHORT_MESSAGE, "error");
      return;
    }
    setSaving(true);
    const res = await saveAdjustmentFactorRationale(ctx.config, ctx.valuationRequestId, {
      selectionContext: context,
      factorKey,
      rationaleAr: text || null,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ مبرر التسوية", "error");
    }
    await reload({ silent: true, scope: "derived" });
  }

  /** Rule Q-8-1: per-comparable justification override — writes that comparable’s adjustment line only. */
  async function saveLineRationaleOverride(
    selectionId: string,
    factorKey: string,
    rawText: string,
    context: string = MARKET_CONTEXT,
  ) {
    const ctx = unlocked();
    if (!ctx) return;
    const text = rawText.trim();
    if (isJustificationTooShort(text)) {
      showToast(JUSTIFICATION_TOO_SHORT_MESSAGE, "error");
      return;
    }
    const item = adoptedFor(context).find((i) => i.id === selectionId);
    if (!item) return;
    const ok = await saveOne(
      ctx,
      item,
      linesWithRationaleOverride(item, factorKey, text, factorRowsFor(context)),
      "تعذّر حفظ تخصيص المبرر",
    );
    // The reload runs even after a failed save so the cell shows the stored text again.
    if (!ok) await reload({ silent: true, scope: "derived" });
  }

  async function toggleFactorIncluded(
    _item: ValuationComparableSelectionDto,
    factorKey: string,
  ) {
    const ctx = unlocked();
    if (!ctx) return;
    const context = contextOfItem(_item);
    const items = adoptedFor(context);
    const nextIncluded = !isFactorIncluded(items, factorKey);
    // Optimistic ✓ flag flip — save runs in parallel; silent reload reconciles.
    const setter = context === LAND_WITHIN_COST ? setLandSelection : setSelection;
    setter((prev) => (prev ? withFactorIncluded(prev, factorKey, nextIncluded) : prev));
    const factorRows = factorRowsFor(context);
    await saveMany(ctx, {
      items,
      linesFor: (item) =>
        linesWithIncluded(item, factorKey, nextIncluded, factorRows),
      errorMessage: "تعذّر تحديث البند",
      trackSaving: false,
    });
  }

  async function addDifferenceFactor(
    factorKey: string,
    labelAr: string,
    context: string = MARKET_CONTEXT,
  ) {
    const ctx = unlocked();
    if (!ctx) return;
    if (!adoptedFor(context).length) {
      showToast("اعتمد مقارناً أولاً", "error");
      return;
    }
    await saveMany(ctx, {
      items: itemsMissingFactor(adoptedFor(context), factorKey),
      linesFor: (item) => linesWithFactorAppended(item, factorKey, labelAr),
      errorMessage: "تعذّر إضافة العامل",
      successMessage: "أُضيف عامل الاختلاف",
    });
  }

  async function removeDifferenceFactor(
    factorKey: string,
    context: string = MARKET_CONTEXT,
  ) {
    const ctx = unlocked();
    if (!ctx) return;
    if (AUTO_AREA_KEYS.has(factorKey) || SEQUENTIAL_KEYS.has(factorKey)) return;
    await saveMany(ctx, {
      items: adoptedFor(context),
      linesFor: (item) => linesWithoutFactor(item, factorKey),
      errorMessage: "تعذّر حذف العامل",
      successMessage: "حُذف عامل الاختلاف",
    });
  }

  /* ─── Adjustments-matrix command dispatcher — one stable ref per context instead of 21 handlers,
     so table memo survives shell re-renders (Command/Strategy). ─── */
  const matrixOps = {
    saveMatrixCell,
    saveWeight,
    saveFactorRationale,
    saveLineRationaleOverride,
    toggleFactorIncluded,
    changeAdjustmentBasis: approach.changeAdjustmentBasis,
    resetWeights,
    saveAreaFactorPct: approach.saveAreaFactorPct,
    addDifferenceFactor,
    removeDifferenceFactor,
    removeSequentialFactor,
    restoreSequentialFactor,
    saveCellDescription,
    saveSubjectSpec: approach.saveSubjectSpec,
  };
  const matrixOpsRef = useRef(matrixOps);
  matrixOpsRef.current = matrixOps;
  const dispatchMarketMatrix = useCallback<MatrixDispatch>(
    (action) => runMatrixAction(matrixOpsRef.current, MARKET_CONTEXT, action),
    [],
  );
  const dispatchLandMatrix = useCallback<MatrixDispatch>(
    (action) => runMatrixAction(matrixOpsRef.current, LAND_WITHIN_COST, action),
    [],
  );

  return { dispatchMarketMatrix, dispatchLandMatrix };
}
