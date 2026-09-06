"use client";

/**
 * Shared write plumbing for the valuation-work command hooks: the auth/request
 * guard every command starts with, the context helpers that pick the market or
 * land table, and the two save shapes (one comparable, or a fan-out across the
 * adopted set) with their saving flag, failure toast and silent reload.
 */
import {
  saveValuationComparableMarket,
  type SaveValuationComparableMarketRequest,
  type ValuationComparableSelectionDto,
} from "@platform/api-client";
import { marketSaveBody } from "./lib/market-save-mappers";
import { apiConfig } from "./lib/shell-utils";
import { LAND_WITHIN_COST } from "./lib/shell-state";
import {
  contextOfSelection,
  type FactorRow,
  type SavedLine,
} from "./lib/market-commands-state";
import type { ValuationWorkData } from "./useValuationWorkData";

export type WriteContext = {
  config: NonNullable<ReturnType<typeof apiConfig>>;
  valuationRequestId: string;
};

export type FanOutSave = {
  items: ValuationComparableSelectionDto[];
  linesFor: (item: ValuationComparableSelectionDto) => SavedLine[];
  extra?: Partial<SaveValuationComparableMarketRequest>;
  errorMessage: string;
  successMessage?: string;
  /** Most fan-outs raise the saving flag; the ✓ toggle runs optimistically without it. */
  trackSaving?: boolean;
};

export function useComparableMarketSaver(data: ValuationWorkData) {
  const {
    showToast,
    valuationRequestId,
    setSaving,
    adoptedLand,
    visibleAdoptedMarket,
    visibleAdoptedLand,
    visibleFactorRows,
    visibleLandFactorRows,
    adjustmentsLocked,
    reload,
  } = data;

  /** Null when there is no session or no open request — or when the table is locked and the write needs it open. */
  function writeContext(opts?: { requireUnlocked?: boolean }): WriteContext | null {
    const config = apiConfig();
    if (!config || !valuationRequestId) return null;
    if (opts?.requireUnlocked && adjustmentsLocked) return null;
    return { config, valuationRequestId };
  }

  function contextOfItem(item: ValuationComparableSelectionDto): string {
    return contextOfSelection(item, adoptedLand);
  }
  function adoptedFor(context: string): ValuationComparableSelectionDto[] {
    return context === LAND_WITHIN_COST ? visibleAdoptedLand : visibleAdoptedMarket;
  }
  function factorRowsFor(context: string): FactorRow[] {
    return context === LAND_WITHIN_COST ? visibleLandFactorRows : visibleFactorRows;
  }

  /** One comparable: saving flag, failure toast, silent reload on success. Returns success. */
  async function saveOne(
    ctx: WriteContext,
    item: ValuationComparableSelectionDto,
    lines: SavedLine[],
    errorMessage: string,
    extra?: Partial<SaveValuationComparableMarketRequest>,
  ): Promise<boolean> {
    setSaving(true);
    const res = await saveValuationComparableMarket(
      ctx.config,
      ctx.valuationRequestId,
      item.id,
      marketSaveBody(item, lines, extra),
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? errorMessage, "error");
      return false;
    }
    await reload({ silent: true, scope: "derived" });
    return true;
  }

  /** Every adopted comparable in parallel; the first failure is toasted, the reload always runs. */
  async function saveMany(
    ctx: WriteContext,
    {
      items,
      linesFor,
      extra,
      errorMessage,
      successMessage,
      trackSaving = true,
    }: FanOutSave,
  ): Promise<boolean> {
    if (trackSaving) setSaving(true);
    const results = await Promise.all(
      items.map((item) =>
        saveValuationComparableMarket(
          ctx.config,
          ctx.valuationRequestId,
          item.id,
          marketSaveBody(item, linesFor(item), extra),
        ),
      ),
    );
    if (trackSaving) setSaving(false);
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      showToast(failed.message ?? errorMessage, "error");
      await reload({ silent: true, scope: "derived" });
      return false;
    }
    if (successMessage) showToast(successMessage, "success");
    await reload({ silent: true, scope: "derived" });
    return true;
  }

  return {
    writeContext,
    contextOfItem,
    adoptedFor,
    factorRowsFor,
    saveOne,
    saveMany,
  };
}

export type ComparableMarketSaver = ReturnType<typeof useComparableMarketSaver>;
