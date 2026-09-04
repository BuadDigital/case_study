"use client";

import { memo } from "react";
import type {
  ValuationCostApproachDto,
  ValuationIssuanceGatesDto,
  ValuationReconciliationDto,
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
} from "@platform/ui-kit";

import { amountWordsOrZero } from "../../../lib/evaluator/value-estimation";
import {
  Card,
  CardPad,
  CardTitle,
  FieldLabel,
  GhostBtn,
  LedgerRow,
  PrimaryBtn,
} from "./atoms";
import { fmt } from "./lib/shell-utils";
import {
  FinalOpinionGatesCard,
  FinalOpinionIssuanceCard,
} from "./FinalOpinionParts";
import { useFinalOpinionWorkflow } from "./useFinalOpinionWorkflow";

/**
 * Final-opinion screen — reconciliation table, the value-opinion card, the
 * issuance gates and the Rule Q-6 issuance cycle. Drafts live in
 * `useFinalOpinionWorkflow`, so typing here does not re-render the valuation
 * shell; the section stays mounted (hidden) after first visit so unsaved
 * drafts survive, and hydrates from the server batch via hydrateKey.
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
  const workflow = useFinalOpinionWorkflow({
    valuationRequestId,
    recon,
    gates,
    cost,
    hydrateKey,
    buildingOnly,
    hasAdoptedMarket,
    assignmentType,
    onSavingChange,
    onReconSaved,
  });
  const {
    reconMethods,
    setReconMethods,
    methodsRationale,
    setMethodsRationale,
    finalRoundDecimals,
    setFinalRoundDecimals,
    basisOfValueKey,
    basisOptions,
    premiseOptions,
    valuePremiseKey,
    setValuePremiseKey,
    liquidationDiscountPct,
    setLiquidationDiscountPct,
    liquidationDiscountRationale,
    setLiquidationDiscountRationale,
    sole,
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
    opinionDirty,
    issuance,
    saveReconciliation,
    openReportPreview,
  } = workflow;

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
            <Table className="min-w-[900px]">
              <THead>
                <Tr hoverable={false}>
                  <Th>الأسلوب</Th>
                  <Th className="text-center">القيمة الناتجة</Th>
                  <Th className="text-center">نسبة المشاركة (٪)</Th>
                  <Th className="text-center">القيمة بعد المشاركة</Th>
                  <Th>مبرر</Th>
                </Tr>
              </THead>
              <TBody>
                {reconMethods.map((m, idx) => {
                  const incomplete = !methodComplete(m.approachKind);
                  return (
                    <Tr key={m.approachKind} hoverable={false}>
                      <Td>
                        <div className="font-bold text-heading">{m.labelAr}</div>
                        <div className="mt-0.5 text-[10.5px] text-text-3">
                          {m.approachKind === "cost"
                            ? buildingOnly
                              ? "مبنى فقط — تكلفة الإحلال ناقصاً الإهلاك"
                              : "قيمة الأرض + تكلفة الإحلال − الإهلاك"
                            : "مؤشر قيمة من طريقة المقارنة"}
                        </div>
                      </Td>
                      <Td className="text-center font-extrabold">
                        {incomplete ? (
                          <span className="text-[12.5px] text-red-text">
                            غير مكتمل
                          </span>
                        ) : (
                          <span dir="ltr">{fmt(m.approachValue)}</span>
                        )}
                      </Td>
                      <Td className="text-center">
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
                      </Td>
                      <Td className="text-center font-extrabold">
                        {incomplete ? (
                          <span className="text-text-3">—</span>
                        ) : (
                          <span dir="ltr">
                            {fmt((m.approachValue * m.weightPct) / 100)}
                          </span>
                        )}
                      </Td>
                      <Td>
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
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
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
                  className={cn(opsFldControl, "font-semibold cursor-pointer font-medium")}
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

            {/* Value ledger — interactive-form spec (invoiceRows) */}
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

            {/* Final-opinion text — auto until edited */}
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
        <FinalOpinionGatesCard
          gates={gates}
          workflow={workflow}
          saving={saving}
        />
      ) : null}

      {/* Rule Q-6: two-stage issuance + deposit certificate */}
      {issuance ? (
        <FinalOpinionIssuanceCard
          issuance={issuance}
          workflow={workflow}
          saving={saving}
        />
      ) : null}
    </>
  );
});
