"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  activeValuationListOptions,
  getValuationLists,
  getValuationReportDocument,
  saveValuationReconciliation,
  type ValuationCostApproachDto,
  type ValuationIssuanceGatesDto,
  type ValuationReconciliationDto,
  type ValuationReconciliationMethodDto,
} from "@platform/api-client";
import { cn, useToast } from "@platform/ui-kit";
import {
  VALUE_BASIS_OPTIONS,
  basisOfValueKeyForAssignment,
} from "@platform/app-shared/prototype/assignment-valuation-defaults";
import { amountWordsOrZero } from "../../../lib/evaluator/value-estimation";
import {
  Card,
  CardPad,
  CardTitle,
  FieldLabel,
  GhostBtn,
  LedgerRow,
  PrimaryBtn,
  vwInputClassName,
  vwTdClassName,
  vwThClassName,
} from "./atoms";
import { apiConfig, fmt, JUSTIFICATION_MIN_LENGTH } from "./lib/shell-utils";

/**
 * شاشة رأي القيمة النهائي — تملك مسودات التوفيق (الأوزان، المبررات، أساس القيمة،
 * خصم التصفية، معالجات التنبيهات) محلياً: الكتابة هنا لا تعيد رسم صدفة التقييم.
 * تبقى مركّبة (مخفية) بعد أول زيارة حفاظاً على المسودات غير المحفوظة، وتترطب من
 * دفعة الخادم عبر hydrateKey (تحميل كامل)؛ التحديث الصامت يدمج قيم الأساليب فقط.
 */
export const FinalOpinionSection = memo(function FinalOpinionSection({
  valuationRequestId,
  recon,
  gates,
  cost,
  hydrateKey,
  buildingOnly,
  hasAdoptedMarket,
  assignmentType,
  officialValuationDate,
  saving,
  onSavingChange,
  onReconSaved,
}: {
  valuationRequestId: string | null;
  recon: ValuationReconciliationDto | null;
  gates: ValuationIssuanceGatesDto | null;
  cost: ValuationCostApproachDto | null;
  hydrateKey: number;
  buildingOnly: boolean;
  hasAdoptedMarket: boolean;
  assignmentType?: string;
  officialValuationDate: string | null;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onReconSaved: (dto: ValuationReconciliationDto) => void;
}) {
  const { showToast } = useToast();
  const [reconMethods, setReconMethods] = useState<ValuationReconciliationMethodDto[]>(
    [],
  );
  const [methodsRationale, setMethodsRationale] = useState("");
  const [finalRoundDecimals, setFinalRoundDecimals] = useState("0");
  const [basisOfValueKey, setBasisOfValueKey] = useState(() =>
    assignmentType?.trim()
      ? basisOfValueKeyForAssignment(assignmentType)
      : "market",
  );
  const [valuePremiseKey, setValuePremiseKey] = useState("");
  const [basisOptions, setBasisOptions] = useState(VALUE_BASIS_OPTIONS);
  const [premiseOptions, setPremiseOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [liquidationDiscountPct, setLiquidationDiscountPct] = useState("0");
  const [liquidationDiscountRationale, setLiquidationDiscountRationale] =
    useState("");
  const [alertOverrides, setAlertOverrides] = useState<
    Record<string, { overrideRationale: string; acknowledged: boolean }>
  >({});

  useEffect(() => {
    const config = apiConfig();
    if (!config) return;
    void getValuationLists(config).then((res) => {
      if (!res.ok) return;
      const bases = activeValuationListOptions(res.data.lists, "valueBases");
      const premises = activeValuationListOptions(res.data.lists, "premises");
      if (bases.length) setBasisOptions(bases);
      if (premises.length) setPremiseOptions(premises);
    });
  }, []);

  // أساس القيمة دائماً من أمر العمل (PO) — لا نفرض تصفية عند غياب النوع.
  useEffect(() => {
    if (!assignmentType?.trim()) return;
    const next = basisOfValueKeyForAssignment(assignmentType);
    setBasisOfValueKey(next);
    if (next === "liquidation") {
      setValuePremiseKey((prev) =>
        prev === "orderly" || prev === "forced" ? prev : "orderly",
      );
    } else {
      setLiquidationDiscountPct("0");
      setValuePremiseKey((prev) =>
        prev === "orderly" || prev === "forced" ? "current" : prev,
      );
    }
  }, [assignmentType]);

  // الترطيب: مفتاح جديد = تحميل كامل (بذر شامل)؛ نفس المفتاح مع دفعة جديدة = تحديث
  // صامت يدمج قيم الأساليب المحسوبة ويبقي أوزان/مبررات المستخدم كما هي.
  const hydratedKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (hydratedKeyRef.current === hydrateKey) {
      if (recon) {
        const serverMethods = recon.methods;
        setReconMethods((prev) =>
          serverMethods.map((m) => {
            const mine = prev.find((p) => p.approachKind === m.approachKind);
            return mine
              ? {
                  ...m,
                  weightPct: mine.weightPct,
                  rationale: mine.rationale,
                  isIncluded: mine.isIncluded,
                }
              : m;
          }),
        );
      }
      return;
    }
    hydratedKeyRef.current = hydrateKey;
    if (!recon) {
      setReconMethods([]);
      setMethodsRationale("");
      setFinalRoundDecimals("0");
      if (assignmentType?.trim()) {
        setBasisOfValueKey(basisOfValueKeyForAssignment(assignmentType));
        setValuePremiseKey(
          basisOfValueKeyForAssignment(assignmentType) === "liquidation"
            ? "orderly"
            : "",
        );
      }
      setLiquidationDiscountPct("0");
      setLiquidationDiscountRationale("");
      setAlertOverrides({});
      return;
    }
    setReconMethods(recon.methods);
    setMethodsRationale(recon.methodsRationale ?? "");
    setFinalRoundDecimals(String(recon.finalRoundDecimals ?? 0));
    // أساس القيمة من أمر العمل (PO) فقط — لا يُستبدل بما حُفظ سابقاً في التسوية.
    if (assignmentType?.trim()) {
      const nextBasis = basisOfValueKeyForAssignment(assignmentType);
      setBasisOfValueKey(nextBasis);
      let nextPremise = recon.valuePremiseKey || "";
      if (nextBasis === "liquidation") {
        if (nextPremise !== "orderly" && nextPremise !== "forced") {
          nextPremise = "orderly";
        }
      }
      setValuePremiseKey(nextPremise);
    } else {
      setValuePremiseKey(recon.valuePremiseKey || "");
    }
    setLiquidationDiscountPct(String(recon.liquidationDiscountPct ?? 0));
    setLiquidationDiscountRationale(recon.liquidationDiscountRationale ?? "");
    const ovMap: Record<
      string,
      { overrideRationale: string; acknowledged: boolean }
    > = {};
    for (const o of recon.methodologyAlertOverrides ?? []) {
      ovMap[o.code] = {
        overrideRationale: o.overrideRationale ?? "",
        acknowledged: o.acknowledged ?? false,
      };
    }
    setAlertOverrides(ovMap);
  }, [hydrateKey, recon, assignmentType]);

  /* ─── حساب رأي القيمة الحي (مواصفة النموذج التفاعلي) ─── */
  const finalComputed = useMemo(() => {
    const weightSumLocal = reconMethods.reduce((s, m) => s + (m.weightPct || 0), 0);
    const reconWeightsBad =
      reconMethods.length >= 2 && Math.round(weightSumLocal) !== 100;
    // مواصفة النموذج التفاعلي: القيم كما هي (قد تكون جزئية أو سالبة) — الاعتماد هو الحاجز.
    const weightedLocal =
      reconMethods.length === 0
        ? 0
        : reconMethods.length === 1
          ? reconMethods[0].approachValue
          : reconMethods.reduce(
              (s, m) => s + m.approachValue * ((m.weightPct || 0) / 100),
              0,
            );

    // اكتمال المؤشرات كما في النموذج: السوق = مقارن معتمد؛ التكلفة = بنود + عمر ممتد (+ أرض ما لم يكن «مبنى فقط»).
    const costBuildReady =
      (cost?.lines?.length ?? 0) > 0 &&
      (cost?.directCostTotal ?? 0) > 0 &&
      (cost?.extendedLifeYears ?? 0) > 0;
    const costComplete = buildingOnly
      ? costBuildReady
      : costBuildReady && !!cost?.landEstimateComplete;
    const methodComplete = (kind: string) =>
      kind === "cost" ? costComplete : hasAdoptedMarket;
    const isLiquidation = basisOfValueKey === "liquidation";
    const discountPctNum = isLiquidation
      ? Number(liquidationDiscountPct.replace(",", ".")) || 0
      : 0;
    const forcedCut = (weightedLocal * discountPctNum) / 100;
    const decNum = Math.min(
      Math.max(Number.parseInt(finalRoundDecimals, 10) || 0, 0),
      6,
    );
    const roundPow = 10 ** decNum;
    const finalLocal =
      Math.round((weightedLocal - forcedCut) / roundPow) * roundPow;
    const roundNote =
      decNum === 0
        ? "بلا تقريب — أقرب ريال"
        : `مقرَّبة لأقرب ${fmt(roundPow)} ريال`;
    const soleCost =
      reconMethods.length === 1 && reconMethods[0]?.approachKind === "cost";

    // buildOpinion — النص الآلي للرأي النهائي.
    const basisLabel =
      basisOptions.find((o) => o.value === basisOfValueKey)?.label ??
      basisOfValueKey;
    const linesOut: string[] = [];
    if (!reconMethods.length) {
      linesOut.push("لم يُختَر أي أسلوب تقييم بعد.");
    } else if (reconMethods.length === 1) {
      if (soleCost && !buildingOnly) {
        linesOut.push(
          "اعتُمد أسلوب التكلفة. قُدّرت قيمة الأرض بطريقة المقارنات باعتبارها فضاء، وقُدّرت قيمة التحسينات بطريقة المقاول على أساس تكلفة الإحلال ناقصاً الإهلاك، والقيمة النهائية هي حاصل جمعهما. ولم يجرِ توفيق بين مؤشرات القيمة لاعتماد أسلوب واحد.",
        );
      } else if (soleCost) {
        linesOut.push(
          "اعتُمد أسلوب التكلفة بنطاق «مبنى فقط»؛ القيمة = تكلفة الإحلال ناقصاً الإهلاك. ولم يجرِ توفيق بين مؤشرات القيمة لاعتماد أسلوب واحد.",
        );
      } else {
        linesOut.push(
          "اعتُمد أسلوب السوق وحده، وقُدّرت القيمة بطريقة المقارنات. ولم يجرِ توفيق بين مؤشرات القيمة لاعتماد أسلوب واحد.",
        );
      }
      linesOut.push(
        `مؤشر ${reconMethods[0].labelAr}: ${fmt(reconMethods[0].approachValue)} ر.س بوزن ١٠٠٪.`,
      );
    } else {
      for (const m of reconMethods) {
        linesOut.push(
          `مؤشر ${m.labelAr}: ${fmt(m.approachValue)} ر.س بوزن ${m.weightPct}٪.`,
        );
        if ((m.rationale ?? "").trim())
          linesOut.push(`مبرر وزن ${m.labelAr}: ${m.rationale.trim()}.`);
      }
    }
    if (discountPctNum > 0)
      linesOut.push(`طُبِّق خصم بيع قسري ${discountPctNum}٪.`);
    linesOut.push(`أساس القيمة المستخدم: ${basisLabel}.`);
    linesOut.push(`الرأي النهائي في قيمة العقار: ${fmt(finalLocal)} ر.س.`);

    return {
      weightSumLocal,
      reconWeightsBad,
      weightedLocal,
      isLiquidation,
      discountPctNum,
      forcedCut,
      finalLocal,
      roundNote,
      soleCost,
      methodComplete,
      opinionAuto: linesOut.join("\n"),
    };
  }, [
    buildingOnly,
    reconMethods,
    basisOfValueKey,
    liquidationDiscountPct,
    finalRoundDecimals,
    basisOptions,
    cost,
    hasAdoptedMarket,
  ]);

  async function saveReconciliation() {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    onSavingChange(true);
    const res = await saveValuationReconciliation(config, valuationRequestId, {
      // النص الآلي يُثبَّت عند الحفظ ما لم يحرره المقيّم (نموذج «آلي حتى يُحرَّر»).
      methodsRationale: methodsRationale.trim() || finalComputed.opinionAuto,
      finalRoundDecimals: Number.parseInt(finalRoundDecimals, 10) || 0,
      basisOfValueKey,
      valuePremiseKey: valuePremiseKey || null,
      liquidationDiscountPct:
        Number(liquidationDiscountPct.replace(",", ".")) || 0,
      liquidationDiscountRationale: liquidationDiscountRationale || null,
      methodologyAlertOverrides: Object.entries(alertOverrides).map(
        ([code, v]) => ({
          code,
          overrideRationale: v.overrideRationale || null,
          acknowledged: v.acknowledged,
        }),
      ),
      methods: reconMethods.map((m, i) => ({
        id: m.id,
        approachKind: m.approachKind,
        weightPct: m.weightPct,
        rationale: m.rationale,
        isIncluded: m.isIncluded,
        sortOrder: i,
      })),
    });
    onSavingChange(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ الترجيح", "error");
      return;
    }
    setReconMethods(res.data.methods);
    setMethodsRationale(res.data.methodsRationale ?? "");
    setFinalRoundDecimals(String(res.data.finalRoundDecimals ?? 0));
    if (assignmentType?.trim()) {
      setBasisOfValueKey(basisOfValueKeyForAssignment(assignmentType));
    }
    setValuePremiseKey(res.data.valuePremiseKey || "");
    setLiquidationDiscountPct(String(res.data.liquidationDiscountPct ?? 0));
    setLiquidationDiscountRationale(res.data.liquidationDiscountRationale ?? "");
    showToast(
      res.data.liquidationDiscountApplied
        ? "تم حفظ رأي القيمة مع خصم التصفية"
        : "تم حفظ رأي القيمة النهائي",
      "success",
    );
    // تحديث بوابات الإصدار والتنبيهات بعد الحفظ (المعالجات تدخل في التقييم فوراً).
    onReconSaved(res.data);
  }

  async function openReportPreview() {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    onSavingChange(true);
    const res = await getValuationReportDocument(config, valuationRequestId);
    onSavingChange(false);
    if (!res.ok) {
      showToast("تعذّر تحميل استعراض تقرير التقييم", "error");
      return;
    }
    try {
      // تحميل شرطي — بنّاء المعاينة يُجلب عند أول نقرة لا مع حزمة الشاشة.
      const { openValuationReportPreview } = await import(
        "../../../lib/evaluator/valuation-report-preview"
      );
      await openValuationReportPreview(res.data);
    } catch {
      showToast("تعذّر فتح استعراض تقرير التقييم", "error");
    }
  }

  const sole = recon && !recon.meetsMultiMethodGate;
  const {
    weightSumLocal,
    reconWeightsBad,
    weightedLocal,
    isLiquidation,
    forcedCut,
    finalLocal,
    roundNote,
    soleCost,
    methodComplete,
    opinionAuto,
  } = finalComputed;
  // محرَّر يدوياً فقط عندما يختلف عن النص الآلي (الحفظ يثبّت الآلي دون اعتباره تحريراً).
  const opinionDirty =
    methodsRationale.trim().length > 0 &&
    methodsRationale.trim() !== opinionAuto.trim();

  return (
    <>
      {!sole ? (
        <>
          <div className="mb-3 flex justify-between">
            <h2 className="m-0 text-[17px] font-extrabold text-heading">
              التوفيق بين مؤشرات الأساليب
            </h2>
            <span className="text-xs text-text-3">
              مجموع نسب المشاركة يجب أن يساوي ١٠٠٪
            </span>
          </div>
          <Card className="mb-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr>
                    <th className={cn(vwThClassName, "text-start")}>الأسلوب</th>
                    <th className={vwThClassName}>القيمة الناتجة</th>
                    <th className={vwThClassName}>نسبة المشاركة (٪)</th>
                    <th className={vwThClassName}>القيمة بعد المشاركة</th>
                    <th className={cn(vwThClassName, "text-start")}>مبرر</th>
                  </tr>
                </thead>
                <tbody>
                  {reconMethods.map((m, idx) => {
                    const incomplete = !methodComplete(m.approachKind);
                    return (
                    <tr key={m.approachKind}>
                      <td className={cn(vwTdClassName, "text-start")}>
                        <div className="font-bold text-heading">{m.labelAr}</div>
                        <div className="mt-0.5 text-[10.5px] text-text-3">
                          {m.approachKind === "cost"
                            ? buildingOnly
                              ? "مبنى فقط — تكلفة الإحلال ناقصاً الإهلاك"
                              : "قيمة الأرض + تكلفة الإحلال − الإهلاك"
                            : "مؤشر قيمة من طريقة المقارنة"}
                        </div>
                      </td>
                      <td className={cn(vwTdClassName, "font-extrabold")}>
                        {incomplete ? (
                          <span className="text-[12.5px] text-red-text">
                            غير مكتمل
                          </span>
                        ) : (
                          <span dir="ltr">{fmt(m.approachValue)}</span>
                        )}
                      </td>
                      <td className={vwTdClassName}>
                        <input
                          dir="ltr"
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={m.weightPct}
                          onChange={(e) => {
                            const next = [...reconMethods];
                            next[idx] = {
                              ...m,
                              weightPct:
                                Number(e.target.value.replace(",", ".")) || 0,
                              isIncluded: true,
                            };
                            setReconMethods(next);
                          }}
                          className={cn(
                            "w-[82px] rounded-[7px] border p-2 text-center font-bold",
                            reconWeightsBad
                              ? "border-red bg-[rgba(192,85,61,.07)] text-red-text"
                              : "border-border-md bg-surface text-heading",
                          )}
                        />
                      </td>
                      <td className={cn(vwTdClassName, "font-extrabold")}>
                        {incomplete ? (
                          <span className="text-text-3">—</span>
                        ) : (
                          <span dir="ltr">
                            {fmt((m.approachValue * m.weightPct) / 100)}
                          </span>
                        )}
                      </td>
                      <td className={cn(vwTdClassName, "text-start")}>
                        <input
                          value={m.rationale ?? ""}
                          onChange={(e) => {
                            const next = [...reconMethods];
                            next[idx] = { ...m, rationale: e.target.value };
                            setReconMethods(next);
                          }}
                          placeholder="مبرر نسبة المشاركة…"
                          className="w-full rounded-[7px] border border-border px-2.5 py-2 text-xs"
                        />
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between border-t border-border bg-surface-2 px-4 py-3">
              <span
                className={cn(
                  "text-[12.5px] font-bold",
                  reconWeightsBad ? "text-red-text" : "text-[#3f8f5f]",
                )}
              >
                مجموع نسب المشاركة: {weightSumLocal}٪
                {reconWeightsBad ? " — يجب أن يساوي ١٠٠٪" : ""}
              </span>
              <span
                className={cn(
                  "text-[13px] font-bold",
                  reconWeightsBad ? "text-red-text" : "text-heading",
                )}
              >
                القيمة المرجّحة:{" "}
                <span dir="ltr">{fmt(weightedLocal)}</span> ريال
              </span>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <CardPad>
            <p className="mb-3 text-[12.5px] text-text-2">
              أسلوب واحد مفعّل — لا توفيق بين مؤشرات (n = 1). القيمة النهائية = مؤشر
              الأسلوب الوحيد بوزن ١٠٠٪.
            </p>
            {reconMethods.map((m) => (
              <div
                key={m.approachKind}
                className="mb-2 rounded-[10px] border border-border-md bg-gold-soft px-3.5 py-3"
              >
                <div className="font-bold text-heading">{m.labelAr}</div>
                <div className="mt-1 text-xs text-text-2">
                  <span dir="ltr">{fmt(m.approachValue)}</span> ر.س · وزن ١٠٠٪
                </div>
              </div>
            ))}
          </CardPad>
        </Card>
      )}

      <Card>
        <CardPad>
          <div className="relative ps-3">
            <span className="absolute start-0 top-0 h-full w-[3px] rounded-full bg-gold" />
            <div className="mb-3.5 flex flex-wrap justify-between gap-2">
              <div className="text-sm font-extrabold text-heading">
                الرأي النهائي للقيمة
              </div>
              <div className="text-[11.5px] text-text-3">
                {officialValuationDate
                  ? `قيمة العقار محل التقييم في تاريخ ${officialValuationDate}`
                  : "قيمة العقار محل التقييم — يُثبَّت التاريخ عند اعتماد التقييم"}
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3">
              <label className="flex flex-col gap-1.5">
                <FieldLabel>فرضية القيمة</FieldLabel>
                <select
                  value={valuePremiseKey}
                  onChange={(e) => setValuePremiseKey(e.target.value)}
                  className={cn(vwInputClassName, "cursor-pointer font-medium")}
                >
                  <option value="">— اختر —</option>
                  {(premiseOptions.length
                    ? premiseOptions.filter((o) =>
                        basisOfValueKey === "liquidation"
                          ? o.value === "orderly" || o.value === "forced"
                          : o.value === "hau" || o.value === "current",
                      )
                    : basisOfValueKey === "liquidation"
                      ? [
                          { value: "orderly", label: "التصفية المنظمة" },
                          { value: "forced", label: "البيع القسري" },
                        ]
                      : [
                          { value: "hau", label: "أعلى وأفضل استخدام" },
                          { value: "current", label: "الاستخدام الحالي" },
                        ]
                  ).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* دفتر القيمة — مواصفة النموذج التفاعلي (invoiceRows) */}
            <div className="mb-4 overflow-hidden rounded-[10px] border border-border">
              {soleCost && !buildingOnly ? (
                <>
                  <LedgerRow
                    label="قيمة الأرض"
                    note={
                      cost?.landEstimateComplete
                        ? `${fmt(cost?.landUnitRateAfterDiscount)} ر.س/م² × ${fmt(
                            cost?.apartmentLandShareSqm || cost?.landAreaSqm,
                          )} م²`
                        : "بانتظار المقارنات"
                    }
                    value={
                      cost?.landEstimateComplete
                        ? fmt(cost?.landValueFromMarket)
                        : "—"
                    }
                  />
                  <LedgerRow
                    label="+ قيمة المباني بعد الإهلاك"
                    note="تكلفة الإحلال − الإهلاك"
                    value={fmt(cost?.buildingsValueAfterDepreciation)}
                  />
                </>
              ) : null}
              {reconMethods.map((m) => {
                const done = methodComplete(m.approachKind);
                return (
                  <LedgerRow
                    key={m.approachKind}
                    label={`${soleCost && !buildingOnly ? "= " : ""}مؤشر ${m.labelAr}`}
                    note={
                      reconMethods.length === 1
                        ? "وزنه ١٠٠٪"
                        : `وزنه ${m.weightPct}٪`
                    }
                    value={done ? fmt(m.approachValue) : "غير مكتمل"}
                    valueClassName={done ? undefined : "text-red-text"}
                  />
                );
              })}
              {reconMethods.length >= 2 ? (
                <LedgerRow
                  label="القيمة المرجّحة"
                  note="مجموع المؤشرات بأوزانها"
                  value={fmt(weightedLocal)}
                  strong
                />
              ) : null}
              {isLiquidation ? (
                <div className="flex items-center gap-2.5 border-b border-border bg-[var(--red-light)] px-4 py-[11px]">
                  <div className="flex-1">
                    <div className="text-[12.5px] font-bold text-red-text">
                      − خصم البيع القسري
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-text-3">
                      ٪ من القيمة قبل الخصم
                    </div>
                  </div>
                  <input
                    value={liquidationDiscountRationale}
                    placeholder="مبرر معامل التصفية…"
                    onChange={(e) =>
                      setLiquidationDiscountRationale(e.target.value)
                    }
                    className="flex-[1.2] rounded-[7px] border border-dashed border-border bg-surface px-[9px] py-1.5 text-[11.5px]"
                  />
                  <input
                    dir="ltr"
                    type="number"
                    min={0}
                    max={90}
                    step={5}
                    value={liquidationDiscountPct}
                    onChange={(e) => setLiquidationDiscountPct(e.target.value)}
                    className="w-[66px] rounded-[7px] border border-border-md p-[7px] text-center font-bold"
                  />
                  <span
                    dir="ltr"
                    className="w-[110px] text-end text-[13.5px] font-extrabold text-red-text"
                  >
                    −{fmt(forcedCut)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-[11px]">
                <div className="flex-1">
                  <div className="text-[12.5px] font-bold text-heading">
                    تقريب القيمة
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-text-3">
                    {roundNote}
                  </div>
                </div>
                <input
                  dir="ltr"
                  type="number"
                  min={0}
                  max={6}
                  step={1}
                  value={finalRoundDecimals}
                  onChange={(e) => setFinalRoundDecimals(e.target.value)}
                  className="w-[66px] rounded-[7px] border border-border-md p-[7px] text-center font-bold"
                />
              </div>
              <div className="flex items-baseline justify-between gap-2.5 bg-gold-soft px-4 py-3.5">
                <div className="text-sm font-extrabold text-heading">
                  = القيمة النهائية
                </div>
                <div className="text-end">
                  <div
                    dir="ltr"
                    className="text-[32px] font-extrabold tracking-[-0.02em] text-heading"
                  >
                    {fmt(finalLocal)}
                  </div>
                  <div className="mt-[3px] text-[11.5px] text-text-3">
                    ريال سعودي · كتابةً: {amountWordsOrZero(finalLocal)}
                  </div>
                </div>
              </div>
            </div>

            {/* نص الرأي النهائي — آلي حتى يُحرَّر */}
            <div className="mb-2 flex items-center justify-between gap-2.5">
              <span className="text-[12.5px] font-bold text-heading">
                نص الرأي النهائي (مبرر استخدام الطرق)
              </span>
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    opinionDirty ? "text-red-text" : "text-gold-d",
                  )}
                >
                  {opinionDirty
                    ? "نص محرَّر يدوياً — لا يتحدث تلقائياً"
                    : "يتحدث تلقائياً مع المدخلات"}
                </span>
                {opinionDirty ? (
                  <GhostBtn disabled={saving} onClick={() => setMethodsRationale("")}>
                    ↺ استرجاع النص التلقائي
                  </GhostBtn>
                ) : null}
              </div>
            </div>
            <textarea
              rows={6}
              value={opinionDirty ? methodsRationale : opinionAuto}
              onChange={(e) => setMethodsRationale(e.target.value)}
              className="w-full resize-y rounded-[9px] border border-border bg-surface-2 px-3.5 py-3 text-[12.5px] font-medium leading-[1.9] text-text"
            />
          </div>

          <div className="mt-[18px] flex flex-wrap gap-2.5">
            <PrimaryBtn
              disabled={saving || reconMethods.length === 0}
              onClick={() => void saveReconciliation()}
            >
              {sole ? "حفظ الرأي النهائي" : "حفظ التوفيق والرأي النهائي"}
            </PrimaryBtn>
            <GhostBtn disabled={saving} onClick={() => void openReportPreview()}>
              معاينة التقرير
            </GhostBtn>
          </div>
        </CardPad>
      </Card>

      {gates ? (
        <Card>
          <CardPad>
            <CardTitle>اعتماد التقييم — شروط الإصدار</CardTitle>
            <p className="mb-2.5 text-[11.5px] text-text-3">
              المنع يقع عند الاعتماد فقط — الإدخال الجزئي محفوظ كمسوّدة.
            </p>
            <p className="mb-2.5 text-[13px] text-text">
              الحالة:{" "}
              <strong
                className={cn(
                  gates.allowsIssuance ? "text-[#2f7a4d]" : "text-red-text",
                )}
              >
                {gates.allowsIssuance
                  ? "كل شروط الاعتماد مستوفاة ✓"
                  : "الاعتماد ممنوع ✗"}
              </strong>
            </p>
            <ul className="m-0 list-none p-0">
              {gates.gates.map((g) => (
                <li
                  key={g.code}
                  className={cn(
                    "mb-1.5 flex gap-2 text-[12.5px]",
                    g.passed ? "text-text" : "text-red-text",
                  )}
                >
                  <span>{g.passed ? "✓" : "✗"}</span>
                  <span>{g.labelAr}</span>
                  {g.detailAr ? (
                    <span className="text-text-3">— {g.detailAr}</span>
                  ) : null}
                </li>
              ))}
            </ul>

            {/* التنبيهات المنهجية (21) — المعالجة بمبرر نصي أو إقرار حسب فئة التنبيه */}
            <div className="mt-4 border-t border-border pt-3.5">
              <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2.5">
                <span className="text-[13.5px] font-extrabold text-heading">
                  التنبيهات المنهجية
                </span>
                <span className="text-[11px] text-text-3">
                  {gates.methodologyAlertsNoteAr} · تُحفَظ المعالجات مع «حفظ
                  التوفيق والرأي النهائي»
                </span>
              </div>
              {gates.methodologyAlerts.filter((a) => a.triggered).length === 0 ? (
                <div className="text-[12.5px] font-bold text-[#2f7a4d]">
                  ✓ لا تنبيهات منهجية مفعّلة
                </div>
              ) : (
                gates.methodologyAlerts
                  .filter((a) => a.triggered)
                  .map((a) => {
                    const ov = alertOverrides[a.code] ?? {
                      overrideRationale: "",
                      acknowledged: false,
                    };
                    const needsRationale = a.severityKind === "require_rationale";
                    const needsAck = a.severityKind === "require_ack";
                    return (
                      <div
                        key={a.code}
                        className={cn(
                          "mb-2 flex flex-col gap-1.5 rounded-[9px] border px-3 py-2.5",
                          a.blocksIssuance
                            ? "border-red bg-[var(--red-light)]"
                            : "border-border bg-surface-2",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "size-[9px] shrink-0 rounded-full",
                              a.isHard
                                ? "bg-red"
                                : a.blocksIssuance
                                  ? "bg-[#d9a441]"
                                  : "bg-[#3f8f5f]",
                            )}
                          />
                          <span className="text-[12.5px] font-bold text-heading">
                            {a.number}. {a.labelAr}
                          </span>
                          <span
                            className={cn(
                              "rounded-full border border-border bg-surface px-2 py-0.5 text-[10.5px] font-bold",
                              a.isHard ? "text-red-text" : "text-gold-d",
                            )}
                          >
                            {a.isHard
                              ? "حاجب"
                              : needsRationale
                                ? "يتطلب مبرراً نصياً"
                                : "يتطلب إقراراً"}
                          </span>
                          {a.detailAr ? (
                            <span className="text-[11.5px] text-text-2">
                              {a.detailAr}
                            </span>
                          ) : null}
                        </div>
                        {needsRationale ? (
                          <>
                            <input
                              value={ov.overrideRationale}
                              placeholder={`المبرر النصي لتجاوز التنبيه (${JUSTIFICATION_MIN_LENGTH} أحرف فأكثر)…`}
                              onChange={(e) =>
                                setAlertOverrides((prev) => ({
                                  ...prev,
                                  [a.code]: {
                                    overrideRationale: e.target.value,
                                    acknowledged: prev[a.code]?.acknowledged ?? false,
                                  },
                                }))
                              }
                              className={cn(
                                "rounded-[7px] border border-dashed bg-surface px-2.5 py-[7px] text-xs",
                                ov.overrideRationale.trim().length > 0 &&
                                  ov.overrideRationale.trim().length <
                                    JUSTIFICATION_MIN_LENGTH
                                  ? "border-danger"
                                  : "border-border-md",
                              )}
                            />
                            {ov.overrideRationale.trim().length > 0 &&
                            ov.overrideRationale.trim().length <
                              JUSTIFICATION_MIN_LENGTH ? (
                              <span className="text-[10.5px] font-semibold text-danger">
                                المبرر الصوري لا يفك التنبيه — الحد الأدنى{" "}
                                {JUSTIFICATION_MIN_LENGTH} أحرف (ق-8)
                              </span>
                            ) : null}
                          </>
                        ) : null}
                        {needsAck ? (
                          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-text">
                            <input
                              type="checkbox"
                              checked={ov.acknowledged}
                              onChange={(e) =>
                                setAlertOverrides((prev) => ({
                                  ...prev,
                                  [a.code]: {
                                    overrideRationale:
                                      prev[a.code]?.overrideRationale ?? "",
                                    acknowledged: e.target.checked,
                                  },
                                }))
                              }
                              className="size-[15px]"
                            />
                            أقرّ بالاطلاع على هذا التنبيه والوعي بأثره
                          </label>
                        ) : null}
                        {a.isHard ? (
                          <span className="text-[11px] text-red-text">
                            تنبيه حاجب — يُعالَج بتصحيح المدخلات نفسها لا
                            بالتجاوز.
                          </span>
                        ) : null}
                      </div>
                    );
                  })
              )}
            </div>
          </CardPad>
        </Card>
      ) : null}
    </>
  );
});
