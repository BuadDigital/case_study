"use client";

import { memo, useMemo } from "react";
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
} from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import { parseLocaleNumber } from "@platform/app-shared/format/number";
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";

import {
  Card,
  CardPad,
  PrimaryBtn,
} from "./atoms";
import { fmt } from "./lib/shell-utils";
import { useFinalOpinionWorkflow } from "./useFinalOpinionWorkflow";
import { useValuationWorkErrors } from "./ValuationWorkErrors";
import { ValueDocumentsPanel } from "./ValueDocumentsPanel";
import {
  OpinionInvoiceRow,
  invoiceInputClass,
  invoiceLabelTdClass,
  invoiceNoteTdClass,
  invoiceTrClass,
  invoiceValueTdClass,
} from "./FinalOpinionInvoice";
import {
  ReconMethodsPhone,
  ReconRationaleInput,
  ReconWeightInput,
  reconMethodNote,
  type ReconMethod,
} from "./FinalOpinionPhone";
import { buildCostNarrative, costFieldsFromDto } from "./lib/cost-approach-state";
import { analysesForRationale, appendAnalysesToRationale } from "./lib/final-opinion-state";

/**
 * Final-opinion screen — reconciliation table and the value-opinion card.
 * Drafts live in `useFinalOpinionWorkflow`. The Q-6 issuance cycle lives on
 * المراجعة النهائية; methodology alerts live on طريقة المقارنة.
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
  poNumber,
  officialValuationDate,
  fieldErrors: sendErrors,
  saving,
  onSavingChange,
  onReconSaved,
  marketAnalysisText = "",
  costAnalysisEnabled = false,
  costBasisKey = "replacement",
}: {
  valuationRequestId: string | null;
  recon: ValuationReconciliationDto | null;
  gates: ValuationIssuanceGatesDto | null;
  cost: ValuationCostApproachDto | null;
  hydrateKey: number;
  buildingOnly: boolean;
  hasAdoptedMarket: boolean;
  assignmentType?: string;
  poNumber?: string;
  officialValuationDate: string | null;
  fieldErrors?: Record<string, string>;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onReconSaved: (dto: ValuationReconciliationDto) => void;
  /** «تحليل التسويات» as shown on طريقة المقارنة (empty when the market approach is off). */
  marketAnalysisText?: string;
  costAnalysisEnabled?: boolean;
  costBasisKey?: string;
}) {
  const { fieldErrors: workErrors, clearSaveErrors } = useValuationWorkErrors();
  /** Send-time errors (snake_case keys) plus the last failed save (server keys). */
  const fieldErrors = { ...sendErrors, ...workErrors };
  const workflow = useFinalOpinionWorkflow({
    valuationRequestId,
    recon,
    cost,
    hydrateKey,
    buildingOnly,
    hasAdoptedMarket,
    assignmentType,
    poNumber,
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
    propertyAfterDiscount,
    finalLocal,
    roundNote,
    soleCost,
    methodComplete,
    saveReconciliation,
  } = workflow;
  const desktop = useViewportDesktop();
  const additions = recon?.additions ?? [];
  const setMethodWeight = (idx: number, raw: number) => {
    const next = [...reconMethods];
    next[idx] = { ...reconMethods[idx]!, weightPct: raw, isIncluded: raw > 0 };
    // Exactly two methods — the other's share auto-fills so they always sum to 100.
    if (reconMethods.length === 2) {
      const otherIdx = idx === 0 ? 1 : 0;
      const otherWeight = 100 - raw;
      next[otherIdx] = {
        ...next[otherIdx]!,
        weightPct: otherWeight,
        isIncluded: otherWeight > 0,
      };
    }
    setReconMethods(next);
  };
  const setMethodRationale = (idx: number, text: string) => {
    const next = [...reconMethods];
    next[idx] = { ...reconMethods[idx]!, rationale: text };
    setReconMethods(next);
  };
  const methodShare = (m: ReconMethod) =>
    fmt(m.isIncluded ? (m.approachValue * m.weightPct) / 100 : 0);
  // Phone ids take the error-scroll targets once the table is not mounted.
  const phoneIdPrefix = desktop === false ? "" : "m-";
  // «تحليل التكلفة»: the appraiser's text when edited, else the generated one — as on طريقة المقاول.
  const analysesText = useMemo(() => {
    let costText = "";
    if (costAnalysisEnabled && cost) {
      const fields = costFieldsFromDto(cost);
      costText =
        fields.costAnalysisNotes.trim() || buildCostNarrative(fields, cost.lines ?? [], costBasisKey);
    }
    return analysesForRationale({ market: marketAnalysisText, cost: costText });
  }, [marketAnalysisText, costAnalysisEnabled, cost, costBasisKey]);

  return (
    <>
      <ValueDocumentsPanel
        valuationRequestId={valuationRequestId}
        poNumber={poNumber}
        propertyId={recon?.propertyId}
        disabled={saving}
        onReconSaved={onReconSaved}
      />
      {!sole ? (
        <>
          <div className="mb-3 flex flex-wrap justify-between gap-x-4 gap-y-1">
            <h2 className="m-0 text-[17px] font-extrabold text-heading">
              الترجيح بين مؤشرات الأساليب
            </h2>
            <span className="text-xs text-text-3">
              مجموع نسب المشاركة يجب أن يساوي 100٪
            </span>
          </div>
          {/* Phones: one card per approach — the 900px table ran off-screen. */}
          {desktop !== true ? (
            <ReconMethodsPhone
              id={desktop === false ? "final-recon" : undefined}
              idPrefix={phoneIdPrefix}
              methods={reconMethods}
              buildingOnly={buildingOnly}
              methodComplete={methodComplete}
              methodShare={methodShare}
              reconWeightsBad={reconWeightsBad}
              weightSumLocal={weightSumLocal}
              weightedLocal={weightedLocal}
              fieldErrors={fieldErrors}
              onWeightChange={setMethodWeight}
              onRationaleChange={setMethodRationale}
            />
          ) : null}
          {desktop !== false ? (
          <Card id="final-recon" className="mb-6 max-lg:hidden">
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
                    <Tr
                      key={m.approachKind}
                      id={`final-method-${idx}`}
                      hoverable={false}
                    >
                      <Td>
                        <div className="font-bold text-heading">{m.labelAr}</div>
                        <div className="mt-0.5 text-[10.5px] text-text-3">
                          {reconMethodNote(m, buildingOnly)}
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
                        <ReconWeightInput
                          id={`final-method-weight-${idx}`}
                          m={m}
                          bad={reconWeightsBad}
                          invalid={Boolean(fieldErrors[`methods[${idx}].weightPct`])}
                          onChange={(raw) => setMethodWeight(idx, raw)}
                        />
                      </Td>
                      <Td className="text-center font-extrabold">
                        {incomplete ? (
                          <span className="text-text-3">—</span>
                        ) : (
                          <span dir="ltr">{methodShare(m)}</span>
                        )}
                      </Td>
                      <Td>
                        <ReconRationaleInput
                          m={m}
                          onChange={(text) => setMethodRationale(idx, text)}
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
                {reconWeightsBad ? " — يجب أن يساوي 100٪" : ""}
              </span>
              <span
                className={cn(
                  "text-[13px] font-bold",
                  reconWeightsBad ? "text-red-text" : "text-heading",
                )}
              >
                القيمة المرجّحة:{" "}
                <span dir="ltr">{fmt(weightedLocal)}</span> ر.س
              </span>
            </div>
          </Card>
          ) : null}
        </>
      ) : null}

      <Card
        id="final-inf-total"
        className={cn(
          "relative overflow-hidden",
          fieldErrors?.evaluator_price && invalidControlClass,
        )}
      >
        <span className="absolute start-0 top-0 h-full w-[3px] bg-gold" />
        <CardPad>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-4">
              <div className="text-sm font-extrabold text-heading">
                الرأي النهائي للقيمة
              </div>
              <div className="text-[11.5px] text-text-3">
                {officialValuationDate
                  ? `قيمة العقار محل التقييم في تاريخ ${officialValuationDate}`
                  : "قيمة العقار محل التقييم — يُثبَّت التاريخ عند اعتماد التقييم"}
              </div>
            </div>

            <table className="w-full border-collapse max-lg:block">
              <tbody className="max-lg:block">
                {soleCost && !buildingOnly ? (
                  <>
                    <OpinionInvoiceRow
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
                    <OpinionInvoiceRow
                      label="+ قيمة المباني بعد الإهلاك"
                      note="تكلفة الإحلال − الإهلاك"
                      value={fmt(cost?.buildingsValueAfterDepreciation)}
                    />
                  </>
                ) : null}
                {reconMethods.map((m) => {
                  const done = methodComplete(m.approachKind);
                  return (
                    <OpinionInvoiceRow
                      key={m.approachKind}
                      label={`${soleCost && !buildingOnly ? "= " : ""}مؤشر ${m.labelAr}`}
                      note={
                        reconMethods.length === 1
                          ? "وزنه 100٪"
                          : `وزنه ${m.weightPct}٪`
                      }
                      value={done ? fmt(m.approachValue) : "غير مكتمل"}
                      strong={soleCost && !buildingOnly}
                      valueClassName={done ? undefined : "text-red-text"}
                    />
                  );
                })}
                {reconMethods.length >= 2 ? (
                  <OpinionInvoiceRow
                    label="القيمة المرجّحة"
                    note="مجموع المؤشرات بأوزانها"
                    value={fmt(weightedLocal)}
                    strong
                    valueClassName="text-[14px]"
                  />
                ) : null}
                {isLiquidation ? (
                  <tr className={invoiceTrClass}>
                    <td className={cn(invoiceLabelTdClass, "py-1.5")}>
                      <span className="text-[12.5px] font-medium text-text">
                        − خصم التصفية
                      </span>
                      <input
                        id="final-inf-discount"
                        dir="ltr"
                        type="number"
                        min={0}
                        max={90}
                        step={5}
                        value={liquidationDiscountPct}
                        onChange={(e) =>
                          setLiquidationDiscountPct(e.target.value)
                        }
                        className={cn(
                          invoiceInputClass,
                          (fieldErrors.forced_sale_discount ||
                            fieldErrors.liquidationDiscountPct) &&
                            invalidControlClass,
                        )}
                      />
                    </td>
                    <td
                      dir="ltr"
                      className={cn(invoiceValueTdClass, "py-1.5 text-[13.5px] font-bold text-red-text")}
                    >
                      −{fmt(forcedCut)}
                    </td>
                    <td className={cn(invoiceNoteTdClass, "py-1.5")}>
                      ٪ من القيمة قبل الخصم
                    </td>
                  </tr>
                ) : null}
                {isLiquidation ? (
                  <tr className={invoiceTrClass}>
                    <td colSpan={3} className="py-2 text-start max-lg:col-span-2 max-lg:p-0">
                      <label
                        htmlFor="final-inf-discount-rationale"
                        className="mb-1 block text-[12px] font-medium text-text"
                      >
                        مبرر خصم التصفية
                        {parseLocaleNumber(liquidationDiscountPct) > 0 ? (
                          <span className="text-danger-text"> *</span>
                        ) : null}
                      </label>
                      <input
                        id="final-inf-discount-rationale"
                        type="text"
                        value={liquidationDiscountRationale}
                        onChange={(e) =>
                          setLiquidationDiscountRationale(e.target.value)
                        }
                        placeholder="مثال: سيولة السوق خلال 90 يوماً، ظروف البيع القسري…"
                        className={cn(
                          "w-full rounded-md border border-border-md bg-surface px-2.5 py-2 text-[12.5px] text-heading max-lg:min-h-11 max-lg:text-[16px]",
                          (fieldErrors.liquidation_discount_rationale ||
                            fieldErrors.liquidationDiscountRationale) &&
                            invalidControlClass,
                        )}
                      />
                      {fieldErrors.liquidation_discount_rationale ||
                      fieldErrors.liquidationDiscountRationale ? (
                        <p className="mt-1 mb-0 text-[11px] text-danger-text">
                          {fieldErrors.liquidation_discount_rationale ||
                            fieldErrors.liquidationDiscountRationale}
                        </p>
                      ) : parseLocaleNumber(liquidationDiscountPct) >
                        0 ? (
                        <p className="mt-1 mb-0 text-[10.5px] text-text-3">
                          مطلوب عند إدخال نسبة خصم التصفية أكبر من صفر.
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ) : null}
                {additions.length > 0 ? (
                  <>
                    <OpinionInvoiceRow
                      label="قيمة العقار بعد خصم التصفية"
                      note="قبل التقريب"
                      value={fmt(propertyAfterDiscount)}
                      strong
                    />
                    {additions.map((a) => (
                      <OpinionInvoiceRow
                        key={a.attachmentId}
                        label={`+ ${a.labelAr}`}
                        note="مستند ذو قيمة — دون ترجيح أو خصم"
                        value={fmt(a.value)}
                      />
                    ))}
                  </>
                ) : null}
                <tr className={invoiceTrClass}>
                  <td className={cn(invoiceLabelTdClass, "py-1.5")}>
                    <span className="text-[12.5px] font-medium text-text">
                      تقريب القيمة
                    </span>
                    <input
                      id="final-round-decimals"
                      dir="ltr"
                      type="number"
                      min={0}
                      max={6}
                      step={1}
                      value={finalRoundDecimals}
                      onChange={(e) => setFinalRoundDecimals(e.target.value)}
                      className={cn(
                        invoiceInputClass,
                        fieldErrors.finalRoundDecimals && invalidControlClass,
                      )}
                    />
                  </td>
                  <td className={invoiceValueTdClass} />
                  <td className={cn(invoiceNoteTdClass, "py-1.5")}>
                    {roundNote}
                  </td>
                </tr>
                <tr className="border-t-2 border-gold max-lg:grid max-lg:grid-cols-[minmax(0,1fr)_auto] max-lg:items-baseline max-lg:gap-x-2 max-lg:pt-3">
                  <td className={cn(invoiceLabelTdClass, "pb-0.5 pt-3 text-[13.5px] font-extrabold text-heading")}>
                    {additions.length > 0 ? "= القيمة الإجمالية" : "= القيمة النهائية"}
                  </td>
                  <td
                    dir="ltr"
                    className={cn(invoiceValueTdClass, "pb-0.5 pt-2.5 text-[26px] font-extrabold leading-[1.15] text-heading")}
                  >
                    {fmt(finalLocal)}
                  </td>
                  <td className={cn(invoiceNoteTdClass, "pb-0.5 pt-3 max-lg:text-end")}>
                    ر.س
                  </td>
                </tr>
              </tbody>
            </table>
            {fieldErrors?.evaluator_price ? (
              <p className="mt-2 text-[11px] text-danger-text">
                {fieldErrors.evaluator_price}
              </p>
            ) : null}
            {fieldErrors.forced_sale_discount ||
            fieldErrors.liquidationDiscountPct ? (
              <p className="mt-2 text-[11px] text-danger-text">
                {fieldErrors.forced_sale_discount ||
                  fieldErrors.liquidationDiscountPct}
              </p>
            ) : null}

            <div className="mt-[13px] mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-text-3">
               توصيات المقييم و الرأي النهائي للقيمة
              </span>
              <button
                type="button"
                disabled={saving || !analysesText}
                title={analysesText ? undefined : "لا يوجد تحليل تسويات أو تكلفة بعد"}
                onClick={() =>
                  setMethodsRationale(appendAnalysesToRationale(methodsRationale, analysesText))
                }
                className="rounded-md border border-border-md bg-surface px-2.5 py-1 text-[11px] font-bold text-heading disabled:cursor-not-allowed disabled:opacity-50 max-lg:min-h-11 max-lg:shrink-0 max-lg:px-3.5 max-lg:text-[12.5px]"
              >
                إدراج التحليلات
              </button>
            </div>
            <textarea
              id="final-methods-rationale"
              rows={6}
              value={methodsRationale}
              onChange={(e) => {
                setMethodsRationale(e.target.value);
                if (fieldErrors.methodsRationale) {
                  clearSaveErrors("methodsRationale");
                }
              }}
              placeholder="اكتب مبرر الرأي النهائي هنا…"
              className={cn(
                "w-full resize-y rounded-[9px] border border-border bg-surface-2 px-3.5 py-3 text-[12.5px] font-medium leading-[1.9] text-text placeholder:text-text-3 max-lg:text-[16px]",
                fieldErrors.methodsRationale && invalidControlClass,
              )}
            />
            {fieldErrors.methodsRationale ? (
              <p className="mb-0 mt-1.5 text-[11px] text-danger-text">
                {fieldErrors.methodsRationale}
              </p>
            ) : null}

            <div className="mt-[18px] flex flex-wrap gap-2.5">
            <PrimaryBtn
              disabled={saving || reconMethods.length === 0}
              onClick={() => void saveReconciliation()}
            >
              {sole ? "حفظ الرأي النهائي" : "حفظ الترجيح والرأي النهائي"}
            </PrimaryBtn>
          </div>
        </CardPad>
      </Card>
    </>
  );
});
