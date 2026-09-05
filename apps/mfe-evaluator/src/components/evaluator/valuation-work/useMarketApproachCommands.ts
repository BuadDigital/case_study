"use client";

/**
 * Market-approach header writes: subject area and narrative, the subject
 * description column, the adjustment basis and the frozen area factor. Every
 * command saves the same market-approach body layered with its own field and
 * replaces the selection with the server answer.
 */
import {
  saveValuationMarketApproach,
  type SaveValuationMarketApproachRequest,
} from "@platform/api-client";
import {
  marketApproachBody,
  nextSubjectSpecs,
} from "./lib/market-commands-state";
import { parseDecimal } from "./lib/shell-state";
import type { ComparableMarketSaver } from "./useComparableMarketSaver";
import type { ValuationWorkData } from "./useValuationWorkData";

export function useMarketApproachCommands(
  data: ValuationWorkData,
  saver: ComparableMarketSaver,
) {
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
  } = data;
  const { writeContext } = saver;
  const draft = { subjectArea, adjustmentBasis, analysisNotes };

  /** Save with the saving flag, toast the failure, adopt the returned selection. */
  async function saveApproach(
    extra: Partial<SaveValuationMarketApproachRequest>,
    errorMessage: string,
    opts?: { requireUnlocked?: boolean },
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
      showToast(res.message ?? errorMessage, "error");
      return false;
    }
    setSelection(res.data);
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
      if (res.ok) setSelection(res.data);
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
    setAdjustmentBasis(basis);
    await saveApproach({ adjustmentBasis: basis }, "تعذّر حفظ أساس التسوية", {
      requireUnlocked: true,
    });
  }

  async function saveAreaFactorPct(raw: string) {
    if (!writeContext({ requireUnlocked: true })) return;
    const pct = parseDecimal(raw);
    if (!Number.isFinite(pct)) return;
    await saveApproach({ areaFactorPct: pct }, "تعذّر حفظ معامل المساحة", {
      requireUnlocked: true,
    });
  }

  return {
    saveSubjectArea,
    clearAnalysisNotes,
    saveSubjectSpec,
    changeAdjustmentBasis,
    saveAreaFactorPct,
  };
}
