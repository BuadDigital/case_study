"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useValuationListsQuery } from "@platform/app-shared/query/valuation-lists-query";
import { fileToBase64 } from "@platform/app-shared/media/file-encoding";
import {
  activeValuationListOptions,
  getValuationReportDocument,
  saveValuationReconciliation,
  getReportIssuanceState,
  issueDepositVersion,
  registerDepositCertificate,
  reopenReportIssuance,
  getIssuancePdf,
  type ValuationCostApproachDto,
  type ValuationIssuanceGatesDto,
  type ValuationReconciliationDto,
  type ValuationReconciliationMethodDto,
  type ValuationReportIssuanceStateDto,
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
  // اشتقاق صرف من نوع الإسناد — لا يضبطه المستخدم ولا يُستبدل بالمحفوظ
  // (rerender-derived-state-no-effect؛ كان state تكتبه خمسة مواضع بنفس القيمة).
  const basisOfValueKey = useMemo(
    () =>
      assignmentType?.trim()
        ? basisOfValueKeyForAssignment(assignmentType)
        : "market",
    [assignmentType],
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

  /* ─── ق-6: الإصدار ثنائي المرحلة + شهادة الإيداع ─── */
  const [issuance, setIssuance] = useState<ValuationReportIssuanceStateDto | null>(null);
  const [issuanceBusy, setIssuanceBusy] = useState(false);
  const [depositCodeDraft, setDepositCodeDraft] = useState("");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  // تكميلية ق-9 (ر2): سبب إعادة فتح دور التقييم بعد الإيداع.
  const [reopenReason, setReopenReason] = useState("");

  const refreshIssuance = async () => {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    const res = await getReportIssuanceState(config, valuationRequestId);
    if (res.ok) {
      setIssuance(res.data);
      if (res.data.depositCode) setDepositCodeDraft(res.data.depositCode);
    }
  };

  useEffect(() => {
    void refreshIssuance();
    // الحالة تُنعَّش أيضاً بعد حفظ الترجيح (تغيّر الحواجب).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuationRequestId, gates?.allowsIssuance]);

  const issueDeposit = async () => {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    setIssuanceBusy(true);
    const res = await issueDepositVersion(config, valuationRequestId);
    setIssuanceBusy(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر إصدار نسخة الإيداع", "error");
      return;
    }
    setIssuance(res.data);
    showToast("صدرت نسخة الإيداع — التقرير مجمّد (ق-6)", "success");
  };

  const registerCertificate = async () => {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    const code = depositCodeDraft.trim();
    if (!code) {
      showToast("أدخل رمز الإيداع من شهادة منصة قيمة", "error");
      return;
    }
    setIssuanceBusy(true);
    let certificateContentBase64: string | null = null;
    if (certificateFile) {
      // ترميز مُقسّم عبر المساعد المشترك — الحلقة حرفاً حرفاً كانت تجمّد
      // التبويب ثواني على صور الشهادات الكبيرة (js-perf).
      certificateContentBase64 = await fileToBase64(certificateFile);
    }
    const res = await registerDepositCertificate(config, valuationRequestId, {
      depositCode: code,
      certificateFileName: certificateFile?.name ?? null,
      certificateContentType: certificateFile?.type ?? null,
      certificateContentBase64,
    });
    setIssuanceBusy(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر تسجيل الشهادة", "error");
      return;
    }
    setIssuance(res.data);
    showToast("سُجِّلت الشهادة وصدرت النسخة النهائية (ق-6)", "success");
  };

  // ر2: النسخة المودعة لا تُعدَّل — تُعلَّم «ملغاة — حلّت محلها نسخة أحدث» وتبقى
  // بالملف، ويُفتح دور تقييم جديد ينتهي بنسخة إيداع N+1 (موافقة مشرف القسم شرط الخادم).
  const reopenIssuance = async () => {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    const reason = reopenReason.trim();
    if (reason.length < JUSTIFICATION_MIN_LENGTH) {
      showToast(
        `سبب إعادة الفتح لا يقل عن ${JUSTIFICATION_MIN_LENGTH} أحرف (ق-8)`,
        "error",
      );
      return;
    }
    setIssuanceBusy(true);
    const res = await reopenReportIssuance(config, valuationRequestId, reason);
    setIssuanceBusy(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر إعادة فتح دور التقييم", "error");
      return;
    }
    setIssuance(res.data);
    setReopenReason("");
    setDepositCodeDraft("");
    setCertificateFile(null);
    showToast("أُعيد فتح دور التقييم — النسخة السابقة ملغاة وتبقى بالملف (ر2)", "success");
  };

  const downloadIssuancePdf = async (kind: "deposit" | "final") => {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    const res = await getIssuancePdf(config, valuationRequestId, kind);
    if (!res.ok) {
      showToast("تعذّر تنزيل النسخة", "error");
      return;
    }
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      kind === "deposit" ? "نسخة-الإيداع.pdf" : "النسخة-النهائية.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  // قوائم التقييم من الاستعلام المشترك — كان GET مكرراً مع تبويب المراجعة النهائية.
  const { data: valuationLists } = useValuationListsQuery();
  useEffect(() => {
    if (!valuationLists) return;
    const bases = activeValuationListOptions(valuationLists.lists, "valueBases");
    const premises = activeValuationListOptions(valuationLists.lists, "premises");
    if (bases.length) setBasisOptions(bases);
    if (premises.length) setPremiseOptions(premises);
  }, [valuationLists]);

  // أساس القيمة دائماً من أمر العمل (PO) — لا نفرض تصفية عند غياب النوع.
  useEffect(() => {
    if (!assignmentType?.trim()) return;
    const next = basisOfValueKeyForAssignment(assignmentType);
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

  // مسار واحد بدل filter مرتين في نفس التصيير (js-combine-iterations).
  const triggeredAlerts = gates
    ? gates.methodologyAlerts.filter((a) => a.triggered)
    : [];

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
              {triggeredAlerts.length === 0 ? (
                <div className="text-[12.5px] font-bold text-[#2f7a4d]">
                  ✓ لا تنبيهات منهجية مفعّلة
                </div>
              ) : (
                triggeredAlerts
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

      {/* ق-6: الإصدار ثنائي المرحلة + شهادة الإيداع */}
      {issuance ? (
        <Card>
          <CardPad>
            <CardTitle>الإصدار ثنائي المرحلة — شهادة الإيداع (ق-6)</CardTitle>
            <p className="mb-2.5 text-[11.5px] text-text-3">
              نسخة الإيداع تُجمِّد التقرير كاملاً وتُرفع يدوياً في منصة قيمة؛ ثم تُسجَّل
              شهادة الإيداع ورمزها فتصدر النسخة النهائية (صفحة الشهادة مرفقة والرمز في
              الميتا). الرمز والشهادة وحدهما خارج نطاق التجميد.
            </p>

            {issuance.supersededCount > 0 ? (
              <p className="mb-2 text-[11.5px] text-amber-text">
                {issuance.supersededCount} نسخة إيداع ملغاة «حلّت محلها نسخة أحدث» تبقى
                في ملف المعاملة (ر2) —{" "}
                {issuance.stage === "draft"
                  ? `الدور الجديد ${issuance.version} قيد العمل`
                  : `الساري هو الدور ${issuance.version}`}
                .
              </p>
            ) : null}

            {issuance.stage === "draft" ? (
              <div className="flex flex-col gap-2">
                {!issuance.allowsDepositIssue && issuance.blockingReasonsAr.length > 0 ? (
                  <ul className="m-0 list-disc ps-5 text-[11.5px] text-red-text">
                    {issuance.blockingReasonsAr.slice(0, 5).map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : null}
                <div>
                  <PrimaryBtn
                    disabled={issuanceBusy || !issuance.allowsDepositIssue}
                    onClick={() => void issueDeposit()}
                  >
                    إصدار نسخة الإيداع (تجميد التقرير)
                  </PrimaryBtn>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p className="m-0 text-[12.5px] text-text">
                  الحالة:{" "}
                  <strong className="text-[#2f7a4d]">
                    {issuance.stage === "final_issued"
                      ? "النسخة النهائية صادرة ✓"
                      : "نسخة الإيداع صادرة — التقرير مجمّد بانتظار الشهادة"}
                  </strong>
                  {issuance.depositCode ? (
                    <span className="ms-2 text-text-2" dir="ltr">
                      {issuance.depositCode}
                    </span>
                  ) : null}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <GhostBtn
                    disabled={!issuance.hasDepositPdf}
                    onClick={() => void downloadIssuancePdf("deposit")}
                  >
                    تنزيل نسخة الإيداع (PDF)
                  </GhostBtn>
                  {issuance.hasFinalPdf ? (
                    <GhostBtn onClick={() => void downloadIssuancePdf("final")}>
                      تنزيل النسخة النهائية (PDF)
                    </GhostBtn>
                  ) : null}
                </div>

                <div className="mt-1 flex flex-wrap items-end gap-2 rounded-[9px] border border-dashed border-border-md bg-surface-2 p-3">
                  <label className="flex flex-col gap-1 text-[11.5px] text-text-2">
                    رمز الإيداع (من شهادة قيمة)
                    <input
                      dir="ltr"
                      value={depositCodeDraft}
                      onChange={(e) => setDepositCodeDraft(e.target.value)}
                      className="w-52 rounded-[7px] border border-border bg-surface px-2.5 py-[7px] text-xs"
                      placeholder="QYM-…"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11.5px] text-text-2">
                    مستند الشهادة (صورة تدخل صفحةً في النسخة النهائية)
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setCertificateFile(e.target.files?.[0] ?? null)}
                      className="text-[11px]"
                    />
                  </label>
                  <PrimaryBtn
                    disabled={issuanceBusy || !depositCodeDraft.trim()}
                    onClick={() => void registerCertificate()}
                  >
                    {issuance.stage === "final_issued"
                      ? "تحديث الشهادة/الرمز وإعادة إصدار النهائية"
                      : "تسجيل الشهادة وإصدار النسخة النهائية"}
                  </PrimaryBtn>
                </div>
                {issuance.certificateFileName ? (
                  <p className="m-0 text-[11px] text-text-3">
                    الشهادة المحفوظة: {issuance.certificateFileName}
                  </p>
                ) : null}

                {/* تكميلية ق-9 (ر2): إعادة فتح دور التقييم — بموافقة مشرف القسم */}
                <div className="mt-1 flex flex-wrap items-end gap-2 rounded-[9px] border border-dashed border-red bg-surface-2 p-3">
                  <label className="flex min-w-64 flex-1 flex-col gap-1 text-[11.5px] text-text-2">
                    إعادة فتح دور التقييم (ر2) — سبب إلزامي (
                    {JUSTIFICATION_MIN_LENGTH}+ أحرف)؛ النسخة المودعة تُعلَّم ملغاة وتبقى
                    بالملف، ويصدر الدور {issuance.version + 1} بإيداع جديد في قيمة
                    <input
                      value={reopenReason}
                      onChange={(e) => setReopenReason(e.target.value)}
                      className="rounded-[7px] border border-border bg-surface px-2.5 py-[7px] text-xs"
                      placeholder="مثال: صفقة مسجلة أحدث غيّرت قيمة المقارنات"
                    />
                  </label>
                  <GhostBtn
                    disabled={
                      issuanceBusy ||
                      reopenReason.trim().length < JUSTIFICATION_MIN_LENGTH
                    }
                    onClick={() => void reopenIssuance()}
                  >
                    إعادة فتح الدور (مشرف القسم)
                  </GhostBtn>
                </div>
              </div>
            )}
          </CardPad>
        </Card>
      ) : null}
    </>
  );
});
