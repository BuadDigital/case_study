// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • The ±40٪ red flag on «مجموع التسويات» comes from the server (exceedsLargeAdjustmentThreshold,
//         net or gross) instead of a local |net| > 35 check.
// Round 2 (1b19bedc)
//  • Wording  Comparable transaction dates under the price and unit-rate rows print as yyyy/mm/dd (ymd).
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { memo, type ReactNode } from "react";
import { Table, cn, opsBtnPrimary, opsPanelCard } from "@platform/ui-kit";
import type {
  ValuationComparableSelectionDto,
  ValuationComparableSelectionListDto,
} from "@platform/api-client";
import { ymd } from "@platform/app-shared/format/date";
import { parseLocaleNumber } from "@platform/app-shared/format/number";
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";

import { fmt } from "./lib/shell-utils";
import {
  AUTO_AREA_KEY,
  CUSTOM_FACTOR_LABEL,
  factorDescriptor,
  factorHasSpecCell,
  factorMeta,
  lineIsIncluded,
  nextCustomFactorKey,
} from "./lib/factor-registry";
import type { MatrixDispatch } from "./lib/matrix-actions";
import { afterWeightValue } from "./lib/adjustments-matrix-state";
import {
  CompReadonly,
  FactorPctInput,
  JustCell,
  SubjCell,
  WeightCell,
  effArea,
  effPrice,
  effUnit,
  panelCardClass,
  pct,
  pctClass,
  sequentialCompNote,
  tdSubjClass,
  thBandClass,
  thCompBaseClass,
  thCompClass,
} from "./AdjustmentsMatrixCells";
import {
  AddFactorRow,
  InlineDraftInput,
  LabelCell,
} from "./AdjustmentsMatrixFactorCells";
import { MatrixAlertsPanel, MatrixOutputsPanel } from "./AdjustmentsMatrixPanels";
import { AdjustmentsMatrixPhone } from "./AdjustmentsMatrixPhone";
import { useAdjustmentsMatrixModel } from "./useAdjustmentsMatrixModel";


type AdjustmentsMatrixProps = {
  selection: ValuationComparableSelectionListDto;
  adopted: ValuationComparableSelectionDto[];
  locked: boolean;
  saving: boolean;
  subjectArea: string;
  idealArea: string;
  city?: string;
  district?: string;
  valuationDate?: string;
  /** subjSpec: subject-property description per difference factor. */
  subjectSpecs?: Record<string, string>;
  /** Market context can edit subject description; land-within-cost context cannot. */
  canEditSubjectSpec?: boolean;
  /**
   * Single command instead of 15 callbacks — returns execution success where the draft is cleared.
   * One stable ref so table memo survives shell re-renders.
   */
  dispatch: MatrixDispatch;
  /** Rendered between the output strip and the alerts so alerts stay last. */
  children?: ReactNode;
};

export const AdjustmentsMatrix = memo(function AdjustmentsMatrix({
  selection,
  adopted,
  locked,
  saving,
  subjectArea,
  idealArea,
  city,
  district,
  valuationDate,
  subjectSpecs,
  canEditSubjectSpec,
  dispatch,
  children,
}: AdjustmentsMatrixProps) {
  const desktop = useViewportDesktop();
  const model = useAdjustmentsMatrixModel({
    selection,
    adopted,
    subjectArea,
    dispatch,
  });
  const {
    confirmDelete,
    setConfirmDelete,
    saveRationale,
    lineOf,
    linePct,
    justValue,
    basisView,
    sequentialKeys,
    removedSequential,
    differenceKeys,
    alerts,
    addableFactors,
  } = model;
  const { isUnit, areaMethod, areaFactor } = basisView;

  if (adopted.length === 0) {
    return (
      <div className={cn(opsPanelCard, "mb-6 px-[22px] py-[18px] text-[13px] text-text-3")}>
        اعتمد مقارناً واحداً على الأقل لفتح جدول التسويات.
      </div>
    );
  }

  return (
    <div id="mx-adjustments">
      <div className="mb-3 flex items-center justify-between gap-4 max-lg:flex-col max-lg:items-stretch max-lg:gap-2.5">
        <div className="flex items-center gap-2.5">
          <h2 className="m-0 text-[17px] font-extrabold text-heading">
            جدول التسويات
          </h2>
          <span className="text-[12px] font-normal text-text-3 max-lg:hidden">
            مرّر على اسم البند لقراءة تعريفه وحدوده
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-lg:[&>button]:min-h-11 max-lg:[&>button]:flex-1 max-lg:[&>button]:justify-center">
          {removedSequential.map((k) => (
            <button
              key={k}
              type="button"
              disabled={saving || locked}
              onClick={() =>
                void dispatch({ type: "restore-sequential", factorKey: k })
              }
              title="استعادة البند المحذوف بقيمه الافتراضية"
              className="inline-flex cursor-pointer items-center gap-[5px] rounded-[var(--radius)] border border-dashed border-gold bg-gold-soft px-3 py-2 text-[12px] font-bold text-gold-d disabled:cursor-not-allowed"
            >
              ↺ استعادة {factorMeta(k).label}
            </button>
          ))}
          <button
            type="button"
            disabled={saving || locked}
            onClick={() => void dispatch({ type: "reset-weights" })}
            className={cn(opsBtnPrimary, "shadow-card")}
          >
            إعادة ضبط الأوزان
          </button>
        </div>
      </div>

      {/* Phones: basis picker, one factor-controls card, one card per comparable —
          not the 1100px factor × comparable grid scrolled sideways. */}
      {desktop !== true ? (
        <AdjustmentsMatrixPhone
          className="mb-6 lg:hidden"
          adopted={adopted}
          locked={locked}
          saving={saving}
          subjectArea={subjectArea}
          idealArea={idealArea}
          city={city}
          district={district}
          valuationDate={valuationDate}
          subjectSpecs={subjectSpecs}
          canEditSubjectSpec={canEditSubjectSpec}
          dispatch={dispatch}
          model={model}
        />
      ) : null}

      {desktop !== false ? (
      <div className={cn(panelCardClass, "max-lg:hidden")}>
        <Table className="min-w-[1100px]">
          <thead>
            <tr>
              <th className={cn(thBandClass, "w-[230px]")}>البند</th>
              <th
                className={cn(
                  thCompBaseClass,
                  "border-x border-x-border-md bg-gold-soft",
                )}
              >
                <div>العقار محل التقييم</div>
                <div className="mt-[3px] text-[10.5px] font-normal text-gold-d">
                  أساس المقارنة
                </div>
              </th>
              {adopted.map((item) => (
                <th key={item.id} className={thCompClass}>
                  <div dir="ltr">{item.comparable.referenceCode}</div>
                  <div className="mt-[3px] text-[10.5px] font-normal text-text-3">
                    {item.comparable.transactionKindLabelAr}
                  </div>
                </th>
              ))}
              <th
                className={cn(
                  thBandClass,
                  "min-w-[230px] border-s border-s-border",
                )}
              >
                مبرر عامل التسوية
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Basis: property value */}
            <tr className={isUnit ? "bg-surface-2" : "bg-surface"}>
              <LabelCell
                label="قيمة العقار المقارن"
                hint="إجمالي الصفقة (ر.س) — التسويات على قيمة العقار كاملة"
                tip="إجمالي سعر العقار المقارن. عند اعتماده تُجرى كل التسويات على قيمة العقار كاملة."
                locked={locked}
                pickable
                picked={!isUnit}
                onPick={() =>
                  void dispatch({ type: "change-basis", basis: "whole_property" })
                }
              />
              <SubjCell value="المطلوب تقديره" note="مخرج التقييم" />
              {adopted.map((item) => (
                <CompReadonly
                  key={item.id}
                  value={fmt(effPrice(item))}
                  note={ymd(item.comparable.transactionDate)}
                  valueClassName={!isUnit ? "text-heading" : "text-text-3"}
                />
              ))}
              <JustCell />
            </tr>

            {/* Basis: price per sqm */}
            <tr className={isUnit ? "bg-surface" : "bg-surface-2"}>
              <LabelCell
                label="سعر متر المقارن"
                hint="ر.س/م² — سعر المتر يُضرب في مساحة العقار آخر المطاف"
                tip="سعر المتر المرصود للمقارن قبل أي تسوية."
                locked={locked}
                pickable
                picked={isUnit}
                onPick={() =>
                  void dispatch({ type: "change-basis", basis: "price_per_sqm" })
                }
              />
              <SubjCell value="المطلوب تقديره" note="مخرج التقييم" />
              {adopted.map((item) => (
                <CompReadonly
                  key={item.id}
                  value={fmt(effUnit(item))}
                  note={ymd(item.comparable.transactionDate)}
                  valueClassName={isUnit ? "text-heading" : "text-text-3"}
                />
              ))}
              <JustCell />
            </tr>

            {/* Sequential */}
            {sequentialKeys.map((factorKey) => {
              const desc = factorDescriptor(factorKey);
              const meta = factorMeta(
                factorKey,
                lineOf(adopted[0]!, factorKey)?.labelAr,
              );
              const included = lineIsIncluded(
                lineOf(adopted[0]!, factorKey),
                factorKey,
              );
              const deletable = desc?.deletable === true;
              return (
                <tr
                  key={factorKey}
                  className={included ? "bg-surface" : "bg-surface-2"}
                >
                  <LabelCell
                    label={meta.label}
                    hint={meta.hint}
                    tip={meta.tip}
                    locked={locked}
                    removable={deletable}
                    included={included}
                    onToggle={() => {
                      const first = adopted[0];
                      if (first)
                        void dispatch({
                          type: "toggle-included",
                          item: first,
                          factorKey,
                        });
                    }}
                    offNote={
                      included ? undefined : "غير محتسب في السعر التسلسلي"
                    }
                    deleteKey={deletable ? factorKey : undefined}
                    confirmDelete={confirmDelete}
                    onConfirmDelete={setConfirmDelete}
                    onDelete={
                      deletable
                        ? () =>
                            void dispatch({
                              type: "remove-sequential",
                              factorKey,
                            })
                        : undefined
                    }
                  />
                  <SubjCell
                    value={
                      desc?.subjectCell === "valuation-date"
                        ? "تاريخ التقييم"
                        : "—"
                    }
                    note={
                      desc?.subjectCell === "valuation-date"
                        ? valuationDate || undefined
                        : undefined
                    }
                  />
                  {adopted.map((item) => (
                    <FactorPctInput
                      key={item.id}
                      item={item}
                      factorKey={factorKey}
                      value={linePct(item, factorKey)}
                      included={lineIsIncluded(lineOf(item, factorKey), factorKey)}
                      locked={locked}
                      dispatch={dispatch}
                      note={sequentialCompNote(desc, item)}
                    />
                  ))}
                  <JustCell
                    factorKey={factorKey}
                    value={justValue(factorKey)}
                    locked={locked}
                    onCommit={saveRationale}
                  />
                </tr>
              );
            })}

            {/* After sequential */}
            <tr className="bg-surface-2">
              <LabelCell
                label="السعر بعد تسوية ظروف السوق"
                hint="ضربية بالترتيب"
                tip="السعر × (1+تمويل) × (1+سوق) × (1+نوع)."
                locked={locked}
              />
              <SubjCell value="—" />
              {adopted.map((item) => (
                <CompReadonly
                  key={item.id}
                  value={fmt(item.market?.pricePerSqmAfterSequential)}
                />
              ))}
              <JustCell />
            </tr>

            {/* Area */}
            <tr>
              <LabelCell
                label={factorMeta(AUTO_AREA_KEY).label}
                hint={areaMethod}
                tip={factorMeta(AUTO_AREA_KEY).tip}
                locked={locked}
                areaFactor={areaFactor}
                onAreaFactorChange={(value) =>
                  dispatch({ type: "area-factor-change", value })
                }
              />
              <SubjCell
                value={`${fmt(parseLocaleNumber(subjectArea) || null)} م²`}
                note="مساحة الأرض"
              />
              {adopted.map((item) => {
                const adj = item.market?.suggestedAreaAdjustmentPct ?? 0;
                return (
                  <CompReadonly
                    key={item.id}
                    value={pct(adj)}
                    valueClassName={pctClass(adj)}
                    note={`${fmt(effArea(item))} م²`}
                  />
                );
              })}
              <JustCell
                factorKey={AUTO_AREA_KEY}
                value={justValue(AUTO_AREA_KEY)}
                locked={locked}
                onCommit={saveRationale}
              />
            </tr>

            {/* Difference factors */}
            {differenceKeys.map((factorKey) => {
              const desc = factorDescriptor(factorKey);
              const meta = factorMeta(
                factorKey,
                lineOf(adopted[0]!, factorKey)?.labelAr,
              );
              const included = lineIsIncluded(
                lineOf(adopted[0]!, factorKey),
                factorKey,
              );
              const specEnabled = factorHasSpecCell(factorKey);
              let subjVal = "—";
              let subjNote: string | undefined;
              if (desc?.subjectCell === "ideal-area") {
                subjVal = `${fmt(parseLocaleNumber(idealArea) || parseLocaleNumber(subjectArea) || null)} م²`;
                subjNote = "السائدة في الحي";
              } else if (desc?.subjectCell === "location") {
                subjVal = district || "—";
                subjNote = city;
              }
              const subjEditable =
                specEnabled && !desc?.subjectCell && !!canEditSubjectSpec;
              return (
                <tr
                  key={factorKey}
                  className={included ? "bg-surface" : "bg-surface-2"}
                >
                  <LabelCell
                    label={meta.label}
                    hint={meta.hint}
                    tip={meta.tip}
                    locked={locked}
                    removable
                    included={included}
                    onToggle={() => {
                      const first = adopted[0];
                      if (first)
                        void dispatch({
                          type: "toggle-included",
                          item: first,
                          factorKey,
                        });
                    }}
                    offNote={included ? undefined : "غير محتسب في المجموع"}
                    deleteKey={factorKey}
                    confirmDelete={confirmDelete}
                    onConfirmDelete={setConfirmDelete}
                    onDelete={() =>
                      void dispatch({ type: "remove-factor", factorKey })
                    }
                  />
                  {subjEditable ? (
                    <td className={tdSubjClass}>
                      <InlineDraftInput
                        disabled={locked}
                        placeholder="وصف العقار…"
                        value={subjectSpecs?.[factorKey] ?? ""}
                        onCommit={(text) =>
                          void dispatch({
                            type: "save-subject-spec",
                            factorKey,
                            text,
                          })
                        }
                        className="w-full rounded-[7px] border border-dashed border-border-md bg-surface px-2 py-1.5 text-center text-[12px] font-bold text-gold-d"
                      />
                    </td>
                  ) : (
                    <SubjCell value={subjVal} note={subjNote} />
                  )}
                  {adopted.map((item) => {
                    const line = lineOf(item, factorKey);
                    const descKey = `${item.id}:${factorKey}:desc`;
                    return (
                      <FactorPctInput
                        key={item.id}
                        item={item}
                        factorKey={factorKey}
                        value={linePct(item, factorKey)}
                        included={included}
                        locked={locked}
                        dispatch={dispatch}
                        note={
                          desc?.subjectCell === "location"
                            ? `${item.comparable.district || "—"} · ${city || ""}`
                            : undefined
                        }
                        extra={
                          specEnabled ? (
                            <InlineDraftInput
                              key={descKey}
                              disabled={locked}
                              placeholder="وصف عامل التسوية"
                              value={line?.descriptionAr ?? ""}
                              onCommit={(text) =>
                                void dispatch({
                                  type: "save-description",
                                  item,
                                  factorKey,
                                  text,
                                })
                              }
                              // Its own line under the percentage box — the two
                              // used to sit side by side in a wide column.
                              className="mx-auto mt-1 block w-[110px] rounded-md border border-dashed border-border bg-surface px-1.5 py-1 text-center text-[10.5px] font-medium text-text-2"
                            />
                          ) : null
                        }
                      />
                    );
                  })}
                  <JustCell
                    factorKey={factorKey}
                    value={justValue(factorKey)}
                    locked={locked}
                    onCommit={saveRationale}
                  />
                </tr>
              );
            })}

            <AddFactorRow
              options={addableFactors}
              locked={locked || saving}
              colSpan={3 + adopted.length}
              onAdd={(factorKey, labelAr) =>
                void dispatch({ type: "add-factor", factorKey, labelAr })
              }
              onAddCustom={() =>
                void dispatch({
                  type: "add-factor",
                  factorKey: nextCustomFactorKey(differenceKeys),
                  labelAr: CUSTOM_FACTOR_LABEL,
                })
              }
            />

            {/* Sum */}
            <tr className="bg-surface-2">
              <LabelCell
                label="مجموع نسب التسويات"
                hint="الصافي بإشاراته"
                tip="مجموع تسوية المساحة وعوامل الاختلاف. تجاوز ±40٪ يستلزم مبرراً موثقاً ومراجعة صلاحية المقارن."
                locked={locked}
              />
              <SubjCell value="أساس المقارنة" note="صفر بالتعريف" />
              {adopted.map((item) => {
                const sum = item.market?.sumDifferencePct ?? 0;
                // The server's ±40٪ rule (MarketApproachRules.LargeAdjustmentThresholdPct).
                const over = item.market?.exceedsLargeAdjustmentThreshold === true;
                return (
                  <CompReadonly
                    key={item.id}
                    value={pct(sum)}
                    valueClassName={over ? "text-danger-text" : pctClass(sum)}
                    note={over ? "التبرير إلزامي" : undefined}
                  />
                );
              })}
              <JustCell />
            </tr>

            {/* After difference factors */}
            <tr>
              <LabelCell
                label="القيمة بعد ضبط عوامل الاختلاف"
                hint={isUnit ? "ر.س/م²" : "ر.س — قيمة العقار"}
                tip="السعر التسلسلي × (1 + مجموع نسب التسويات)."
                locked={locked}
              />
              <SubjCell value="—" />
              {adopted.map((item) => (
                <CompReadonly
                  key={item.id}
                  value={fmt(item.market?.pricePerSqmAfterDifference)}
                />
              ))}
              <JustCell />
            </tr>

            {/* Weight */}
            <tr>
              <LabelCell
                label="الوزن النسبي"
                hint="مقترح آلياً · قابل للتعديل"
                tip="المقارن الذي مجموع نسب تسوياته أقرب إلى الصفر يأخذ الوزن الأكبر."
                locked={locked}
              />
              <SubjCell value="—" />
              {adopted.map((item) => {
                const manual = item.market?.weightIsManual;
                const display = String(
                  manual
                    ? (item.market?.weightPct ??
                        item.market?.effectiveWeightPct ??
                        "")
                    : (item.market?.suggestedWeightPct ??
                        item.market?.effectiveWeightPct ??
                        ""),
                );
                return (
                  <WeightCell
                    key={item.id}
                    value={display}
                    manual={manual}
                    suggestedNote={`مقترح ${item.market?.suggestedWeightPct ?? "—"}%`}
                    locked={locked}
                    onCommit={(raw) =>
                      dispatch({
                        type: "save-weight",
                        item,
                        rawPct: raw,
                        // Last committed justification — the cell draft commits itself on blur.
                        weightRationale: justValue("weight"),
                      })
                    }
                  />
                );
              })}
              <JustCell
                factorKey="weight"
                value={justValue("weight")}
                locked={locked}
                onCommit={saveRationale}
              />
            </tr>

            {/* After weight */}
            <tr className="bg-surface-2">
              <LabelCell
                label="القيمة بعد الوزن النسبي"
                hint={isUnit ? "ر.س/م²" : "ر.س — قيمة العقار"}
                tip="القيمة بعد التسويات × الوزن."
                locked={locked}
              />
              <SubjCell value="—" />
              {adopted.map((item) => (
                <CompReadonly key={item.id} value={fmt(afterWeightValue(item))} />
              ))}
              <JustCell />
            </tr>
          </tbody>
        </Table>
      </div>
      ) : null}

      <MatrixOutputsPanel
        basisView={basisView}
        weightedPricePerSqm={selection.weightedPricePerSqm}
      />

      {children}

      <MatrixAlertsPanel alerts={alerts} />

    </div>
  );
});
