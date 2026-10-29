"use client";

/**
 * Comparables-bank writes: adopting a comparable into the market or land
 * table (with the 5-comparable cap and an optimistic flag flip) and the
 * per-valuation price/area override. Handlers are exposed through stable
 * refs so the bank table memo survives shell re-renders.
 */
import { useCallback } from "react";
import { useLatestRef } from "@platform/app-shared/hooks/use-latest-ref";
import {
  setValuationComparableAdopted,
  type ValuationComparableSelectionDto,
} from "@platform/api-client";
import {
  bankOverridePatch,
  savedLines,
  withAdoptionFlag,
} from "./lib/market-commands-state";
import { LAND_WITHIN_COST, MARKET_CONTEXT } from "./lib/shell-state";
import { getCachedOrganizationSettings } from "@platform/app-shared/organization/organization-settings-cache";
import type { ComparableMarketSaver } from "./useComparableMarketSaver";
import type { ValuationWorkData } from "./useValuationWorkData";

export function useComparablesCommands(
  data: ValuationWorkData,
  saver: ComparableMarketSaver,
) {
  const {
    showToast,
    selection,
    setSelection,
    landSelection,
    setLandSelection,
    visibleAdoptedMarket,
    visibleAdoptedLand,
    reload,
  } = data;
  const { writeContext, saveOne } = saver;

  async function adopt(
    compId: string,
    isAdopted: boolean,
    context: string = MARKET_CONTEXT,
  ) {
    const ctx = writeContext();
    if (!ctx) return;
    // Per-table cap from organization settings (وقت التنفيذ ← الحد الأقصى للمقارنات المعتمدة).
    if (isAdopted) {
      const maxAdopted =
        getCachedOrganizationSettings()?.valuation.maxAdoptedComparables ?? 3;
      const adoptedNow =
        context === MARKET_CONTEXT
          ? visibleAdoptedMarket.length
          : visibleAdoptedLand.length;
      if (adoptedNow >= maxAdopted) {
        showToast(
          `الحد الأقصى ${maxAdopted} مقارنات معتمدة — ألغِ اعتماد مقارن أولاً`,
          "error",
        );
        return;
      }
    }
    // Optimistic flag flip when the comp is already linked to this valuation.
    const setter = context === MARKET_CONTEXT ? setSelection : setLandSelection;
    const current = context === MARKET_CONTEXT ? selection : landSelection;
    const alreadyLinked = current?.items.some(
      (i) => i.comparablePropertyId === compId,
    );
    if (alreadyLinked) {
      setter((prev) => (prev ? withAdoptionFlag(prev, compId, isAdopted) : prev));
    }
    const res = await setValuationComparableAdopted(
      ctx.config,
      ctx.valuationRequestId,
      compId,
      isAdopted,
      context,
    );
    if (!res.ok) {
      showToast(res.message ?? "تعذّر تحديث الاعتماد", "error");
      await reload({ silent: true, scope: "derived" });
      return;
    }
    await reload({
      silent: true,
      scope: alreadyLinked ? "derived" : "full",
    });
  }

  /** compEdit: save price/area override for this valuation only — does not touch the shared bank.
   * Returns true on success — the bank table clears its local draft then. Lines and the
   * other override come from the comparable's freshest copy, so a matrix edit saved just
   * before is not reverted. */
  async function saveBankOverride(
    item: ValuationComparableSelectionDto,
    field: "price" | "area",
    raw: string,
  ): Promise<boolean> {
    const ctx = writeContext();
    if (!ctx) return false;
    return saveOne(
      ctx,
      item,
      savedLines,
      "تعذّر حفظ تعديل المقارن",
      (fresh) => bankOverridePatch(fresh, field, raw),
    );
  }

  /* ─── Stable handlers for the comparables bank — so table memo holds across shell re-renders.
     Function declarations above are hoisted, so references here are valid. ─── */
  const adoptRef = useLatestRef(adopt);
  const saveBankOverrideRef = useLatestRef(saveBankOverride);
  const onAdoptMarket = useCallback(
    (comparableId: string, adopted: boolean) =>
      adoptRef.current(comparableId, adopted, MARKET_CONTEXT),
    [adoptRef],
  );
  const onAdoptLand = useCallback(
    (comparableId: string, adopted: boolean) =>
      adoptRef.current(comparableId, adopted, LAND_WITHIN_COST),
    [adoptRef],
  );
  const onSaveBankOverride = useCallback(
    (
      item: ValuationComparableSelectionDto,
      field: "price" | "area",
      raw: string,
    ) => saveBankOverrideRef.current(item, field, raw),
    [saveBankOverrideRef],
  );

  return { onAdoptMarket, onAdoptLand, onSaveBankOverride };
}
