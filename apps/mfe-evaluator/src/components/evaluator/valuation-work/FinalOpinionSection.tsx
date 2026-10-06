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

import {
  Card,
  CardPad,
  PrimaryBtn,
} from "./atoms";
import { fmt } from "./lib/shell-utils";
import { useFinalOpinionWorkflow } from "./useFinalOpinionWorkflow";
import { useValuationWorkErrors } from "./ValuationWorkErrors";
import { ValueDocumentsPanel } from "./ValueDocumentsPanel";
import { buildCostNarrative, costFieldsFromDto } from "./lib/cost-approach-state";
import { analysesForRationale, appendAnalysesToRationale } from "./lib/final-opinion-state";

/** Invoice line from the interactive-form spec — label | value | note. */
function OpinionInvoiceRow({
  label,
  note,
  value,
  strong,
  valueClassName,
}: {
  label: string;
  note?: string;
  value: string;
  strong?: boolean;
  valueClassName?: string;
}) {
  return (
    <tr className="border-b border-dashed border-border">
      <td
        className={cn(
          "w-px whitespace-nowrap py-2 text-start text-[12.5px] text-heading",
          strong ? "font-extrabold" : "font-medium",
        )}
      >
        {label}
      </td>
      <td
        dir="ltr"
        className={cn(
          "w-[150px] py-2 pe-0 ps-[18px] text-start font-bold text-heading",
          strong ? "text-[14px] font-extrabold" : "text-[13.5px]",
          valueClassName,
        )}
      >
        {value}
      </td>
      <td className="py-2 text-start text-[10.5px] text-text-3">{note}</td>
    </tr>
  );
}

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
  const additions = recon?.additions ?? [];
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
          <div className="mb-3 flex justify-between">
            <h2 className="m-0 text-[17px] font-extrabold text-heading">
              التوفيق بين مؤشرات الأساليب
            </h2>
            <span className="text-xs text-text-3">
              مجموع نسب المشاركة يجب أن يساوي ١٠٠٪
            </span>
          </div>
          <Card id="final-recon" className="mb-6">
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
                          {m.valueDocumentAttachmentId
                            ? "قيمة واردة في مستند ذي قيمة — أثره من «مرفقات التقرير»"
                            : m.approachKind === "cost"
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
                          id={`final-method-weight-${idx}`}
                          dir="ltr"
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={m.weightPct}
                          onChange={(e) => {
                            const raw = Math.min(
                              100,
                              Math.max(
                                0,
                                Number(e.target.value.replace(",", ".")) || 0,
                              ),
                            );
                            const next = [...reconMethods];
                            next[idx] = {
                              ...m,
                              weightPct: raw,
                              isIncluded: raw > 0,
                            };
                            // Exactly two methods — the other's share auto-fills so they always sum to 100.
                            if (reconMethods.length === 2) {
                              const otherIdx = idx === 0 ? 1 : 0;
                              const otherWeight = 100 - raw;
                              next[otherIdx] = {
                                ...next[otherIdx],
                                weightPct: otherWeight,
                                isIncluded: otherWeight > 0,
                              };
                            }
                            setReconMethods(next);
                          }}
                          className={cn(
                            "w-[82px] rounded-[7px] border p-2 text-center font-bold",
                            reconWeightsBad
                              ? "border-red bg-[rgba(192,85,61,.07)] text-red-text"
                              : "border-border-md bg-surface text-heading",
                            fieldErrors[`methods[${idx}].weightPct`] &&
                              invalidControlClass,
                          )}
                        />
                      </Td>
                      <Td className="text-center font-extrabold">
                        {incomplete ? (
                          <span className="text-text-3">—</span>
                        ) : (
                          <span dir="ltr">
                            {fmt(
                              m.isIncluded
                                ? (m.approachValue * m.weightPct) / 100
                                : 0,
                            )}
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

            <table className="w-full border-collapse">
              <tbody>
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
                          ? "وزنه ١٠٠٪"
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
                  <tr className="border-b border-dashed border-border">
                    <td className="w-px whitespace-nowrap py-1.5 text-start">
                      <span className="text-[12.5px] font-medium text-text">
                        − خصم البيع القسري
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
                          "ms-2 w-[58px] rounded-md border border-border-md bg-surface p-[5px] text-center text-xs font-bold text-heading",
                          (fieldErrors.forced_sale_discount ||
                            fieldErrors.liquidationDiscountPct) &&
                            invalidControlClass,
                        )}
                      />
                    </td>
                    <td
                      dir="ltr"
                      className="w-[150px] py-1.5 pe-0 ps-[18px] text-start text-[13.5px] font-bold text-red-text"
                    >
                      −{fmt(forcedCut)}
                    </td>
                    <td className="py-1.5 text-start text-[10.5px] text-text-3">
                      ٪ من القيمة قبل الخصم
                    </td>
                  </tr>
                ) : null}
                {isLiquidation ? (
                  <tr className="border-b border-dashed border-border">
                    <td colSpan={3} className="py-2 text-start">
                      <label
                        htmlFor="final-inf-discount-rationale"
                        className="mb-1 block text-[12px] font-medium text-text"
                      >
                        مبرر معامل التصفية
                        {Number(liquidationDiscountPct.replace(",", ".")) > 0 ? (
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
                        placeholder="مثال: سيولة السوق خلال ٩٠ يوماً، ظروف البيع القسري…"
                        className={cn(
                          "w-full rounded-md border border-border-md bg-surface px-2.5 py-2 text-[12.5px] text-heading",
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
                      ) : Number(liquidationDiscountPct.replace(",", ".")) >
                        0 ? (
                        <p className="mt-1 mb-0 text-[10.5px] text-text-3">
                          مطلوب عند إدخال نسبة خصم أكبر من صفر.
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
                <tr className="border-b border-dashed border-border">
                  <td className="w-px whitespace-nowrap py-1.5 text-start">
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
                        "ms-2 w-[58px] rounded-md border border-border-md bg-surface p-[5px] text-center text-xs font-bold text-heading",
                        fieldErrors.finalRoundDecimals && invalidControlClass,
                      )}
                    />
                  </td>
                  <td className="w-[150px] pe-0 ps-[18px]" />
                  <td className="py-1.5 text-start text-[10.5px] text-text-3">
                    {roundNote}
                  </td>
                </tr>
                <tr className="border-t-2 border-gold">
                  <td className="w-px whitespace-nowrap pb-0.5 pt-3 text-start text-[13.5px] font-extrabold text-heading">
                    {additions.length > 0 ? "= القيمة الإجمالية" : "= القيمة النهائية"}
                  </td>
                  <td
                    dir="ltr"
                    className="w-[150px] pb-0.5 pe-0 ps-[18px] pt-2.5 text-start text-[26px] font-extrabold leading-[1.15] text-heading"
                  >
                    {fmt(finalLocal)}
                  </td>
                  <td className="pb-0.5 pt-3 text-start text-[10.5px] text-text-3">
                    ريال سعودي
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
                className="rounded-md border border-border-md bg-surface px-2.5 py-1 text-[11px] font-bold text-heading disabled:cursor-not-allowed disabled:opacity-50"
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
                "w-full resize-y rounded-[9px] border border-border bg-surface-2 px-3.5 py-3 text-[12.5px] font-medium leading-[1.9] text-text placeholder:text-text-3",
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
              {sole ? "حفظ الرأي النهائي" : "حفظ التوفيق والرأي النهائي"}
            </PrimaryBtn>
          </div>
        </CardPad>
      </Card>
    </>
  );
});
