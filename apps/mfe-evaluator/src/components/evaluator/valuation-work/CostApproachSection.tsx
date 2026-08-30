"use client";

import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import {
  getBuildingInventory,
  saveValuationCostApproach,
  type ValuationCostApproachDto,
  type ValuationCostLineDto,
} from "@platform/api-client";
import {
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  cn,
  opsFldControl,
  useToast,
} from "@platform/ui-kit";

import {
  Card,
  CardPad,
  CardTitle,
  FieldLabel,
  GhostBtn,
  PrimaryBtn,
  ToggleChip,
} from "./atoms";

import {
  COST_GROUP1_KEYS,
  COST_ITEM_OPTIONS,
  COST_UNIT_OPTIONS,
  INDIRECT_COST_ITEMS,
  costGroupOf,
  costLineComputed,
} from "./lib/cost-line-math";
import { apiConfig, fmt } from "./lib/shell-utils";

/**
 * Cost-approach section — owns full cost drafts (lines, indirects, ages,
 * obsolescence, analysis) locally: typing here does not re-render the valuation shell. Stays mounted
 * (hidden) after first visit so unsaved drafts survive screen switches.
 * Hydrates from the server batch via hydrateKey — bumps on full load only.
 */
export const CostApproachSection = memo(function CostApproachSection({
  valuationRequestId,
  poNumber,
  propertyId,
  cost,
  hydrateKey,
  buildingOnly,
  isApartmentProperty,
  costBasisKey,
  saving,
  onSavingChange,
  onCostSaved,
}: {
  valuationRequestId: string | null;
  poNumber?: string;
  propertyId: string;
  cost: ValuationCostApproachDto | null;
  hydrateKey: number;
  buildingOnly: boolean;
  isApartmentProperty: boolean;
  costBasisKey: string;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onCostSaved: (dto: ValuationCostApproachDto) => void;
}) {
  const { showToast } = useToast();
  const [costDraft, setCostDraft] = useState<ValuationCostLineDto[]>([]);
  const [useRestrictionPct, setUseRestrictionPct] = useState("0");
  const [useRestrictionRationale, setUseRestrictionRationale] = useState("");
  const [apartmentLandShare, setApartmentLandShare] = useState("");
  const [indirectDraft, setIndirectDraft] = useState<
    Record<string, { pct: string; rationale: string }>
  >({});
  const [financingRate, setFinancingRate] = useState("0");
  const [financingMonths, setFinancingMonths] = useState("0");
  const [actualAge, setActualAge] = useState("");
  const [economicAge, setEconomicAge] = useState("");
  const [lifeExtension, setLifeExtension] = useState("0");
  const [lifeExtensionBasis, setLifeExtensionBasis] = useState("");
  const [functionalObs, setFunctionalObs] = useState("0");
  const [functionalObsRationale, setFunctionalObsRationale] = useState("");
  const [externalObs, setExternalObs] = useState("0");
  const [externalObsRationale, setExternalObsRationale] = useState("");
  /** Cost analysis — empty = auto-generated from rationales (“suggested until edited” model). */
  const [costAnalysisNotes, setCostAnalysisNotes] = useState("");
  /** Drag a cost line to reorder within its group (drag-to-reorder from the interactive form). */
  const [dragCostId, setDragCostId] = useState<string | null>(null);

  // Hydrate from the server batch — each full load (new hydrateKey) reseeds drafts;
  // silent reloads leave them alone (same meaning as hydrateEdits in the shell previously).
  const hydratedKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (hydratedKeyRef.current === hydrateKey) return;
    hydratedKeyRef.current = hydrateKey;
    if (!cost) {
      setCostDraft([]);
      return;
    }
    setCostDraft(cost.lines);
    setCostAnalysisNotes(cost.analysisNotes ?? "");
    setUseRestrictionPct(String(cost.useRestrictionDiscountPct ?? 0));
    setUseRestrictionRationale(cost.useRestrictionRationale ?? "");
    setApartmentLandShare(
      cost.apartmentLandShareSqm != null
        ? String(cost.apartmentLandShareSqm)
        : "",
    );
    const indirect: Record<string, { pct: string; rationale: string }> = {};
    for (const item of cost.indirectItems ?? []) {
      indirect[item.itemKey] = {
        pct: String(item.pct),
        rationale: item.rationale ?? "",
      };
    }
    setIndirectDraft(indirect);
    setFinancingRate(String(cost.financingAnnualRatePct ?? 0));
    setFinancingMonths(String(cost.financingMonths ?? 0));
    setActualAge(cost.actualAgeYears != null ? String(cost.actualAgeYears) : "");
    setEconomicAge(
      cost.economicAgeYears != null ? String(cost.economicAgeYears) : "",
    );
    setLifeExtension(String(cost.lifeExtensionYears ?? 0));
    setLifeExtensionBasis(cost.lifeExtensionBasis ?? "");
    setFunctionalObs(String(cost.functionalObsolescencePct ?? 0));
    setFunctionalObsRationale(cost.functionalObsolescenceRationale ?? "");
    setExternalObs(String(cost.externalObsolescencePct ?? 0));
    setExternalObsRationale(cost.externalObsolescenceRationale ?? "");
  }, [hydrateKey, cost]);

  async function seedCostFromInventory() {
    const config = apiConfig();
    if (!config || !valuationRequestId || !poNumber) {
      showToast("يلزم رقم أمر العمل لسحب حصر المباني", "error");
      return;
    }
    const inv = await getBuildingInventory(config, poNumber, propertyId);
    if (!inv.ok) {
      showToast("تعذّر تحميل حصر المباني", "error");
      return;
    }
    const seeded: ValuationCostLineDto[] = inv.data.lines.map((l, i) => ({
      id: crypto.randomUUID(),
      sourceInventoryLineId: l.id ?? null,
      structureKind: l.structureKind || "other",
      itemKey:
        l.structureKind === "basement"
          ? "basement"
          : l.structureKind === "fence"
            ? "fence"
            : l.structureKind === "annex"
              ? /علوي|upper/i.test(l.label ?? "")
                ? "upper_annex"
                : "lower_annex"
              : "custom",
      itemLabelAr: "",
      unit: "sqm",
      unitLabelAr: "م²",
      buildRatioPct: null,
      repeatedFloorCount: null,
      label: l.label,
      areaSqm: Number(String(l.areaSqm ?? "0").replace(",", ".")) || 0,
      unitCostSar: 0,
      lineTotal: 0,
      rationale: "",
      isIncluded: true,
      sortOrder: i,
    }));
    setCostDraft(seeded);
    showToast(`تم سحب ${seeded.length} بندًا من الحصر — أدخل تكلفة المتر`, "info");
  }

  async function saveCost() {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    onSavingChange(true);
    const res = await saveValuationCostApproach(config, valuationRequestId, {
      refreshLandFromLandComps: true,
      analysisNotes: costAnalysisNotes.trim() || null,
      useRestrictionDiscountPct: Number(useRestrictionPct.replace(",", ".")) || 0,
      useRestrictionRationale: useRestrictionRationale.trim() || null,
      apartmentLandShareSqm: apartmentLandShare.trim()
        ? Number(apartmentLandShare.replace(",", ".")) || 0
        : null,
      indirectItems: INDIRECT_COST_ITEMS.filter(
        (item) =>
          Number((indirectDraft[item.key]?.pct ?? "0").replace(",", ".")) > 0 ||
          (indirectDraft[item.key]?.rationale ?? "").trim() !== "",
      ).map((item, i) => ({
        itemKey: item.key,
        pct: Number((indirectDraft[item.key]?.pct ?? "0").replace(",", ".")) || 0,
        rationale: (indirectDraft[item.key]?.rationale ?? "").trim() || null,
        sortOrder: i,
      })),
      financingAnnualRatePct: Number(financingRate.replace(",", ".")) || 0,
      financingMonths: Number.parseInt(financingMonths, 10) || 0,
      actualAgeYears: actualAge.trim()
        ? Number(actualAge.replace(",", ".")) || 0
        : null,
      economicAgeYears: economicAge.trim()
        ? Number(economicAge.replace(",", ".")) || 0
        : null,
      lifeExtensionYears: Number(lifeExtension.replace(",", ".")) || 0,
      lifeExtensionBasis: lifeExtensionBasis.trim() || null,
      functionalObsolescencePct: Number(functionalObs.replace(",", ".")) || 0,
      functionalObsolescenceRationale: functionalObsRationale.trim() || null,
      externalObsolescencePct: Number(externalObs.replace(",", ".")) || 0,
      externalObsolescenceRationale: externalObsRationale.trim() || null,
      lines: costDraft.map((l, i) => ({
        id: l.id,
        sourceInventoryLineId: l.sourceInventoryLineId,
        structureKind: l.structureKind,
        itemKey: l.itemKey || "custom",
        label: l.label,
        areaSqm: l.areaSqm,
        unit: l.unit || null,
        buildRatioPct: l.buildRatioPct ?? null,
        repeatedFloorCount: l.repeatedFloorCount ?? null,
        unitCostSar: l.unitCostSar,
        rationale: l.rationale,
        isIncluded: l.isIncluded,
        sortOrder: i,
      })),
    });
    onSavingChange(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ التكلفة", "error");
      return;
    }
    setCostDraft(res.data.lines);
    showToast("تم حفظ أسلوب التكلفة", "success");
    // Silent reload — no loading-skeleton flash after save (used to be a full reload).
    onCostSaved(res.data);
  }

  const landComplete = !!cost?.landEstimateComplete;

  // Live local calcs per interactive-form rules (server recalculates on save).
  // useMemo + one pass instead of map + three reduces that re-ran on every keystroke in any
  // field on screen, passing first-floor once instead of find-per-line (rerender-memo).
  const {
    firstFloorLine,
    computedLines,
    directTotal,
    areaSubtotal,
    extraSubtotal,
    buildAreaLocal,
  } = useMemo(() => {
    const firstFloorLine =
      costDraft.find((l) => l.itemKey === "first_floor") ?? null;
    const computedLines = costDraft.map((l) =>
      costLineComputed(l, costDraft, firstFloorLine),
    );
    let directTotal = 0;
    let areaSubtotal = 0;
    let buildAreaLocal = 0;
    computedLines.forEach((c, i) => {
      directTotal += c.total;
      if (c.inArea) {
        areaSubtotal += c.total;
        if (
          (costDraft[i].unit || "sqm") === "sqm" &&
          costDraft[i].isIncluded !== false
        ) {
          buildAreaLocal += c.qty;
        }
      }
    });
    return {
      firstFloorLine,
      computedLines,
      directTotal,
      areaSubtotal,
      extraSubtotal: directTotal - areaSubtotal,
      buildAreaLocal,
    };
  }, [costDraft]);
  const financingPctLocal =
    ((Number(financingRate.replace(",", ".")) || 0) *
      ((Number.parseInt(financingMonths, 10) || 0) / 12)) *
    0.5;
  const indirectSumLocal =
    INDIRECT_COST_ITEMS.reduce(
      (s, item) =>
        s + Math.max(0, Number((indirectDraft[item.key]?.pct ?? "0").replace(",", ".")) || 0),
      0,
    ) + financingPctLocal;
  const totalCostLocal = directTotal * (1 + indirectSumLocal / 100);
  const usedItemKeys = useMemo(
    () => new Set(costDraft.map((l) => l.itemKey)),
    [costDraft],
  );
  const ghostOptionsFor = (group: "area" | "extra") =>
    COST_ITEM_OPTIONS.filter(
      (o) =>
        o.key !== "custom" &&
        !usedItemKeys.has(o.key) &&
        (group === "area"
          ? COST_GROUP1_KEYS.has(o.key)
          : !COST_GROUP1_KEYS.has(o.key)),
    );
  // Age and depreciation locally (live — matches server calc on save).
  const economicLocal = Number(economicAge.replace(",", ".")) || 0;
  const extLifeLocal = economicLocal + (Number(lifeExtension.replace(",", ".")) || 0);
  const actualLocal = Number(actualAge.replace(",", ".")) || 0;
  const physicalLocal =
    extLifeLocal > 0 && actualAge.trim() ? (actualLocal / extLifeLocal) * 100 : 0;
  const functionalLocal = Number(functionalObs.replace(",", ".")) || 0;
  const externalLocal = Number(externalObs.replace(",", ".")) || 0;
  const totalDepLocal = physicalLocal + functionalLocal + externalLocal;
  // Form spec: no 100% cap — obsolescence overshoot yields a negative value and is gated by alert m4.
  const depValueLocal = (totalCostLocal * Math.max(totalDepLocal, 0)) / 100;
  const netValueLocal = totalCostLocal - depValueLocal;
  const landValueNow = cost?.landValueFromMarket ?? 0;
  // costValue = landPart + netValue always (landPart = 0 when land is incomplete).
  const costValueLocal =
    netValueLocal + (!buildingOnly && landComplete ? landValueNow : 0);
  const developerProfitPct =
    Number((indirectDraft["developer_profit"]?.pct ?? "0").replace(",", ".")) || 0;

  // Cost-approach alerts — interactive-form trigger table.
  const costAlerts: { kind: "error" | "warn" | "ok"; title: string; body: string }[] = [];
  if (costDraft.length === 0)
    costAlerts.push({
      kind: "error",
      title: "لا يوجد بند تكلفة",
      body: "يلزم بند واحد على الأقل في جدول التكلفة.",
    });
  if (extLifeLocal <= 0)
    costAlerts.push({
      kind: "error",
      title: "العمر الممتد صفر",
      body: "العمر الاقتصادي + التمديد يجب أن يكون أكبر من صفر.",
    });
  else if (actualLocal > extLifeLocal)
    costAlerts.push({
      kind: "error",
      title: "العمر الفعلي يتجاوز العمر الممتد",
      body: "الإهلاك المادي يتجاوز ١٠٠٪.",
    });
  if (totalDepLocal > 100)
    costAlerts.push({
      kind: "error",
      title: "مجموع التقادم يتجاوز ١٠٠٪",
      body: "راجع نسب التقادم الوظيفي والخارجي.",
    });
  if (
    costDraft.some((l) => l.itemKey === "repeated_floors") &&
    !costDraft.some((l) => l.itemKey === "first_floor" && l.areaSqm > 0)
  )
    costAlerts.push({
      kind: "error",
      title: "بند الأدوار المتكررة بلا «الدور الأول»",
      body: "كمية المتكررة تُشتقّ من مسطح الدور الأول — أعد إدراجه أو احذف بند المتكررة.",
    });
  if (Number(lifeExtension.replace(",", ".")) > 0 && !lifeExtensionBasis.trim())
    costAlerts.push({
      kind: "warn",
      title: "تمديد العمر مستخدم",
      body: "يلزم بيان أساس التمديد كتابةً.",
    });
  for (const l of costDraft) {
    if (
      costGroupOf(l) === "extra" &&
      (l.label.trim() || l.itemKey !== "custom") &&
      !l.rationale.trim()
    ) {
      costAlerts.push({
        kind: "warn",
        title: `بند إضافي بلا مبرر: ${l.label || COST_ITEM_OPTIONS.find((o) => o.key === l.itemKey)?.label || ""}`,
        body: "يلزم توثيق أساس التقدير — احتمال ازدواج مع ما هو مضمَّن في تكلفة المتر.",
      });
    }
    if (
      l.itemKey === "repeated_floors" &&
      l.unitCostSar > 0 &&
      l.unitCostSar !== (firstFloorLine?.unitCostSar ?? 0) &&
      !l.rationale.trim()
    ) {
      costAlerts.push({
        kind: "warn",
        title: "تكلفة متر المتكررة تخالف الدور الأول",
        body: "التجاوز مسموح بمبرر مكتوب — دوّن سببه.",
      });
    }
  }
  if ((Number(useRestrictionPct.replace(",", ".")) || 0) > 0 && !useRestrictionRationale.trim())
    costAlerts.push({
      kind: "warn",
      title: "خصم تقييد الاستخدام بلا مبرر",
      body: "افتراضه صفر ولا يُملأ إلا بمبرر موثّق.",
    });
  if (!buildingOnly && !landComplete)
    costAlerts.push({
      kind: "error",
      title: "قيمة الأرض غير مقدَّرة",
      body: "اعتمد مقارنات أراضٍ فضاء — مؤشر الأسلوب يبقى غير مكتمل بدونها.",
    });
  if ((functionalLocal > 0 && !functionalObsRationale.trim()) ||
      (externalLocal > 0 && !externalObsRationale.trim()))
    costAlerts.push({
      kind: "warn",
      title: "تقادم وظيفي أو خارجي بلا مبرر",
      body: "يلزم مبرر مكتوب لكل نسبة تقادم غير مادية.",
    });
  if (developerProfitPct < 10 || developerProfitPct > 20)
    costAlerts.push({
      kind: "warn",
      title: "أرباح المطور خارج النطاق",
      body: `النطاق المعتاد ١٠٪–٢٠٪، والحالي ${developerProfitPct}٪.`,
    });
  if (indirectSumLocal > 45)
    costAlerts.push({
      kind: "warn",
      title: "النسب غير المباشرة مرتفعة",
      body: `المجموع ${(Math.round(indirectSumLocal * 100) / 100).toFixed(2)}٪ يتجاوز ٤٥٪.`,
    });
  if (costAlerts.length === 0)
    costAlerts.push({
      kind: "ok",
      title: "لا تنبيهات",
      body: "المدخلات ضمن الحدود المنهجية.",
    });

  // Auto cost analysis — buildCostNarrative from the interactive form.
  // memo + short-circuit: multi-KB text used to rebuild on every keystroke then be discarded
  // entirely whenever the field was manually edited (rerender-memo).
  const costNarrativeDirty = costAnalysisNotes.trim().length > 0;
  const costNarrativeAuto = useMemo(() => {
    if (costNarrativeDirty) return "";
    const noJust = "لم يتم تبريره";
    return [
    `طريقة التكلفة: ${costBasisKey === "reproduction" ? "إعادة الإنتاج" : "الإحلال"}.`,
    (Number(useRestrictionPct.replace(",", ".")) || 0) > 0
      ? `خصم تقييد الاستخدام: ${useRestrictionPct}٪ — ${useRestrictionRationale.trim() || noJust}.`
      : null,
    "مبررات بنود التكلفة:\n" +
      (costDraft.length
        ? costDraft
            .filter((l) => l.label.trim() || l.itemKey !== "custom")
            .map(
              (l) =>
                `• ${l.label || COST_ITEM_OPTIONS.find((o) => o.key === l.itemKey)?.label || ""} — ${l.rationale.trim() || noJust}`,
            )
            .join("\n")
        : "• لا توجد بنود"),
    "مبررات النسب غير المباشرة:\n" +
      INDIRECT_COST_ITEMS.map(
        (item) =>
          `• ${item.label} (${indirectDraft[item.key]?.pct ?? "0"}٪) — ${(indirectDraft[item.key]?.rationale ?? "").trim() || noJust}`,
      ).join("\n") +
      `\n• التمويل — معدل ${financingRate}٪ سنوياً على ${financingMonths} شهراً بمتوسط سحب ٥٠٪`,
    "مبررات العمر والتقادم:\n" +
      [
        `• العمر الفعلي (${actualAge || "—"}) — ${noJust}`,
        `• العمر الاقتصادي (${economicAge || "—"}) — ${noJust}`,
        `• تمديد العمر (${lifeExtension || "0"}) — ${lifeExtensionBasis.trim() || noJust}`,
        `• التقادم الوظيفي (${functionalObs || "0"}٪) — ${functionalObsRationale.trim() || noJust}`,
        `• التقادم الخارجي (${externalObs || "0"}٪) — ${externalObsRationale.trim() || noJust}`,
      ].join("\n"),
  ]
      .filter(Boolean)
      .join("\n\n");
  }, [
    costNarrativeDirty,
    costBasisKey,
    useRestrictionPct,
    useRestrictionRationale,
    costDraft,
    indirectDraft,
    financingRate,
    financingMonths,
    actualAge,
    economicAge,
    lifeExtension,
    lifeExtensionBasis,
    functionalObs,
    functionalObsRationale,
    externalObs,
    externalObsRationale,
  ]);

  const blankCostLine = (
    partial: Partial<ValuationCostLineDto>,
  ): ValuationCostLineDto => ({
    id: crypto.randomUUID(),
    sourceInventoryLineId: null,
    structureKind: "other",
    itemKey: "custom",
    itemLabelAr: "",
    label: "",
    areaSqm: 0,
    unit: "sqm",
    unitLabelAr: "م²",
    buildRatioPct: null,
    repeatedFloorCount: null,
    unitCostSar: 0,
    lineTotal: 0,
    rationale: "",
    isIncluded: true,
    sortOrder: costDraft.length,
    ...partial,
  });
  const addCostLine = (partial: Partial<ValuationCostLineDto>) =>
    setCostDraft([...costDraft, blankCostLine(partial)]);
  /** Insert a custom line after a given row — inherits the row’s group (hover-insert from the form). */
  const insertCostLineAfter = (idx: number) => {
    const anchor = costDraft[idx];
    if (!anchor) return;
    const next = [...costDraft];
    next.splice(
      idx + 1,
      0,
      blankCostLine({
        structureKind: costGroupOf(anchor) === "area" ? "floor" : "other",
      }),
    );
    setCostDraft(next);
  };
  /** Move a dragged line to the target row position — cross-group moves are rejected (as in the form). */
  const moveCostLine = (sourceId: string, targetIdx: number) => {
    const sourceIdx = costDraft.findIndex((l) => l.id === sourceId);
    const target = costDraft[targetIdx];
    if (sourceIdx < 0 || !target || sourceIdx === targetIdx) return;
    if (costGroupOf(costDraft[sourceIdx]!) !== costGroupOf(target)) return;
    const next = [...costDraft];
    const [moved] = next.splice(sourceIdx, 1);
    next.splice(targetIdx, 0, moved!);
    setCostDraft(next);
  };

  return (
    <>
      {!buildingOnly ? (
        <Card>
          <CardPad>
            <CardTitle>قيمة الأرض</CardTitle>
            <div className="grid grid-cols-4 gap-3.5">
              <div>
                <FieldLabel>سعر المتر من مقارنات الأرض</FieldLabel>
                <div dir="ltr" className="mt-1.5 text-base font-extrabold text-heading">
                  {landComplete ? fmt(cost?.landUnitRateFromMarket) : "—"}
                </div>
              </div>
              <label className="flex flex-col gap-1.5">
                <FieldLabel>خصم تقييد الاستخدام ٪</FieldLabel>
                <input
                  dir="ltr"
                  value={useRestrictionPct}
                  onChange={(e) =>
                    setUseRestrictionPct(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  className={cn(opsFldControl, "font-semibold text-center")}
                />
              </label>
              {isApartmentProperty ? (
                <label className="flex flex-col gap-1.5">
                  <FieldLabel>حصة الشقة من الأرض (م²)</FieldLabel>
                  <input
                    dir="ltr"
                    value={apartmentLandShare}
                    placeholder="120"
                    title="تحل محل مساحة الأرض في معادلة قيمة الأرض"
                    onChange={(e) =>
                      setApartmentLandShare(e.target.value.replace(/[^\d.]/g, ""))
                    }
                    className={cn(opsFldControl, "font-semibold text-center")}
                  />
                </label>
              ) : null}
              <div>
                <FieldLabel>سعر المتر بعد الخصم</FieldLabel>
                <div
                  dir="ltr"
                  className="mt-1.5 text-base font-extrabold text-gold-d"
                >
                  {landComplete ? fmt(cost?.landUnitRateAfterDiscount) : "—"}
                </div>
              </div>
              <div>
                <FieldLabel>قيمة الأرض</FieldLabel>
                <div
                  dir="ltr"
                  className={cn(
                    "mt-1.5 text-lg font-extrabold",
                    landComplete ? "text-heading" : "text-red-text",
                  )}
                >
                  {landComplete ? fmt(cost?.landValueFromMarket) : "غير مكتمل"}
                </div>
              </div>
            </div>
            <input
              placeholder="مبرر تقييد الاستخدام…"
              value={useRestrictionRationale}
              onChange={(e) => setUseRestrictionRationale(e.target.value)}
              className={cn(
                opsFldControl,
                "mt-3 border-dashed bg-surface-2 font-medium text-text-2",
              )}
            />
          </CardPad>
        </Card>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-baseline gap-2.5">
          <h2 className="m-0 text-[17px] font-extrabold text-heading">
            بنود التكلفة المباشرة
          </h2>
          <span className="text-[11.5px] text-text-3">
            البنود موجبة فقط — النقص عن السائد يُعالَج تقادماً وظيفياً · أضف البند
            من صف «اختر البند» في نهاية كل مجموعة
          </span>
        </div>
        <GhostBtn disabled={saving} onClick={() => void seedCostFromInventory()}>
          سحب من حصر المباني
        </GhostBtn>
      </div>

      <Card className="mb-6">
        <Table className="min-w-[900px]">
          <THead>
            <Tr hoverable={false}>
              <Th>البند</Th>
              <Th className="text-center">
                المساحة / العدد
                <div className="text-[10px] font-normal text-text-3">
                  · نسبة البناء
                </div>
              </Th>
              <Th className="text-center">الوحدة</Th>
              <Th className="text-center">سعر المتر / تكلفة الوحدة</Th>
              <Th className="text-center">
                الإجمالي
                <div className="text-[10px] font-normal text-text-3">
                  سعر المتر بعد غير المباشرة
                </div>
              </Th>
              <Th>مبرر التقدير</Th>
              <Th className="w-12" />
            </Tr>
          </THead>
          <TBody>
              {(
                [
                  ["area", "مسطحات المبنى والأدوار", areaSubtotal],
                  ["extra", "تكاليف وتجهيزات إضافية", extraSubtotal],
                ] as const
              ).map(([group, groupTitle, subtotal]) => (
                <Fragment key={group}>
                  <Tr hoverable={false}>
                    <Td
                      colSpan={5}
                      className="border-b border-border-md bg-gold-soft py-[9px] text-[12.5px] font-extrabold text-heading"
                    >
                      {groupTitle}
                    </Td>
                    <Td
                      colSpan={2}
                      className="border-b border-border-md bg-gold-soft py-[9px] text-end text-[13px] font-extrabold text-gold-d"
                    >
                      <span dir="ltr">{fmt(subtotal)}</span>
                    </Td>
                  </Tr>
                  {costDraft.map((line, idx) => {
                    if (costGroupOf(line) !== group) return null;
                    const comp = computedLines[idx];
                    const patchLine = (
                      partial: Partial<ValuationCostLineDto>,
                    ) => {
                      const next = [...costDraft];
                      next[idx] = { ...line, ...partial };
                      setCostDraft(next);
                    };
                    return (
                      <Fragment key={line.id}>
                      <Tr
                        hoverable={false}
                        onDragOver={(e) => {
                          if (dragCostId) e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragCostId) moveCostLine(dragCostId, idx);
                          setDragCostId(null);
                        }}
                        className={
                          dragCostId === line.id ? "opacity-45" : undefined
                        }
                      >
                        <Td>
                          <div className="flex items-start gap-1.5">
                            <span
                              draggable
                              title="اسحب لإعادة الترتيب داخل المجموعة"
                              onDragStart={(e) => {
                                setDragCostId(line.id);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragEnd={() => setDragCostId(null)}
                              className="shrink-0 cursor-grab select-none pt-[11px] text-[13px] leading-none text-text-3"
                            >
                              ⋮⋮
                            </span>
                            <div className="min-w-0 flex-1">
                          <select
                            value={line.itemKey || "custom"}
                            onChange={(e) => {
                              const opt = COST_ITEM_OPTIONS.find(
                                (o) => o.key === e.target.value,
                              );
                              patchLine({
                                itemKey: e.target.value,
                                unit: opt?.unit ?? line.unit,
                                areaSqm:
                                  (opt?.unit ?? line.unit) === "lump"
                                    ? 1
                                    : line.areaSqm,
                                repeatedFloorCount:
                                  e.target.value === "repeated_floors"
                                    ? line.repeatedFloorCount ?? 2
                                    : null,
                                label:
                                  e.target.value === "custom"
                                    ? line.label
                                    : opt?.label ?? line.label,
                              });
                            }}
                            className={cn(
                              opsFldControl,
                              "px-2.5 py-2 text-[12.5px] font-bold",
                            )}
                          >
                            {COST_ITEM_OPTIONS.filter(
                              (o) =>
                                o.key === line.itemKey ||
                                o.key === "custom" ||
                                (!usedItemKeys.has(o.key) &&
                                  (group === "area"
                                    ? COST_GROUP1_KEYS.has(o.key)
                                    : !COST_GROUP1_KEYS.has(o.key))),
                            ).map((o) => (
                              <option key={o.key} value={o.key}>
                                {o.key === "custom"
                                  ? "✎ كتابة اسم آخر…"
                                  : o.label}
                              </option>
                            ))}
                          </select>
                          {line.itemKey === "custom" ? (
                            <input
                              value={line.label}
                              placeholder="اكتب اسم البند…"
                              onChange={(e) =>
                                patchLine({ label: e.target.value })
                              }
                              className={cn(
                                opsFldControl,
                                "mt-1 px-[9px] py-1.5 text-xs font-medium",
                              )}
                            />
                          ) : null}
                            </div>
                          </div>
                        </Td>
                        <Td className="text-center">
                          {comp.isLump ? (
                            <span className="text-xs font-bold text-gold-d">
                              مبلغ مقطوع
                            </span>
                          ) : comp.isRepeated ? (
                            <label
                              title="عدد الأدوار المتكررة — الكمية تُشتق من مسطح الدور الأول × العدد"
                              className="inline-flex items-center gap-1.5"
                            >
                              <span className="text-[10.5px] text-text-3">
                                عدد
                              </span>
                              <input
                                dir="ltr"
                                value={String(line.repeatedFloorCount ?? 2)}
                                onChange={(e) =>
                                  patchLine({
                                    repeatedFloorCount:
                                      Number.parseInt(
                                        e.target.value.replace(/[^\d]/g, ""),
                                        10,
                                      ) || 0,
                                  })
                                }
                                className="w-[46px] rounded-[7px] border border-border-md px-1 py-2 text-center text-[12.5px] font-bold"
                              />
                            </label>
                          ) : (
                            <input
                              dir="ltr"
                              value={String(line.areaSqm)}
                              onChange={(e) =>
                                patchLine({
                                  areaSqm:
                                    Number(
                                      e.target.value.replace(",", "."),
                                    ) || 0,
                                })
                              }
                              className="w-[66px] rounded-[7px] border border-border-md px-1 py-2 text-center text-[12.5px] font-bold"
                            />
                          )}
                          {comp.usesPct ? (
                            <label
                              title="نسبة البناء (٪) — فارغة = ١٠٠٪"
                              className="mt-1 flex items-center justify-center gap-1"
                            >
                              <input
                                dir="ltr"
                                value={
                                  line.buildRatioPct == null
                                    ? ""
                                    : String(line.buildRatioPct)
                                }
                                placeholder="100"
                                onChange={(e) => {
                                  const raw = e.target.value.replace(
                                    /[^\d.]/g,
                                    "",
                                  );
                                  patchLine({
                                    buildRatioPct: raw
                                      ? Number(raw)
                                      : null,
                                  });
                                }}
                                className="w-[46px] rounded-md border border-dashed border-border bg-surface-2 px-[3px] py-1 text-center text-[11px] font-bold text-gold-d"
                              />
                              <span className="text-[10px] text-text-3">
                                ٪
                              </span>
                            </label>
                          ) : null}
                          {comp.usesPct &&
                          line.buildRatioPct != null &&
                          line.buildRatioPct !== 100 ? (
                            <div className="mt-0.5 text-[10px] text-gold-d">
                              المسطح <span dir="ltr">{fmt(comp.qty, 1)}</span> م²
                            </div>
                          ) : comp.isRepeated ? (
                            <div className="mt-0.5 text-[10px] text-text-3">
                              الكمية <span dir="ltr">{fmt(comp.qty, 1)}</span> م²
                            </div>
                          ) : null}
                        </Td>
                        <Td className="text-center">
                          <select
                            value={line.unit || "sqm"}
                            onChange={(e) =>
                              patchLine({
                                unit: e.target.value,
                                areaSqm:
                                  e.target.value === "lump" ? 1 : line.areaSqm,
                              })
                            }
                            className="rounded-[7px] border border-border-md px-2.5 py-2 text-[12.5px]"
                          >
                            {COST_UNIT_OPTIONS.map((o) => (
                              <option key={o.key} value={o.key}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </Td>
                        <Td className="text-center">
                          <input
                            dir="ltr"
                            value={
                              comp.inherited ? "" : String(line.unitCostSar)
                            }
                            placeholder={
                              comp.inherited ? String(comp.uc) : undefined
                            }
                            onChange={(e) =>
                              patchLine({
                                unitCostSar:
                                  Number(e.target.value.replace(",", ".")) || 0,
                              })
                            }
                            className={cn(
                              "w-[110px] rounded-[7px] border p-2 text-center text-[13px] font-bold",
                              comp.inherited
                                ? "border-border bg-surface-2 text-gold-d"
                                : "border-border-md bg-surface text-heading",
                            )}
                          />
                          {comp.inherited ? (
                            <div className="mt-0.5 text-[10px] text-gold-d">
                              موروثة من الدور الأول
                            </div>
                          ) : null}
                        </Td>
                        <Td className="text-center font-extrabold text-heading">
                          <span dir="ltr">{fmt(comp.rawTotal)}</span>
                          {comp.rawTotal > 0 && comp.qty > 0 ? (
                            <div className="mt-0.5 text-[10px] text-text-3">
                              <span dir="ltr">
                                {fmt(
                                  (comp.rawTotal *
                                    (1 + indirectSumLocal / 100)) /
                                    comp.qty,
                                )}
                              </span>{" "}
                              بعد غير المباشرة
                            </div>
                          ) : null}
                        </Td>
                        <Td>
                          <input
                            value={line.rationale}
                            onChange={(e) =>
                              patchLine({ rationale: e.target.value })
                            }
                            placeholder="أساس التقدير…"
                            className="w-full rounded-[7px] border border-border px-2.5 py-2 text-xs"
                          />
                        </Td>
                        <Td className="text-center">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              setCostDraft(
                                costDraft.filter((_, i) => i !== idx),
                              )
                            }
                            className="size-6 cursor-pointer rounded-md border border-border bg-surface text-text-3"
                          >
                            ×
                          </button>
                        </Td>
                      </Tr>
                      {/* Between-row insert bar (hover-insert) — custom line inherits the group */}
                      <Tr hoverable={false}>
                        <Td colSpan={7} className="!border-b-0 p-0">
                          <div className="flex h-2.5 items-center justify-center">
                            <button
                              type="button"
                              disabled={saving}
                              title="إدراج بند مخصص هنا"
                              onClick={() => insertCostLineAfter(idx)}
                              className="grid size-[18px] place-items-center rounded-full border border-gold bg-gold-soft text-xs font-bold leading-none text-gold-d opacity-[0.12] transition-opacity duration-[120ms] hover:opacity-100"
                            >
                              +
                            </button>
                          </div>
                        </Td>
                      </Tr>
                      </Fragment>
                    );
                  })}
                  <Tr hoverable={false} className="bg-surface-2">
                    <Td colSpan={7} className="py-2">
                      <div className="flex items-center gap-2.5">
                        <select
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            if (e.target.value === "__custom") {
                              addCostLine({
                                structureKind:
                                  group === "area" ? "floor" : "other",
                              });
                              return;
                            }
                            const opt = COST_ITEM_OPTIONS.find(
                              (o) => o.key === e.target.value,
                            );
                            if (!opt) return;
                            addCostLine({
                              itemKey: opt.key,
                              label: opt.label,
                              unit: opt.unit,
                              areaSqm: opt.unit === "lump" ? 1 : 0,
                              repeatedFloorCount:
                                opt.key === "repeated_floors" ? 2 : null,
                            });
                          }}
                          className="min-w-[170px] rounded-[7px] border border-dashed border-border-md bg-surface px-2.5 py-[7px] text-xs text-gold-d"
                        >
                          <option value="">اختر البند</option>
                          <option value="__custom">+ بند مخصص…</option>
                          {ghostOptionsFor(group).map((o) => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-[11px] text-text-3">
                          تُفتح بقية الحقول بعد اختيار البند
                        </span>
                      </div>
                    </Td>
                  </Tr>
                </Fragment>
              ))}
          </TBody>
        </Table>
        <div className="flex justify-between border-t border-border bg-surface-2 px-4 py-3">
          <span className="text-xs text-text-2">مجموع البنود = التكلفة المباشرة</span>
          <span dir="ltr" className="text-base font-extrabold text-heading">
            {fmt(directTotal)}
          </span>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-[1.2fr_1fr] gap-[18px]">
        <Card className="mb-0">
          <CardPad>
            <CardTitle>التكاليف غير المباشرة</CardTitle>
            <div className="flex flex-col gap-2.5">
              {INDIRECT_COST_ITEMS.map((item) => {
                const pctNum =
                  Number(
                    (indirectDraft[item.key]?.pct ?? "0").replace(",", "."),
                  ) || 0;
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-2.5"
                  >
                    <span className="w-[170px] shrink-0 text-[12.5px] text-text-2">
                      {item.label}
                    </span>
                    <input
                      value={indirectDraft[item.key]?.rationale ?? ""}
                      placeholder="مبرر النسبة…"
                      onChange={(e) =>
                        setIndirectDraft((prev) => ({
                          ...prev,
                          [item.key]: {
                            pct: prev[item.key]?.pct ?? "0",
                            rationale: e.target.value,
                          },
                        }))
                      }
                      className="flex-1 rounded-[7px] border border-dashed border-border bg-surface-2 px-[9px] py-1.5 text-[11.5px]"
                    />
                    <span
                      dir="ltr"
                      title="المبلغ = التكلفة المباشرة × النسبة"
                      className="w-[92px] shrink-0 text-end text-[11.5px] font-bold text-gold-d"
                    >
                      {fmt((directTotal * pctNum) / 100)}
                    </span>
                    <input
                      dir="ltr"
                      type="number"
                      min={0}
                      max={50}
                      step={1}
                      value={indirectDraft[item.key]?.pct ?? "0"}
                      onChange={(e) =>
                        setIndirectDraft((prev) => ({
                          ...prev,
                          [item.key]: {
                            pct: e.target.value,
                            rationale: prev[item.key]?.rationale ?? "",
                          },
                        }))
                      }
                      className="w-[70px] rounded-[7px] border border-border-md p-[7px] text-center text-[13px] font-bold"
                    />
                  </div>
                );
              })}
              <div className="flex items-end gap-2 border-t border-border pt-2.5">
                <label className="flex flex-1 flex-col gap-1">
                  <FieldLabel>معدل التمويل السنوي ٪</FieldLabel>
                  <input
                    dir="ltr"
                    value={financingRate}
                    onChange={(e) => setFinancingRate(e.target.value)}
                    className={cn(opsFldControl, "font-semibold text-center")}
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1">
                  <FieldLabel>مدة التنفيذ (أشهر)</FieldLabel>
                  <input
                    dir="ltr"
                    value={financingMonths}
                    onChange={(e) => setFinancingMonths(e.target.value)}
                    className={cn(opsFldControl, "font-semibold text-center")}
                  />
                </label>
              </div>
              <div className="text-[11px] text-text-3">
                التمويل: معدل سنوي × (المدة ÷ ١٢) × ٥٠٪ ={" "}
                <b dir="ltr" className="text-gold-d">
                  {(Math.round(financingPctLocal * 100) / 100).toFixed(2)}٪
                </b>{" "}
                · مبلغه{" "}
                <b dir="ltr" className="text-gold-d">
                  {fmt((directTotal * financingPctLocal) / 100)}
                </b>
              </div>
              <div className="flex items-center justify-between rounded-[9px] border border-border bg-surface-2 px-[13px] py-2.5">
                <span className="text-[12.5px] font-bold text-heading">
                  مجموع النسب غير المباشرة
                </span>
                <span
                  dir="ltr"
                  className={cn(
                    "text-[15px] font-extrabold",
                    indirectSumLocal > 45 ? "text-red-text" : "text-heading",
                  )}
                >
                  {(Math.round(indirectSumLocal * 100) / 100).toFixed(2)}٪
                </span>
              </div>
              {indirectSumLocal > 45 ? (
                <div className="text-[11.5px] font-bold text-red-text">
                  مجموع النسب غير المباشرة يتجاوز ٤٥٪ — يستلزم مراجعة
                </div>
              ) : null}
              <div className="flex items-center justify-between rounded-[9px] border border-border-md bg-gold-soft px-[13px] py-2.5">
                <span className="text-[12.5px] font-extrabold text-heading">
                  التكلفة الإجمالية
                </span>
                <span dir="ltr" className="text-base font-extrabold text-heading">
                  {fmt(totalCostLocal)}
                </span>
              </div>
            </div>
          </CardPad>
        </Card>

        <Card className="mb-0">
          <CardPad>
            <CardTitle>العمر والإهلاك</CardTitle>
            <div className="flex flex-col gap-2.5">
              {(
                [
                  ["العمر الفعلي (سنة)", actualAge, setActualAge, null, null],
                  ["العمر الاقتصادي (سنة)", economicAge, setEconomicAge, null, null],
                  [
                    "تمديد العمر (سنة)",
                    lifeExtension,
                    setLifeExtension,
                    lifeExtensionBasis,
                    setLifeExtensionBasis,
                  ],
                  [
                    "التقادم الوظيفي (٪)",
                    functionalObs,
                    setFunctionalObs,
                    functionalObsRationale,
                    setFunctionalObsRationale,
                  ],
                  [
                    "التقادم الخارجي (٪)",
                    externalObs,
                    setExternalObs,
                    externalObsRationale,
                    setExternalObsRationale,
                  ],
                ] as const
              ).map(([label, val, setVal, just, setJust]) => (
                <div
                  key={label}
                  className="flex items-center gap-2"
                >
                  <span className="w-32 shrink-0 text-[12.5px] text-text-2">
                    {label}
                  </span>
                  {setJust ? (
                    <input
                      placeholder={
                        label.startsWith("تمديد")
                          ? "أساس تمديد العمر…"
                          : "مبرر التقدير…"
                      }
                      value={just ?? ""}
                      onChange={(e) => setJust(e.target.value)}
                      className="flex-1 rounded-[7px] border border-dashed border-border bg-surface-2 px-[9px] py-1.5 text-[11.5px]"
                    />
                  ) : (
                    <span className="flex-1" />
                  )}
                  <input
                    dir="ltr"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    className="w-[78px] shrink-0 rounded-[7px] border border-border-md p-[7px] text-center font-bold"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[9px] border border-border bg-surface-2 px-3 py-[9px] text-[11.5px] text-text-2">
                  التقادم المادي{" "}
                  <b dir="ltr" className="text-heading">
                    {cost?.physicalObsolescencePct != null
                      ? `${cost.physicalObsolescencePct}٪`
                      : "—"}
                  </b>
                </div>
                <div className="rounded-[9px] border border-border bg-surface-2 px-3 py-[9px] text-[11.5px] text-text-2">
                  مجموع التقادم{" "}
                  <b
                    dir="ltr"
                    className={cn(
                      (cost?.totalObsolescencePct ?? 0) > 100
                        ? "text-red-text"
                        : "text-heading",
                    )}
                  >
                    {cost ? `${cost.totalObsolescencePct}٪` : "—"}
                  </b>
                </div>
                <div className="rounded-[9px] border border-border bg-surface-2 px-3 py-[9px] text-[11.5px] text-text-2">
                  قيمة الإهلاك{" "}
                  <b dir="ltr" className="text-red-text">
                    {fmt(cost?.depreciationValue)}
                  </b>
                </div>
                <div className="rounded-[9px] border border-border-md bg-gold-soft px-3 py-[9px] text-[11.5px] text-text-2">
                  المباني بعد الإهلاك{" "}
                  <b dir="ltr" className="text-heading">
                    {fmt(cost?.buildingsValueAfterDepreciation)}
                  </b>
                </div>
              </div>
            </div>
          </CardPad>
        </Card>
      </div>

      {/* Results and recommendations — interactive-form spec */}
      <h2 className="mb-3 mt-0 text-[17px] font-extrabold text-heading">
        النتائج والتوصيات
      </h2>
      <Card className="mb-6">
        <div className="flex items-stretch">
          <div className="flex-1 border-e border-border px-[22px] py-[18px]">
            <div className="mb-[9px] text-xs font-medium text-text-2">
              سعر متر المباني للعقار
            </div>
            <div dir="ltr" className="text-2xl font-extrabold leading-none text-heading">
              {buildAreaLocal > 0 ? fmt(totalCostLocal / buildAreaLocal) : "—"}
            </div>
            <div className="mt-[7px] text-[11.5px] text-text-3">
              قبل الإهلاك · التكلفة الإجمالية ÷{" "}
              <span dir="ltr">{fmt(buildAreaLocal, 1)}</span> م² مسطحات
            </div>
            <div className="mt-[5px] text-[11.5px] font-bold text-gold-d">
              بعد الإهلاك:{" "}
              <span dir="ltr">
                {buildAreaLocal > 0 ? fmt(netValueLocal / buildAreaLocal) : "—"}
              </span>{" "}
              ر.س / م²
            </div>
          </div>
          <div className="relative flex-[1.4] bg-surface-2 px-[22px] py-[18px]">
            <span className="absolute start-0 top-0 h-full w-[3px] bg-gold" />
            <div className="mb-[9px] text-xs font-bold text-heading">
              ناتج أسلوب التكلفة — المباني دون الأرض
            </div>
            <div dir="ltr" className="text-2xl font-extrabold leading-none text-heading">
              {fmt(netValueLocal)}
            </div>
            <div className="mt-[7px] text-[11.5px] text-text-3">
              التكلفة الإجمالية − الإهلاك · بلا تقريب
            </div>
            <div className="mt-[5px] text-[11.5px] font-bold text-gold-d">
              {buildingOnly
                ? "النطاق «مبنى فقط» — هذا هو مؤشر الأسلوب"
                : landComplete
                  ? `مع قيمة الأرض: ${fmt(costValueLocal)} ر.س — للاسترشاد`
                  : "مؤشر الأسلوب غير مكتمل — يلزم قيمة الأرض"}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardPad>
          <div className="mb-3 flex items-center justify-between gap-2.5">
            <span className="text-[14.5px] font-extrabold text-heading">
              تحليل التكلفة
            </span>
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "text-[11px] font-semibold",
                  costNarrativeDirty ? "text-red-text" : "text-gold-d",
                )}
              >
                {costNarrativeDirty
                  ? "نص محرَّر يدوياً — لا يتحدث تلقائياً"
                  : "يتحدث تلقائياً مع المبررات"}
              </span>
              {costNarrativeDirty ? (
                <GhostBtn
                  disabled={saving}
                  onClick={() => setCostAnalysisNotes("")}
                >
                  ↺ استرجاع النص التلقائي
                </GhostBtn>
              ) : null}
            </div>
          </div>
          <textarea
            rows={10}
            value={costNarrativeDirty ? costAnalysisNotes : costNarrativeAuto}
            onChange={(e) => setCostAnalysisNotes(e.target.value)}
            className="w-full resize-y rounded-[9px] border border-border bg-surface-2 px-4 py-3.5 text-[13px] font-medium leading-[2] text-text"
          />
        </CardPad>
      </Card>

      <Card className="mb-6">
        <div className="border-b border-border px-[22px] py-3 text-[13.5px] font-extrabold text-heading">
          تنبيهات أسلوب التكلفة
        </div>
        {costAlerts.map((a, i) => (
          <div
            key={i}
            role={a.kind === "error" ? "alert" : "status"}
            className="flex items-start gap-2.5 border-b border-border px-[22px] py-[11px]"
          >
            <span
              className={cn(
                "mt-[5px] size-[9px] shrink-0 rounded-full",
                a.kind === "error"
                  ? "bg-red"
                  : a.kind === "warn"
                    ? "bg-[#d9a441]"
                    : "bg-[#3f8f5f]",
              )}
            />
            <div>
              <div
                className={cn(
                  "text-[12.5px] font-bold",
                  a.kind === "error"
                    ? "text-red-text"
                    : a.kind === "warn"
                      ? "text-[#a07a24]"
                      : "text-[#3f8f5f]",
                )}
              >
                {a.title}
              </div>
              <div className="mt-0.5 text-[11.5px] text-text-2">
                {a.body}
              </div>
            </div>
          </div>
        ))}
      </Card>

      <PrimaryBtn disabled={saving} onClick={() => void saveCost()}>
        حفظ أسلوب التكلفة
      </PrimaryBtn>
    </>
  );
});

/** Cost basis/unit card on the cost screen — saves over the last saved settings.
 * Drafts are local; the shell remounts it (key) when saved values change. */
export const CostBasisUnitCard = memo(function CostBasisUnitCard({
  savedBasisKey,
  savedUnitKey,
  saving,
  onSave,
}: {
  savedBasisKey: string;
  savedUnitKey: string;
  saving: boolean;
  onSave: (basisKey: string, unitKey: string) => void;
}) {
  const [basis, setBasis] = useState(savedBasisKey);
  const [unit, setUnit] = useState(savedUnitKey);
  return (
    <Card>
      <CardPad>
        <CardTitle>طريقة التكلفة وأسلوب التقدير</CardTitle>
        <FieldLabel>أساس التكلفة</FieldLabel>
        <div className="my-2 mb-3.5 flex flex-wrap gap-2">
          <ToggleChip
            active={basis === "replacement"}
            disabled={saving}
            onClick={() => setBasis("replacement")}
          >
            الإحلال / الاستبدال
          </ToggleChip>
          <ToggleChip
            active={basis === "reproduction"}
            disabled={saving}
            onClick={() => setBasis("reproduction")}
          >
            إعادة الإنتاج
          </ToggleChip>
        </div>
        <FieldLabel>وحدة التقدير</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["comparison_unit", "وحدة المقارنة"],
              ["quantity_survey", "المسح الكمي"],
              ["lump_sum", "المبلغ المقطوع"],
              ["per_item", "كل بند على حدة"],
            ] as const
          ).map(([k, label]) => (
            <ToggleChip
              key={k}
              active={unit === k}
              disabled={saving}
              onClick={() => setUnit(k)}
            >
              {label}
            </ToggleChip>
          ))}
        </div>
        <div className="mt-3.5">
          <GhostBtn disabled={saving} onClick={() => onSave(basis, unit)}>
            حفظ أساس/وحدة التكلفة
          </GhostBtn>
        </div>
      </CardPad>
    </Card>
  );
});
