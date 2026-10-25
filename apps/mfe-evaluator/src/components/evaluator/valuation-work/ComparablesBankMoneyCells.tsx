"use client";

import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { ComparablePropertyDto, ValuationComparableSelectionDto } from "@platform/api-client";
import { PhoneField, Td, TdLtr, cn } from "@platform/ui-kit";
import {
  areaRatio,
  areaRatioValue,
  liveBankMoney,
  roundMoney,
  sanitizeAmountInput,
} from "./lib/bank-ranking";
import { fmt } from "./lib/shell-utils";

const COMMIT_MS = 350;

const inputClass =
  "w-full rounded-md border px-2 py-1.5 text-center text-[13px] font-bold outline-none";
/** Phone card: full width, 44px tall, 16px so iOS never zooms on focus. */
const touchInputClass =
  "min-h-11 w-full rounded-[9px] border px-3 py-2 text-center text-[16px] font-extrabold outline-none";

/** A table cell, or — on the phone card — a labelled block holding the same input. */
function MoneySlot({
  touch,
  label,
  tdClassName,
  children,
}: {
  touch?: boolean;
  label: string;
  tdClassName: string;
  children: ReactNode;
}) {
  if (!touch) return <Td className={tdClassName}>{children}</Td>;
  return (
    <PhoneField as="label" label={label}>
      {children}
    </PhoneField>
  );
}

export function ComparablesBankMoneyCells({
  item,
  comp,
  subjectSqm,
  onSaveOverride,
  touch,
}: {
  /** Phone card: labelled full-width inputs in a 2-column grid instead of table cells. */
  touch?: boolean;
  item: ValuationComparableSelectionDto;
  comp: ComparablePropertyDto;
  subjectSqm: number | null;
  onSaveOverride: (
    item: ValuationComparableSelectionDto,
    field: "price" | "area",
    raw: string,
  ) => Promise<boolean>;
}) {
  const committedPrice = item.effectivePriceSar ?? comp.price;
  const committedArea = item.effectiveAreaSqm ?? comp.areaSqm;
  const [priceDraft, setPriceDraft] = useState<string | null>(null);
  const [areaDraft, setAreaDraft] = useState<string | null>(null);
  const [unitDraft, setUnitDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ field: "price" | "area"; raw: string } | null>(
    null,
  );

  const live = liveBankMoney({
    committedPrice,
    committedArea,
    priceDraft,
    areaDraft,
    unitDraft,
  });
  const ratio = areaRatioValue(subjectSqm, live.area);

  function clearTimer() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  /** Saves one override; once the server takes it, that field's drafts give way to the saved value. */
  function save(edit: { field: "price" | "area"; raw: string }) {
    void onSaveOverride(item, edit.field, edit.raw).then((ok) => {
      if (!ok) return;
      if (edit.field === "price") {
        setPriceDraft(null);
        setUnitDraft(null);
      } else {
        setAreaDraft(null);
      }
    });
  }

  function flush() {
    const next = pending.current;
    pending.current = null;
    clearTimer();
    if (!next) return;
    save(next);
  }

  /** Enter commits and leaves the field; Tab commits and moves on. */
  function commitOnKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      flush();
      e.currentTarget.blur();
    } else if (e.key === "Tab") {
      flush();
    }
  }

  function schedule(field: "price" | "area", raw: string) {
    if (pending.current && pending.current.field !== field) {
      const prev = pending.current;
      pending.current = { field, raw };
      clearTimer();
      save(prev);
      timer.current = setTimeout(flush, COMMIT_MS);
      return;
    }
    pending.current = { field, raw };
    clearTimer();
    timer.current = setTimeout(flush, COMMIT_MS);
  }

  const flushOnUnmount = useEffectEvent(flush);
  useEffect(() => () => flushOnUnmount(), []);

  const ratioWarn = ratio != null && ratio >= 2;
  const cells = (
    <>
      <MoneySlot touch={touch} label="سعر المتر" tdClassName="bg-gold-soft text-center">
        <input
          dir="ltr"
          inputMode="decimal"
          enterKeyHint="next"
          title="سعر المتر — يحسب سعر العقار تلقائياً"
          value={unitDraft ?? (live.unit != null ? String(live.unit) : "")}
          onChange={(e) => {
            const raw = sanitizeAmountInput(e.target.value);
            setUnitDraft(raw);
            const unit = Number(raw);
            const area = live.area;
            if (Number.isFinite(unit) && unit > 0 && area > 0) {
              schedule("price", String(roundMoney(unit * area)));
            }
          }}
          onBlur={flush}
          onKeyDown={commitOnKey}
          className={cn(
            touch ? touchInputClass : cn(inputClass, "w-[96px] text-[14px] font-extrabold"),
            item.priceOverrideSar != null
              ? "border-border-md bg-surface text-heading"
              : "border-border bg-surface-2 text-heading",
          )}
        />
      </MoneySlot>
      <MoneySlot touch={touch} label="سعر العقار" tdClassName="text-center">
        <input
          dir="ltr"
          inputMode="decimal"
          enterKeyHint="next"
          title="سعر العقار الإجمالي — تجاوز لهذا التقييم فقط، لا يمس بنك المقارنات"
          value={priceDraft ?? String(live.price)}
          onChange={(e) => {
            const raw = sanitizeAmountInput(e.target.value);
            setUnitDraft(null);
            setPriceDraft(raw);
            schedule("price", raw);
          }}
          onBlur={flush}
          onKeyDown={commitOnKey}
          className={cn(
            touch ? touchInputClass : cn(inputClass, "w-[104px] text-[13.5px] font-extrabold"),
            item.priceOverrideSar != null
              ? "border-border-md bg-surface text-heading"
              : "border-border bg-surface-2 text-text-2",
          )}
        />
      </MoneySlot>
      <MoneySlot touch={touch} label="المساحة (م²)" tdClassName="text-center">
        <input
          dir="ltr"
          inputMode="decimal"
          enterKeyHint="next"
          title="مساحة المقارن — تجاوز لهذا التقييم فقط"
          value={areaDraft ?? String(live.area)}
          onChange={(e) => {
            const raw = sanitizeAmountInput(e.target.value);
            setUnitDraft(null);
            setAreaDraft(raw);
            schedule("area", raw);
          }}
          onBlur={flush}
          onKeyDown={commitOnKey}
          className={cn(
            touch ? touchInputClass : cn(inputClass, "w-[84px]"),
            item.areaOverrideSqm != null
              ? "border-border-md bg-surface text-heading"
              : "border-border bg-surface-2 text-text-2",
          )}
        />
      </MoneySlot>
      {touch ? (
        <div className="min-w-0">
          <span className="mb-1 block text-[11px] font-medium text-text-3">نسبة المساحة</span>
          <bdi
            dir="ltr"
            className={cn(
              "flex min-h-11 items-center justify-center rounded-[9px] bg-surface-2 text-[15px] font-bold tabular-nums",
              ratioWarn ? "text-red-text" : "text-heading",
            )}
          >
            {areaRatio(subjectSqm, live.area)}
          </bdi>
          {ratioWarn ? (
            <span className="mt-1 block text-[10.5px] text-red-text">
              نسبة ≥ 2 — تُفعِّل طريقة المضاعف على الجدول كاملاً
            </span>
          ) : null}
        </div>
      ) : (
        <TdLtr
          bare
          className={cn(
            "text-center text-[13.5px] font-bold",
            ratioWarn ? "text-red-text" : "text-heading",
          )}
          title={
            ratioWarn
              ? "نسبة ≥ 2 — تُفعِّل طريقة المضاعف على الجدول كاملاً"
              : undefined
          }
        >
          {areaRatio(subjectSqm, live.area)}
        </TdLtr>
      )}
    </>
  );
  return touch ? <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">{cells}</div> : cells;
}

export function ComparablesBankMoneyReadOnly({
  comp,
  subjectSqm,
}: {
  comp: ComparablePropertyDto;
  subjectSqm: number | null;
}) {
  const ratio = areaRatioValue(subjectSqm, comp.areaSqm);
  return (
    <>
      <TdLtr
        className="bg-gold-soft text-center"
        valueClassName="text-[14px] font-extrabold text-heading"
      >
        {fmt(comp.pricePerSqm)}
      </TdLtr>
      <Td className="text-center">
        <span dir="ltr" className="text-[14px] font-extrabold text-heading">
          {fmt(comp.price)}
        </span>
      </Td>
      <TdLtr
        bare
        className="text-center text-[13.5px] font-bold text-text-2"
      >
        {fmt(comp.areaSqm)}
      </TdLtr>
      <TdLtr
        bare
        className={cn(
          "text-center text-[13.5px] font-bold",
          ratio != null && ratio >= 2 ? "text-red-text" : "text-heading",
        )}
      >
        {areaRatio(subjectSqm, comp.areaSqm)}
      </TdLtr>
    </>
  );
}
