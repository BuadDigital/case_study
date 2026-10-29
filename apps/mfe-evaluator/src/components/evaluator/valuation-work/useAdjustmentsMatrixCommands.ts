// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • B    Manual-weight rationale, row rationale and per-comparable rationale of a non-zero adjustment
//         must be at least 10 characters (rationaleMinimumError); the error goes to the field
//         (reportFieldError) instead of a toast. The old isJustificationTooShort check is removed.
//  • B    The weight row's rationale is named «مبرر الوزن اليدوي» in its message.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

/**
 * Adjustments-matrix writes for both tables (market and land-within-cost):
 * cell entries, descriptions, weights, justifications, the ✓ toggle and the
 * factor rows themselves. The market-approach fields the matrix also edits
 * (basis, area factor, subject spec) come from `useMarketApproachCommands`;
 * everything is exposed as one stable dispatcher per context.
 */
import { useCallback } from "react";
import { useLatestRef } from "@platform/app-shared/hooks/use-latest-ref";
import {
  saveAdjustmentFactorRationale,
  type ValuationComparableSelectionDto,
} from "@platform/api-client";
import { isCustomFactorKey } from "./lib/factor-registry";
import {
  AUTO_AREA_KEYS,
  SEQUENTIAL_KEYS,
  STANDARD_FACTORS,
} from "./lib/market-save-mappers";
import { runMatrixAction, type MatrixDispatch } from "./lib/matrix-actions";
import { rationaleMinimumError } from "./lib/rationale-minimum";
import { LAND_WITHIN_COST, MARKET_CONTEXT, parseDecimal } from "./lib/shell-state";
import {
  RESET_WEIGHTS_PATCH,
  isFactorIncluded,
  itemsMissingFactor,
  linesWithCellPercent,
  linesWithDescription,
  linesWithFactorAppended,
  linesWithIncluded,
  linesWithLabel,
  linesWithRationaleOverride,
  linesWithoutFactor,
  manualWeightPatch,
  savedLines,
  withFactorIncluded,
} from "./lib/market-commands-state";
import type { ComparableMarketSaver } from "./useComparableMarketSaver";
import type { useMarketApproachCommands } from "./useMarketApproachCommands";
import type { ValuationWorkData } from "./useValuationWorkData";
import { useValuationWorkErrors } from "./ValuationWorkErrors";

type MarketApproachCommands = ReturnType<typeof useMarketApproachCommands>;

export function useAdjustmentsMatrixCommands(
  data: ValuationWorkData,
  saver: ComparableMarketSaver,
  approach: MarketApproachCommands,
) {
  const { showToast, setSelection, setLandSelection, setSaving, reload } = data;
  const { reportSaveFailure, reportFieldError } = useValuationWorkErrors();
  const {
    writeContext,
    contextOfItem,
    adoptedFor,
    factorRowsFor,
    saveOne,
    saveMany,
  } = saver;
  const unlocked = () => writeContext({ requireUnlocked: true });

  /**
   * Matrix cell %. The lines are built inside the write queue from the comparable's
   * freshest copy, so a description or another cell saved right before is kept.
   */
  async function saveMatrixCell(
    item: ValuationComparableSelectionDto,
    factorKey: string,
    raw: string,
  ): Promise<boolean> {
    const ctx = unlocked();
    if (!ctx) return false;
    const percent = parseDecimal(raw) || 0;
    // The server refuses it; saying so here beats a cell that shows 150٪ while the table ignores it.
    if (Math.abs(percent) > 100) {
      showToast("نسبة التسوية يجب أن تكون بين -100٪ و 100٪", "error");
      return false;
    }
    const factorRows = factorRowsFor(contextOfItem(item));
    return saveOne(
      ctx,
      item,
      (fresh) => linesWithCellPercent(fresh, factorKey, percent, factorRows),
      "تعذّر حفظ التسوية",
    );
  }

  /**
   * compSpec: comparable description for a given difference factor — one cell per comparable.
   * Built from the freshest copy: typing a % and then the description under it used to
   * send the old % with the description and erase the new one.
   */
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
      (fresh) => linesWithDescription(fresh, factorKey, text),
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
    // A written manual-weight rationale is at least 10 characters (server rule).
    const short = rationaleMinimumError("مبرر الوزن اليدوي", weightRationale);
    if (short) {
      reportFieldError("weightOverrideRationale", short);
      return false;
    }
    // Lines and stored rationale come from the freshest copy (see saveMatrixCell).
    return saveOne(
      ctx,
      item,
      savedLines,
      "تعذّر حفظ الوزن",
      (fresh) => manualWeightPatch(fresh, rawPct, weightRationale),
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
  ): Promise<boolean> {
    const ctx = unlocked();
    if (!ctx) return false;
    const text = rawText.trim();
    // The weight row's rationale is the manual-weight rationale — named as such (round 2).
    const short = rationaleMinimumError(
      factorKey === "weight" ? "مبرر الوزن اليدوي" : "مبرر عامل التسوية",
      text,
    );
    if (short) {
      reportFieldError("rationaleAr", short);
      return false;
    }
    // Weight uses the same factor-rationale table as other rows — saving only onto
    // manual-weight market rows used to no-op when الوزن was still «مقترح», so the
    // cell draft vanished on blur with nothing persisted.
    setSaving(true);
    const res = await saveAdjustmentFactorRationale(ctx.config, ctx.valuationRequestId, {
      selectionContext: context,
      factorKey,
      rationaleAr: text || null,
    });
    setSaving(false);
    if (!res.ok) {
      reportSaveFailure(res, "تعذّر حفظ مبرر التسوية");
      return false;
    }
    await reload({ silent: true, scope: "derived" });
    return true;
  }

  /**
   * per-comparable justification override — writes that comparable’s adjustment line only.
   * The lines are built from the freshest copy so a % saved just before is not reverted.
   *
   * How it works: the 10-character rule (non-zero adjustment only) is checked inside the
   * write queue against the freshest copy's %; a short text declines the save and marks
   * the field.
   *
   * Edge cases: blank text always saves (it clears the override).
   *
   * Fixed: the check read the % the screen showed, so right after typing a % (screen still
   * at 0) a short rationale got past it and the server rejected it with a toast instead.
   */
  async function saveLineRationaleOverride(
    selectionId: string,
    factorKey: string,
    rawText: string,
    context: string = MARKET_CONTEXT,
  ) {
    const ctx = unlocked();
    if (!ctx) return;
    const text = rawText.trim();
    const item = adoptedFor(context).find((i) => i.id === selectionId);
    if (!item) return;
    const factorRows = factorRowsFor(context);
    const declined: { message: string | null } = { message: null };
    const ok = await saveOne(
      ctx,
      item,
      (fresh) => {
        const percent =
          fresh.market?.adjustmentLines?.find((l) => l.factorKey === factorKey)?.percent ?? 0;
        declined.message =
          percent !== 0 ? rationaleMinimumError("مبرر التسوية للمقارن", text) : null;
        if (declined.message) return null;
        return linesWithRationaleOverride(fresh, factorKey, text, factorRows);
      },
      "تعذّر حفظ تخصيص المبرر",
    );
    if (declined.message) {
      reportFieldError("rationaleAr", declined.message);
      return;
    }
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

  async function renameDifferenceFactor(
    factorKey: string,
    labelAr: string,
    context: string = MARKET_CONTEXT,
  ) {
    const ctx = unlocked();
    if (!ctx) return;
    if (!isCustomFactorKey(factorKey)) return;
    const next = labelAr.trim();
    if (!next) {
      showToast("تسمية العامل المضاف مطلوبة", "error");
      return;
    }
    await saveMany(ctx, {
      items: adoptedFor(context),
      linesFor: (item) => linesWithLabel(item, factorKey, next),
      errorMessage: "تعذّر تسمية العامل",
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
    renameDifferenceFactor,
    removeDifferenceFactor,
    removeSequentialFactor,
    restoreSequentialFactor,
    saveCellDescription,
    saveSubjectSpec: approach.saveSubjectSpec,
  };
  const matrixOpsRef = useLatestRef(matrixOps);
  const dispatchMarketMatrix = useCallback<MatrixDispatch>(
    (action) => runMatrixAction(matrixOpsRef.current, MARKET_CONTEXT, action),
    [matrixOpsRef],
  );
  const dispatchLandMatrix = useCallback<MatrixDispatch>(
    (action) => runMatrixAction(matrixOpsRef.current, LAND_WITHIN_COST, action),
    [matrixOpsRef],
  );

  return { dispatchMarketMatrix, dispatchLandMatrix };
}
