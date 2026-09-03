"use client";

/**
 * Every write `ValuationWorkShell` performs: adoption, subject area and specs,
 * the adjustment-matrix cells, weights, justifications and difference factors.
 * It reads and mutates the state owned by `useValuationWorkData` and returns the
 * stable handlers plus the two matrix dispatchers the tables consume.
 */
import { useCallback, useRef } from "react";
import {
  saveValuationComparableMarket,
  saveAdjustmentFactorRationale,
  saveValuationMarketApproach,
  setValuationComparableAdopted,
  type ValuationComparableSelectionDto,
} from "@platform/api-client";
import {
  AUTO_AREA_KEYS,
  SEQUENTIAL_KEYS,
  STANDARD_FACTORS,
  ensureLinesForSave,
  lineForSave,
  linePercent,
  marketSaveBody,
} from "./lib/market-save-mappers";
import { runMatrixAction, type MatrixDispatch } from "./lib/matrix-actions";
import { apiConfig, JUSTIFICATION_MIN_LENGTH } from "./lib/shell-utils";
import {
  LAND_WITHIN_COST,
  MARKET_CONTEXT,
  MAX_ADOPTED_COMPARABLES,
  newAdjustmentLine,
  parseDecimal,
} from "./lib/shell-state";
import type { ValuationWorkData } from "./useValuationWorkData";

export function useValuationWorkCommands(data: ValuationWorkData) {
  const {
    showToast,
    valuationRequestId,
    selection,
    setSelection,
    landSelection,
    setLandSelection,
    setSaving,
    subjectArea,
    adjustmentBasis,
    setAdjustmentBasis,
    analysisNotes,
    setAnalysisNotes,
    subjectSpecs,
    adoptedLand,
    visibleAdoptedMarket,
    visibleAdoptedLand,
    visibleFactorRows,
    visibleLandFactorRows,
    adjustmentsLocked,
    reload,
  } = data;

  /** Context that owns the comparable selection — picks the correct factor list. */
  function contextOfItem(item: ValuationComparableSelectionDto): string {
    return adoptedLand.some((i) => i.id === item.id)
      ? LAND_WITHIN_COST
      : MARKET_CONTEXT;
  }
  function adoptedFor(context: string) {
    return context === LAND_WITHIN_COST ? visibleAdoptedLand : visibleAdoptedMarket;
  }
  function factorRowsFor(context: string) {
    return context === LAND_WITHIN_COST ? visibleLandFactorRows : visibleFactorRows;
  }

  async function adopt(
    compId: string,
    isAdopted: boolean,
    context: string = MARKET_CONTEXT,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    // Interactive-form spec: max 5 adopted comparables per table.
    if (isAdopted) {
      const adoptedNow =
        context === MARKET_CONTEXT
          ? visibleAdoptedMarket.length
          : visibleAdoptedLand.length;
      if (adoptedNow >= MAX_ADOPTED_COMPARABLES) {
        showToast("الحد الأقصى ٥ مقارنات معتمدة — ألغِ اعتماد مقارن أولاً", "error");
        return;
      }
    }
    // Optimistic flag flip when the comp is already linked to this valuation.
    const setter = context === MARKET_CONTEXT ? setSelection : setLandSelection;
    const current =
      context === MARKET_CONTEXT ? selection : landSelection;
    const alreadyLinked = current?.items.some(
      (i) => i.comparablePropertyId === compId,
    );
    if (alreadyLinked) {
      setter((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          adoptedCount: Math.max(0, prev.adoptedCount + (isAdopted ? 1 : -1)),
          items: prev.items.map((i) =>
            i.comparablePropertyId === compId ? { ...i, isAdopted } : i,
          ),
        };
      });
    }
    const res = await setValuationComparableAdopted(
      config,
      valuationRequestId,
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

  async function saveSubjectArea() {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    setSaving(true);
    const area = parseDecimal(subjectArea);
    const res = await saveValuationMarketApproach(config, valuationRequestId, {
      subjectAreaSqm: Number.isFinite(area) ? area : null,
      adjustmentBasis,
      analysisNotes: analysisNotes.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ مساحة العقار", "error");
      return;
    }
    setSelection(res.data);
    showToast("تم حفظ رأي أسلوب السوق", "success");
  }

  /** “Restore automatic text” — clears the manual narrative so the generated one shows again. */
  function clearAnalysisNotes() {
    setAnalysisNotes("");
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    const area = parseDecimal(subjectArea);
    void saveValuationMarketApproach(config, valuationRequestId, {
      subjectAreaSqm: Number.isFinite(area) ? area : null,
      adjustmentBasis,
      analysisNotes: null,
    }).then((res) => {
      if (res.ok) setSelection(res.data);
    });
  }

  async function saveMatrixCell(
    item: ValuationComparableSelectionDto,
    factorKey: string,
    raw: string,
  ): Promise<boolean> {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return false;
    const percent = parseDecimal(raw) || 0;
    const lines = ensureLinesForSave(
      item,
      factorKey,
      percent,
      factorRowsFor(contextOfItem(item)),
    );
    setSaving(true);
    const res = await saveValuationComparableMarket(
      config,
      valuationRequestId,
      item.id,
      marketSaveBody(item, lines.map((l, i) => lineForSave(item, l, i))),
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ التسوية", "error");
      return false;
    }
    await reload({ silent: true, scope: "derived" });
    return true;
  }

  /** compEdit: save price/area override for this valuation only — does not touch the shared bank.
   * Returns true on success — the bank table clears its local draft then. */
  async function saveBankOverride(
    item: ValuationComparableSelectionDto,
    field: "price" | "area",
    raw: string,
  ): Promise<boolean> {
    const config = apiConfig();
    if (!config || !valuationRequestId) return false;
    const parsed = parseDecimal(raw);
    const value = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    const lines = (item.market?.adjustmentLines ?? []).map((l, i) =>
      lineForSave(item, l, i),
    );
    setSaving(true);
    const res = await saveValuationComparableMarket(
      config,
      valuationRequestId,
      item.id,
      marketSaveBody(item, lines, {
        priceOverrideSar:
          field === "price" ? value : item.priceOverrideSar ?? null,
        areaOverrideSqm:
          field === "area" ? value : item.areaOverrideSqm ?? null,
      }),
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ تعديل المقارن", "error");
      return false;
    }
    await reload({ silent: true, scope: "derived" });
    return true;
  }

  /** compSpec: comparable description for a given difference factor — one cell per comparable. */
  async function saveCellDescription(
    item: ValuationComparableSelectionDto,
    factorKey: string,
    text: string,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    const lines = (item.market?.adjustmentLines ?? []).map((l, i) => ({
      ...lineForSave(item, l, i),
      descriptionAr:
        l.factorKey === factorKey ? text.trim() || null : l.descriptionAr ?? null,
    }));
    setSaving(true);
    const res = await saveValuationComparableMarket(
      config,
      valuationRequestId,
      item.id,
      marketSaveBody(item, lines),
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ وصف المقارن", "error");
      return;
    }
    await reload({ silent: true, scope: "derived" });
  }

  /** subjSpec: subject-property description for a difference factor — subject column. */
  async function saveSubjectSpec(factorKey: string, text: string) {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    const next = { ...subjectSpecs };
    if (text.trim()) next[factorKey] = text.trim();
    else delete next[factorKey];
    const area = parseDecimal(subjectArea);
    setSaving(true);
    const res = await saveValuationMarketApproach(config, valuationRequestId, {
      subjectAreaSqm: Number.isFinite(area) ? area : null,
      adjustmentBasis,
      analysisNotes: analysisNotes.trim() || null,
      subjectSpecs: next,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ وصف العقار", "error");
      return;
    }
    setSelection(res.data);
  }

  /** Remove a sequential adjustment (financing/type) from the table — restorable via the restore chip. */
  async function removeSequentialFactor(
    factorKey: string,
    context: string = MARKET_CONTEXT,
  ) {
    if (factorKey === "market") return;
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    setSaving(true);
    const results = await Promise.all(
      adoptedFor(context).map((item) => {
        const lines = (item.market?.adjustmentLines ?? [])
          .filter((l) => l.factorKey !== factorKey)
          .map((l, i) => lineForSave(item, l, i));
        return saveValuationComparableMarket(
          config,
          valuationRequestId,
          item.id,
          marketSaveBody(item, lines),
        );
      }),
    );
    setSaving(false);
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      showToast(failed.message ?? "تعذّر حذف البند", "error");
      await reload({ silent: true, scope: "derived" });
      return;
    }
    await reload({ silent: true, scope: "derived" });
  }

  /** Restore a deleted sequential adjustment to its default values. */
  async function restoreSequentialFactor(
    factorKey: string,
    context: string = MARKET_CONTEXT,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    const label =
      STANDARD_FACTORS.find((f) => f.factorKey === factorKey)?.labelAr ?? factorKey;
    setSaving(true);
    const results = await Promise.all(
      adoptedFor(context)
        .filter(
          (item) =>
            !(item.market?.adjustmentLines ?? []).some(
              (l) => l.factorKey === factorKey,
            ),
        )
        .map((item) => {
          const existing = item.market?.adjustmentLines ?? [];
          const lines = [
            ...existing.map((l, i) => lineForSave(item, l, i)),
            newAdjustmentLine(factorKey, label, existing.length),
          ];
          return saveValuationComparableMarket(
            config,
            valuationRequestId,
            item.id,
            marketSaveBody(item, lines),
          );
        }),
    );
    setSaving(false);
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      showToast(failed.message ?? "تعذّر استعادة البند", "error");
      await reload({ silent: true, scope: "derived" });
      return;
    }
    await reload({ silent: true, scope: "derived" });
  }

  async function saveWeight(
    item: ValuationComparableSelectionDto,
    rawPct: string,
    weightRationale: string,
  ): Promise<boolean> {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return false;
    const pct = parseDecimal(rawPct) || 0;
    const lines = (item.market?.adjustmentLines ?? []).map((l, i) =>
      lineForSave(item, l, i),
    );
    setSaving(true);
    const res = await saveValuationComparableMarket(
      config,
      valuationRequestId,
      item.id,
      marketSaveBody(item, lines, {
        weightIsManual: true,
        weightPct: pct,
        weightOverrideRationale:
          weightRationale.trim() ||
          item.market?.weightOverrideRationale ||
          null,
      }),
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ الوزن", "error");
      return false;
    }
    await reload({ silent: true, scope: "derived" });
    return true;
  }

  async function resetWeights(
    context: string = MARKET_CONTEXT,
  ): Promise<boolean> {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return false;
    setSaving(true);
    const results = await Promise.all(
      adoptedFor(context).map((item) => {
        const lines = (item.market?.adjustmentLines ?? []).map((l, i) =>
          lineForSave(item, l, i),
        );
        return saveValuationComparableMarket(
          config,
          valuationRequestId,
          item.id,
          marketSaveBody(item, lines, {
            weightIsManual: false,
            weightPct: null,
            weightOverrideRationale: null,
          }),
        );
      }),
    );
    setSaving(false);
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      showToast(failed.message ?? "تعذّر إعادة ضبط الأوزان", "error");
      await reload({ silent: true, scope: "derived" });
      return false;
    }
    showToast("أُعيد ضبط الأوزان للاقتراح الآلي", "success");
    await reload({ silent: true, scope: "derived" });
    return true;
  }

  async function changeAdjustmentBasis(basis: "price_per_sqm" | "whole_property") {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    setAdjustmentBasis(basis);
    setSaving(true);
    const area = parseDecimal(subjectArea);
    const res = await saveValuationMarketApproach(config, valuationRequestId, {
      subjectAreaSqm: Number.isFinite(area) ? area : null,
      adjustmentBasis: basis,
      analysisNotes: analysisNotes.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ أساس التسوية", "error");
      return;
    }
    setSelection(res.data);
  }

  async function saveFactorRationale(
    factorKey: string,
    rawText: string,
    context: string = MARKET_CONTEXT,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    const text = rawText.trim();
    // Weight justification is stored on the weight field, not as an adjustment line.
    if (factorKey === "weight") {
      setSaving(true);
      const results = await Promise.all(
        adoptedFor(context)
          .filter((item) => item.market?.weightIsManual)
          .map((item) => {
            const lines = (item.market?.adjustmentLines ?? []).map((l, i) =>
              lineForSave(item, l, i),
            );
            return saveValuationComparableMarket(
              config,
              valuationRequestId,
              item.id,
              marketSaveBody(item, lines, {
                weightOverrideRationale: text || null,
              }),
            );
          }),
      );
      setSaving(false);
      const failed = results.find((r) => !r.ok);
      if (failed && !failed.ok) {
        showToast(failed.message ?? "تعذّر حفظ مبرر الوزن", "error");
      }
      await reload({ silent: true, scope: "derived" });
      return;
    }
    // Rule Q-8-1: one factor-level justification — single request instead of per-comparable fan-out;
    // Line justifications stay as per-comparable overrides edited from the comparable cell.
    if (text.length > 0 && text.length < JUSTIFICATION_MIN_LENGTH) {
      showToast(
        `المبرر أقصر من الحد الأدنى (${JUSTIFICATION_MIN_LENGTH} أحرف) — اكتب مبرراً جوهرياً (ق-8)`,
        "error",
      );
      return;
    }
    setSaving(true);
    const res = await saveAdjustmentFactorRationale(config, valuationRequestId, {
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
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    const text = rawText.trim();
    if (text.length > 0 && text.length < JUSTIFICATION_MIN_LENGTH) {
      showToast(
        `المبرر أقصر من الحد الأدنى (${JUSTIFICATION_MIN_LENGTH} أحرف) — اكتب مبرراً جوهرياً (ق-8)`,
        "error",
      );
      return;
    }
    const item = adoptedFor(context).find((i) => i.id === selectionId);
    if (!item) return;
    const rawLine = item.market?.adjustmentLines?.find(
      (l) => l.factorKey === factorKey,
    );
    const lines = ensureLinesForSave(
      item,
      factorKey,
      linePercent(item, factorKey),
      factorRowsFor(context),
    ).map((l, i) => ({
      ...lineForSave(item, l, i),
      // Writing an override alone does not turn a “suggested” value into a stored manual percentage.
      percent:
        l.factorKey === factorKey && rawLine?.isSuggestedValue
          ? 0
          : lineForSave(item, l, i).percent,
      rationale: l.factorKey === factorKey ? text : l.rationale,
    }));
    setSaving(true);
    const res = await saveValuationComparableMarket(
      config,
      valuationRequestId,
      item.id,
      marketSaveBody(item, lines),
    );
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ تخصيص المبرر", "error");
    }
    await reload({ silent: true, scope: "derived" });
  }

  async function toggleFactorIncluded(
    _item: ValuationComparableSelectionDto,
    factorKey: string,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    const context = contextOfItem(_item);
    const items = adoptedFor(context);
    const currentlyOn =
      items[0]?.market?.adjustmentLines?.find((l) => l.factorKey === factorKey)
        ?.isIncluded !== false;
    const nextIncluded = !currentlyOn;
    // Optimistic ✓ flag flip — save runs in parallel; silent reload reconciles.
    const setter = context === LAND_WITHIN_COST ? setLandSelection : setSelection;
    setter((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((it) =>
              it.isAdopted && it.market
                ? {
                    ...it,
                    market: {
                      ...it.market,
                      adjustmentLines: (it.market.adjustmentLines ?? []).map(
                        (l) =>
                          l.factorKey === factorKey
                            ? { ...l, isIncluded: nextIncluded }
                            : l,
                      ),
                    },
                  }
                : it,
            ),
          }
        : prev,
    );
    const results = await Promise.all(
      items.map((item) => {
        const suggestedByKey = new Map(
          (item.market?.adjustmentLines ?? []).map((l) => [
            l.factorKey,
            l.isSuggestedValue === true,
          ]),
        );
        const lines = ensureLinesForSave(
          item,
          factorKey,
          linePercent(item, factorKey),
          factorRowsFor(context),
        ).map((l, i) => ({
          ...lineForSave(
            item,
            { ...l, isSuggestedValue: suggestedByKey.get(l.factorKey) ?? false },
            i,
          ),
          isIncluded: l.factorKey === factorKey ? nextIncluded : l.isIncluded,
        }));
        return saveValuationComparableMarket(
          config,
          valuationRequestId,
          item.id,
          marketSaveBody(item, lines),
        );
      }),
    );
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      showToast(failed.message ?? "تعذّر تحديث البند", "error");
    }
    await reload({ silent: true, scope: "derived" });
  }

  async function saveAreaFactorPct(raw: string) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    const pct = parseDecimal(raw);
    if (!Number.isFinite(pct)) return;
    setSaving(true);
    const area = parseDecimal(subjectArea);
    const res = await saveValuationMarketApproach(config, valuationRequestId, {
      subjectAreaSqm: Number.isFinite(area) ? area : null,
      adjustmentBasis,
      areaFactorPct: pct,
      analysisNotes: analysisNotes.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ معامل المساحة", "error");
      return;
    }
    setSelection(res.data);
  }

  async function addDifferenceFactor(
    factorKey: string,
    labelAr: string,
    context: string = MARKET_CONTEXT,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    if (!adoptedFor(context).length) {
      showToast("اعتمد مقارناً أولاً", "error");
      return;
    }
    setSaving(true);
    const results = await Promise.all(
      adoptedFor(context)
        .filter(
          (item) =>
            !(item.market?.adjustmentLines ?? []).some(
              (l) => l.factorKey === factorKey,
            ),
        )
        .map((item) => {
          const existing = item.market?.adjustmentLines ?? [];
          const lines = [
            ...existing.map((l, i) => lineForSave(item, l, i)),
            newAdjustmentLine(factorKey, labelAr, existing.length),
          ];
          return saveValuationComparableMarket(
            config,
            valuationRequestId,
            item.id,
            marketSaveBody(item, lines),
          );
        }),
    );
    setSaving(false);
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      showToast(failed.message ?? "تعذّر إضافة العامل", "error");
      await reload({ silent: true, scope: "derived" });
      return;
    }
    showToast("أُضيف عامل الاختلاف", "success");
    await reload({ silent: true, scope: "derived" });
  }

  async function removeDifferenceFactor(
    factorKey: string,
    context: string = MARKET_CONTEXT,
  ) {
    const config = apiConfig();
    if (!config || !valuationRequestId || adjustmentsLocked) return;
    if (AUTO_AREA_KEYS.has(factorKey) || SEQUENTIAL_KEYS.has(factorKey)) return;
    setSaving(true);
    const results = await Promise.all(
      adoptedFor(context).map((item) => {
        const lines = (item.market?.adjustmentLines ?? [])
          .filter((l) => l.factorKey !== factorKey)
          .map((l, i) => lineForSave(item, l, i));
        return saveValuationComparableMarket(
          config,
          valuationRequestId,
          item.id,
          marketSaveBody(item, lines),
        );
      }),
    );
    setSaving(false);
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      showToast(failed.message ?? "تعذّر حذف العامل", "error");
      await reload({ silent: true, scope: "derived" });
      return;
    }
    showToast("حُذف عامل الاختلاف", "success");
    await reload({ silent: true, scope: "derived" });
  }

  /* ─── Stable handlers for the comparables bank — so table memo holds across shell re-renders.
     Function declarations above are hoisted, so references here are valid. ─── */
  const adoptRef = useRef(adopt);
  adoptRef.current = adopt;
  const saveBankOverrideRef = useRef(saveBankOverride);
  saveBankOverrideRef.current = saveBankOverride;
  const onAdoptMarket = useCallback((comparableId: string, adopted: boolean) => {
    void adoptRef.current(comparableId, adopted, MARKET_CONTEXT);
  }, []);
  const onAdoptLand = useCallback((comparableId: string, adopted: boolean) => {
    void adoptRef.current(comparableId, adopted, LAND_WITHIN_COST);
  }, []);
  const onSaveBankOverride = useCallback(
    (
      item: ValuationComparableSelectionDto,
      field: "price" | "area",
      raw: string,
    ) => saveBankOverrideRef.current(item, field, raw),
    [],
  );

  /* ─── Adjustments-matrix command dispatcher — one stable ref per context instead of 21 handlers,
     so table memo survives shell re-renders (Command/Strategy). ─── */
  const matrixOps = {
    saveMatrixCell,
    saveWeight,
    saveFactorRationale,
    saveLineRationaleOverride,
    toggleFactorIncluded,
    changeAdjustmentBasis,
    resetWeights,
    saveAreaFactorPct,
    addDifferenceFactor,
    removeDifferenceFactor,
    removeSequentialFactor,
    restoreSequentialFactor,
    saveCellDescription,
    saveSubjectSpec,
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

  return {
    saveSubjectArea,
    clearAnalysisNotes,
    onAdoptMarket,
    onAdoptLand,
    onSaveBankOverride,
    dispatchMarketMatrix,
    dispatchLandMatrix,
  };
}
