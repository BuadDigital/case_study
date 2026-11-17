"use client";

/**
 * Market-approach header writes: subject area and narrative, the subject
 * description column, the adjustment basis and the frozen area factor. Every
 * command saves the same market-approach body layered with its own field and
 * replaces the selection with the server answer.
 */
import { useQueryClient } from "@tanstack/react-query";
import {
  saveValuationMarketApproach,
  type AreaMethodChoice,
  type SaveValuationMarketApproachRequest,
} from "@platform/api-client";
import { areaCashRateSource } from "./lib/area-cash-rates";
import { scheduleInvalidateEvaluatorReportOutput } from "../../../lib/evaluator/evaluator-report-output-cache";
import {
  marketApproachBody,
  nextSubjectSpecs,
} from "./lib/market-commands-state";
import type { AreaLine } from "./lib/matrix-actions";
import { parseDecimal } from "./lib/shell-state";
import { perSqmBlockedMessage } from "./lib/market-subject";
import type { ComparableMarketSaver } from "./useComparableMarketSaver";
import type { ValuationWorkData } from "./useValuationWorkData";
import { useValuationWorkErrors } from "./ValuationWorkErrors";

export function useMarketApproachCommands(
  data: ValuationWorkData,
  saver: ComparableMarketSaver,
) {
  const queryClient = useQueryClient();
  const { reportSaveFailure } = useValuationWorkErrors();
  const {
    showToast,
    setSelection,
    setSaving,
    subjectArea,
    adjustmentBasis,
    setAdjustmentBasis,
    analysisNotes,
    setAnalysisNotes,
    subjectSpecs,
    marketKind,
    selection,
    cost,
    reload,
  } = data;
  const { writeContext } = saver;
  const draft = {
    subjectArea,
    adjustmentBasis,
    analysisNotes,
    storedAreaSqm: selection?.subjectAreaSqm ?? null,
  };

  /**
   * What: save the header with the saving flag, toast the failure, adopt the returned selection.
   * How it works: `refreshDerived` also reloads the land table, the cost approach and the final
   * opinion silently. The land table inside the cost approach reads its area factor and method
   * from this header too.
   * Edge cases: fixed 2026-11-17. Without that reload, a change made in the land table only
   * refreshed the market table, and the land table kept showing the old method until the page
   * reloaded.
   */
  async function saveApproach(
    extra: Partial<SaveValuationMarketApproachRequest>,
    errorMessage: string,
    opts?: { requireUnlocked?: boolean; refreshDerived?: boolean },
  ): Promise<boolean> {
    const ctx = writeContext(opts);
    if (!ctx) return false;
    setSaving(true);
    const res = await saveValuationMarketApproach(
      ctx.config,
      ctx.valuationRequestId,
      marketApproachBody(draft, extra),
    );
    setSaving(false);
    if (!res.ok) {
      reportSaveFailure(res, errorMessage);
      return false;
    }
    setSelection(res.data);
    scheduleInvalidateEvaluatorReportOutput(queryClient);
    if (opts?.refreshDerived) await reload({ silent: true, scope: "derived" });
    return true;
  }

  async function saveSubjectArea() {
    const ok = await saveApproach({}, "تعذّر حفظ مساحة العقار");
    if (ok) showToast("تم حفظ رأي أسلوب السوق", "success");
  }

  /** “Restore automatic text” — clears the manual narrative so the generated one shows again. */
  function clearAnalysisNotes() {
    setAnalysisNotes("");
    const ctx = writeContext();
    if (!ctx) return;
    void saveValuationMarketApproach(
      ctx.config,
      ctx.valuationRequestId,
      marketApproachBody(draft, { analysisNotes: null }),
    ).then((res) => {
      if (res.ok) {
        setSelection(res.data);
        scheduleInvalidateEvaluatorReportOutput(queryClient);
      }
    });
  }

  /** subjSpec: subject-property description for a difference factor — subject column. */
  async function saveSubjectSpec(factorKey: string, text: string) {
    await saveApproach(
      { subjectSpecs: nextSubjectSpecs(subjectSpecs, factorKey, text) },
      "تعذّر حفظ وصف العقار",
    );
  }

  async function changeAdjustmentBasis(basis: "price_per_sqm" | "whole_property") {
    if (!writeContext({ requireUnlocked: true })) return;
    // Per m² needs an area to multiply — a building without a floor area says why, not a server error.
    if (basis === "price_per_sqm" && !(parseDecimal(subjectArea) > 0)) {
      showToast(perSqmBlockedMessage(marketKind), "error");
      return;
    }
    setAdjustmentBasis(basis);
    await saveApproach({ adjustmentBasis: basis }, "تعذّر حفظ أساس التسوية", {
      requireUnlocked: true,
    });
  }

  /** The factor of one area row — the building's (and a land's single row) or a built subject's land row. */
  async function saveAreaFactorPct(raw: string, line: AreaLine = "area") {
    if (!writeContext({ requireUnlocked: true })) return;
    const pct = parseDecimal(raw);
    if (!Number.isFinite(pct)) return;
    await saveApproach(
      line === "land" ? { landAreaFactorPct: pct } : { areaFactorPct: pct },
      line === "land" ? "تعذّر حفظ معامل مساحة الأرض" : "تعذّر حفظ معامل المساحة",
      { requireUnlocked: true, refreshDerived: true },
    );
  }

  /**
   * What: an area row's method — المضاعف / الأمثال / مبلغ نقدي, or «auto» for the table's choice.
   * How it works: saved on the market header for that row (the land row on its own). Opening the cash
   * method on a row with no rate yet seeds the rate from its source (`areaCashRateSource`): the land
   * comparables' adjusted rate, or the cost approach's building value per m².
   * Edge cases: with no source the rate stays empty, the row gives 0 and asks for a rate.
   */
  async function saveAreaMethod(method: AreaMethodChoice, line: AreaLine = "area") {
    if (!writeContext({ requireUnlocked: true })) return;
    const extra: Partial<SaveValuationMarketApproachRequest> =
      line === "land" ? { landAreaAdjustmentMethod: method } : { areaAdjustmentMethod: method };
    if (method === "cash") {
      const stored = line === "land" ? selection?.landAreaCashRateSar : selection?.areaCashRateSar;
      const seed = areaCashRateSource(cost, line);
      if (!(Number(stored) > 0) && seed) {
        if (line === "land") extra.landAreaCashRateSar = seed.rate;
        else extra.areaCashRateSar = seed.rate;
      }
    }
    await saveApproach(extra, "تعذّر حفظ طريقة قياس المساحة", {
      requireUnlocked: true,
      refreshDerived: true,
    });
  }

  /** An area row's rate per m² on the cash method — blank or zero clears it. */
  async function saveAreaCashRate(raw: string, line: AreaLine = "area") {
    if (!writeContext({ requireUnlocked: true })) return;
    const parsed = raw.trim() === "" ? 0 : parseDecimal(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    await saveApproach(
      line === "land" ? { landAreaCashRateSar: parsed } : { areaCashRateSar: parsed },
      line === "land" ? "تعذّر حفظ سعر متر الأرض" : "تعذّر حفظ سعر متر المباني",
      { requireUnlocked: true },
    );
  }

  /**
   * The subject's land area for the land row of a built subject's table.
   * How it works: a positive figure is saved as the appraiser's; blank or zero sends 0, which
   * clears it on the server, so the row goes back to the deed's area.
   */
  async function saveSubjectLandArea(raw: string): Promise<boolean> {
    const parsed = parseDecimal(raw);
    return saveApproach(
      { subjectLandAreaSqm: Number.isFinite(parsed) && parsed > 0 ? parsed : 0 },
      "تعذّر حفظ مساحة أرض العقار",
      { requireUnlocked: true },
    );
  }

  return {
    saveSubjectArea,
    clearAnalysisNotes,
    saveSubjectSpec,
    changeAdjustmentBasis,
    saveAreaFactorPct,
    saveAreaMethod,
    saveAreaCashRate,
    saveSubjectLandArea,
  };
}
