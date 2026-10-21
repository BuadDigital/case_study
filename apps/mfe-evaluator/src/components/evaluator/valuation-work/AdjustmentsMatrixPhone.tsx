"use client";

import type { ReactNode } from "react";
import {
  MobileRecordCard,
  MobileRecordList,
  cn,
  opsWorkCard,
} from "@platform/ui-kit";
import type { ValuationComparableSelectionDto } from "@platform/api-client";
import { parseLocaleNumber } from "@platform/app-shared/format/number";

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
  CompInput,
  JustCell,
  WeightCell,
  effArea,
  effPrice,
  effUnit,
  noteClass,
  pct,
  pctClass,
} from "./AdjustmentsMatrixCells";
import {
  AddFactorControls,
  InlineDraftInput,
  LabelCell,
} from "./AdjustmentsMatrixFactorCells";
import type { useAdjustmentsMatrixModel } from "./useAdjustmentsMatrixModel";

/**
 * Phone layout of the adjustments matrix. The desktop grid puts comparables in
 * columns and factors in rows (min 1100px); here:
 *  1. the basis picker,
 *  2. one «بنود التسوية» card — the row-level controls (include, delete, the
 *     subject's value, the factor's justification, add a factor),
 *  3. one card per comparable listing every factor with its editable %, then
 *     the computed totals and the weight.
 * Every cell reuses the table's own cell in `touch` mode, so drafts and
 * commits behave exactly as in the table.
 */

type MatrixModel = ReturnType<typeof useAdjustmentsMatrixModel>;

export type AdjustmentsMatrixPhoneProps = {
  adopted: ValuationComparableSelectionDto[];
  locked: boolean;
  saving: boolean;
  subjectArea: string;
  idealArea: string;
  city?: string;
  district?: string;
  valuationDate?: string;
  subjectSpecs?: Record<string, string>;
  canEditSubjectSpec?: boolean;
  dispatch: MatrixDispatch;
  model: MatrixModel;
  className?: string;
};

const sectionTitleClass = "m-0 mb-2 text-[13px] font-bold text-heading";
const factorBlockClass =
  "border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0";
const slotLabelClass = "mb-1 text-[11.5px] font-semibold text-text-2";

/** Label above one comparable's full-width input. */
function PhoneSlot({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className={slotLabelClass}>{label}</div>
      {children}
    </div>
  );
}

/** One computed (read-only) line of a comparable card. */
function PhoneTotal({
  label,
  value,
  note,
  valueClassName = "text-heading",
  strong,
}: {
  label: string;
  value: string;
  note?: string;
  valueClassName?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 py-2",
        strong && "rounded-[9px] bg-surface-2 px-3",
      )}
    >
      <div className="min-w-0 text-[12px] font-semibold text-text-2">
        {label}
        {note ? <div className={noteClass}>{note}</div> : null}
      </div>
      <bdi
        dir="ltr"
        className={cn(
          "shrink-0 whitespace-nowrap font-[Tajawal,sans-serif] text-[15px] font-extrabold tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </bdi>
    </div>
  );
}

/** Subject-property column of a factor — read-only text or the editable description. */
function SubjectLine({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-2 rounded-[9px] bg-gold-soft px-3 py-2">
      <div className="text-[11px] font-medium text-gold-d">{label}</div>
      <div className="mt-0.5 text-[13px] font-bold text-gold-d">{children}</div>
    </div>
  );
}

export function AdjustmentsMatrixPhone({
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
  model,
  className,
}: AdjustmentsMatrixPhoneProps) {
  const {
    confirmDelete,
    setConfirmDelete,
    saveRationale,
    lineOf,
    linePct,
    justValue,
    basisView,
    sequentialKeys,
    differenceKeys,
    addableFactors,
  } = model;
  const { isUnit, areaMethod, areaFactor } = basisView;
  const first = adopted[0]!;

  const factorHead = (factorKey: string) => ({
    desc: factorDescriptor(factorKey),
    meta: factorMeta(factorKey, lineOf(first, factorKey)?.labelAr),
    included: lineIsIncluded(lineOf(first, factorKey), factorKey),
  });
  const toggle = (factorKey: string) =>
    void dispatch({ type: "toggle-included", item: first, factorKey });

  return (
    <div className={cn("flex min-w-0 flex-col gap-3.5", className)}>
      {/* 1 · Basis */}
      <section className={opsWorkCard}>
        <h3 className={sectionTitleClass}>أساس التسويات</h3>
        <div
          role="radiogroup"
          aria-label="أساس التسويات"
          className="flex gap-1 rounded-[12px] border border-border bg-surface-2 p-1"
        >
          {(
            [
              ["whole_property", "قيمة العقار المقارن", false],
              ["price_per_sqm", "سعر متر المقارن", true],
            ] as const
          ).map(([basis, label, unit]) => {
            const on = isUnit === unit;
            return (
              <button
                key={basis}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={locked}
                onClick={() => void dispatch({ type: "change-basis", basis })}
                className={cn(
                  "min-h-11 flex-1 rounded-[9px] px-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed",
                  on
                    ? "bg-ink text-white shadow-sm"
                    : "text-text-2 active:bg-row-hover",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="m-0 mt-2 text-[11.5px] leading-relaxed text-text-3">
          {isUnit
            ? "ر.س/م² — سعر المتر يُضرب في مساحة العقار آخر المطاف"
            : "إجمالي الصفقة (ر.س) — التسويات على قيمة العقار كاملة"}
        </p>
      </section>

      {/* 2 · Factor-level controls (the table's label, subject and justification columns) */}
      <section className={opsWorkCard}>
        <h3 className={sectionTitleClass}>بنود التسوية</h3>

        {sequentialKeys.map((factorKey) => {
          const { desc, meta, included } = factorHead(factorKey);
          const deletable = desc?.deletable === true;
          return (
            <div key={factorKey} className={factorBlockClass}>
              <LabelCell
                touch
                label={meta.label}
                hint={meta.hint}
                tip={meta.tip}
                locked={locked}
                removable={deletable}
                included={included}
                onToggle={() => toggle(factorKey)}
                offNote={included ? undefined : "غير محتسب في السعر التسلسلي"}
                deleteKey={deletable ? factorKey : undefined}
                confirmDelete={confirmDelete}
                onConfirmDelete={setConfirmDelete}
                onDelete={
                  deletable
                    ? () =>
                        void dispatch({ type: "remove-sequential", factorKey })
                    : undefined
                }
              />
              {desc?.subjectCell === "valuation-date" ? (
                <SubjectLine label="العقار محل التقييم">
                  تاريخ التقييم{" "}
                  {valuationDate ? <bdi dir="ltr">{valuationDate}</bdi> : null}
                </SubjectLine>
              ) : null}
              <JustCell
                touch
                className="mt-2"
                factorKey={factorKey}
                value={justValue(factorKey)}
                locked={locked}
                onCommit={saveRationale}
              />
            </div>
          );
        })}

        <div className={factorBlockClass}>
          <LabelCell
            touch
            label={factorMeta(AUTO_AREA_KEY).label}
            hint={areaMethod}
            tip={factorMeta(AUTO_AREA_KEY).tip}
            locked={locked}
            areaFactor={areaFactor}
            onAreaFactorChange={(value) =>
              dispatch({ type: "area-factor-change", value })
            }
          />
          <SubjectLine label="مساحة أرض العقار محل التقييم">
            <bdi dir="ltr">{fmt(parseLocaleNumber(subjectArea) || null)}</bdi>{" "}
            م²
          </SubjectLine>
          <JustCell
            touch
            className="mt-2"
            factorKey={AUTO_AREA_KEY}
            value={justValue(AUTO_AREA_KEY)}
            locked={locked}
            onCommit={saveRationale}
          />
        </div>

        {differenceKeys.map((factorKey) => {
          const { desc, meta, included } = factorHead(factorKey);
          const subjEditable =
            factorHasSpecCell(factorKey) &&
            !desc?.subjectCell &&
            !!canEditSubjectSpec;
          let subject: ReactNode = null;
          if (desc?.subjectCell === "ideal-area") {
            subject = (
              <SubjectLine label="المساحة السائدة في الحي">
                <bdi dir="ltr">
                  {fmt(
                    parseLocaleNumber(idealArea) ||
                      parseLocaleNumber(subjectArea) ||
                      null,
                  )}
                </bdi>{" "}
                م²
              </SubjectLine>
            );
          } else if (desc?.subjectCell === "location") {
            subject = (
              <SubjectLine label="موقع العقار محل التقييم">
                {district || "—"}
                {city ? ` · ${city}` : ""}
              </SubjectLine>
            );
          } else if (subjEditable) {
            subject = (
              <label className="mt-2 block">
                <span className={cn(slotLabelClass, "block")}>
                  وصف العقار محل التقييم
                </span>
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
                  className="min-h-11 w-full rounded-[9px] border border-dashed border-border-md bg-surface px-3 text-[16px] font-bold text-gold-d"
                />
              </label>
            );
          }
          return (
            <div key={factorKey} className={factorBlockClass}>
              <LabelCell
                touch
                label={meta.label}
                hint={meta.hint}
                tip={meta.tip}
                locked={locked}
                removable
                included={included}
                onToggle={() => toggle(factorKey)}
                offNote={included ? undefined : "غير محتسب في المجموع"}
                deleteKey={factorKey}
                confirmDelete={confirmDelete}
                onConfirmDelete={setConfirmDelete}
                onDelete={() =>
                  void dispatch({ type: "remove-factor", factorKey })
                }
              />
              {subject}
              <JustCell
                touch
                className="mt-2"
                factorKey={factorKey}
                value={justValue(factorKey)}
                locked={locked}
                onCommit={saveRationale}
              />
            </div>
          );
        })}

        <div className={factorBlockClass}>
          <AddFactorControls
            touch
            options={addableFactors}
            locked={locked || saving}
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
        </div>

        <div className={factorBlockClass}>
          <div className="text-[12.5px] font-bold text-heading">
            مبرر الوزن النسبي
          </div>
          <div className="mt-px text-[10.5px] text-text-3">
            المقارن الذي مجموع نسب تسوياته أقرب إلى الصفر يأخذ الوزن الأكبر.
          </div>
          <JustCell
            touch
            className="mt-2"
            factorKey="weight"
            value={justValue("weight")}
            locked={locked}
            onCommit={saveRationale}
          />
        </div>
      </section>

      {/* 3 · One card per adopted comparable */}
      <MobileRecordList>
        {adopted.map((item) => {
          const areaAdj = item.market?.suggestedAreaAdjustmentPct ?? 0;
          const sum = item.market?.sumDifferencePct ?? 0;
          const over = Math.abs(sum) > 35;
          const manual = item.market?.weightIsManual;
          const weightDisplay = String(
            manual
              ? (item.market?.weightPct ??
                  item.market?.effectiveWeightPct ??
                  "")
              : (item.market?.suggestedWeightPct ??
                  item.market?.effectiveWeightPct ??
                  ""),
          );
          return (
            <MobileRecordCard
              key={item.id}
              tone={over ? "red" : "gold"}
              title={<bdi dir="ltr">{item.comparable.referenceCode}</bdi>}
              subtitle={item.comparable.transactionKindLabelAr}
              fields={[
                {
                  label: isUnit
                    ? "قيمة العقار المقارن"
                    : "قيمة العقار المقارن · الأساس",
                  value: fmt(effPrice(item)),
                  ltr: true,
                },
                {
                  label: isUnit
                    ? "سعر متر المقارن · الأساس"
                    : "سعر متر المقارن",
                  value: fmt(effUnit(item)),
                  ltr: true,
                },
                {
                  label: "تاريخ الصفقة",
                  value: item.comparable.transactionDate,
                  ltr: true,
                },
                {
                  label: "مساحة المقارن",
                  value: `${fmt(effArea(item))} م²`,
                  ltr: true,
                },
              ]}
            >
              <div className="flex flex-col gap-3">
                {sequentialKeys.map((factorKey) => {
                  const { desc, meta } = factorHead(factorKey);
                  const included2 = lineIsIncluded(
                    lineOf(item, factorKey),
                    factorKey,
                  );
                  return (
                    <PhoneSlot key={factorKey} label={`${meta.label} (٪)`}>
                      <CompInput
                        touch
                        cellKey={`${item.id}:${factorKey}`}
                        value={String(linePct(item, factorKey))}
                        disabled={locked || !included2}
                        muted={!included2}
                        note={
                          desc?.compNote === "deal-age"
                            ? `عمر الصفقة ${item.market?.dealAgeMonths ?? "—"} شهراً`
                            : desc?.compNote === "kind-suggested"
                              ? item.comparable.transactionKindLabelAr
                              : undefined
                        }
                        onCommit={
                          included2
                            ? (_key, raw) =>
                                dispatch({
                                  type: "save-cell",
                                  item,
                                  factorKey,
                                  raw,
                                })
                            : undefined
                        }
                      />
                    </PhoneSlot>
                  );
                })}

                <PhoneTotal
                  strong
                  label="السعر بعد تسوية ظروف السوق"
                  value={fmt(item.market?.pricePerSqmAfterSequential)}
                />

                <PhoneTotal
                  label={factorMeta(AUTO_AREA_KEY).label}
                  value={pct(areaAdj)}
                  valueClassName={pctClass(areaAdj)}
                  note={areaMethod}
                />

                {differenceKeys.map((factorKey) => {
                  const { desc, meta, included } = factorHead(factorKey);
                  const line = lineOf(item, factorKey);
                  const cellKey = `${item.id}:${factorKey}`;
                  return (
                    <PhoneSlot key={factorKey} label={`${meta.label} (٪)`}>
                      <CompInput
                        touch
                        cellKey={cellKey}
                        value={String(linePct(item, factorKey))}
                        disabled={locked || !included}
                        muted={!included}
                        onCommit={
                          included
                            ? (_key, raw) =>
                                dispatch({
                                  type: "save-cell",
                                  item,
                                  factorKey,
                                  raw,
                                })
                            : undefined
                        }
                        note={
                          desc?.subjectCell === "location"
                            ? `${item.comparable.district || "—"} · ${city || ""}`
                            : undefined
                        }
                        extra={
                          factorHasSpecCell(factorKey) ? (
                            <InlineDraftInput
                              key={`${cellKey}:desc`}
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
                              className="mt-1.5 block min-h-11 w-full rounded-[9px] border border-dashed border-border bg-surface px-3 text-[16px] font-medium text-text-2"
                            />
                          ) : null
                        }
                      />
                    </PhoneSlot>
                  );
                })}

                <div className="border-t border-border pt-1">
                  <PhoneTotal
                    label="مجموع نسب التسويات"
                    value={pct(sum)}
                    valueClassName={over ? "text-danger-text" : pctClass(sum)}
                    note={over ? "التبرير إلزامي" : "الصافي بإشاراته"}
                  />
                  <PhoneTotal
                    label="القيمة بعد ضبط عوامل الاختلاف"
                    note={isUnit ? "ر.س/م²" : "ر.س — قيمة العقار"}
                    value={fmt(item.market?.pricePerSqmAfterDifference)}
                  />
                </div>

                <PhoneSlot label="الوزن النسبي (٪) · مقترح آلياً وقابل للتعديل">
                  <WeightCell
                    touch
                    value={weightDisplay}
                    manual={manual}
                    suggestedNote={`مقترح ${item.market?.suggestedWeightPct ?? "—"}%`}
                    locked={locked}
                    onCommit={(raw) =>
                      dispatch({
                        type: "save-weight",
                        item,
                        rawPct: raw,
                        weightRationale: justValue("weight"),
                      })
                    }
                  />
                </PhoneSlot>

                <PhoneTotal
                  strong
                  label="القيمة بعد الوزن النسبي"
                  note={isUnit ? "ر.س/م²" : "ر.س — قيمة العقار"}
                  value={fmt(afterWeightValue(item))}
                />
              </div>
            </MobileRecordCard>
          );
        })}
      </MobileRecordList>
    </div>
  );
}
