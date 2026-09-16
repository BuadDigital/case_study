"use client";

import { useEffect, useRef, useState } from "react";
import type { ComparablePropertyDto, ValuationComparableSelectionDto } from "@platform/api-client";
import { Td, TdLtr, cn } from "@platform/ui-kit";
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

export function ComparablesBankMoneyCells({
  item,
  comp,
  subjectSqm,
  onSaveOverride,
}: {
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

  function flush() {
    const next = pending.current;
    pending.current = null;
    clearTimer();
    if (!next) return;
    void onSaveOverride(item, next.field, next.raw).then((ok) => {
      if (!ok) return;
      if (next.field === "price") {
        setPriceDraft(null);
        setUnitDraft(null);
      } else {
        setAreaDraft(null);
      }
    });
  }

  function schedule(field: "price" | "area", raw: string) {
    if (pending.current && pending.current.field !== field) {
      const prev = pending.current;
      pending.current = { field, raw };
      clearTimer();
      void onSaveOverride(item, prev.field, prev.raw).then((ok) => {
        if (!ok) return;
        if (prev.field === "price") {
          setPriceDraft(null);
          setUnitDraft(null);
        } else {
          setAreaDraft(null);
        }
      });
      timer.current = setTimeout(flush, COMMIT_MS);
      return;
    }
    pending.current = { field, raw };
    clearTimer();
    timer.current = setTimeout(flush, COMMIT_MS);
  }

  useEffect(() => () => clearTimer(), []);

  return (
    <>
      <Td className="bg-gold-soft text-center">
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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              flush();
              e.currentTarget.blur();
            } else if (e.key === "Tab") {
              flush();
            }
          }}
          className={cn(
            inputClass,
            "w-[96px] text-[14px] font-extrabold",
            item.priceOverrideSar != null
              ? "border-border-md bg-surface text-heading"
              : "border-border bg-surface-2 text-heading",
          )}
        />
      </Td>
      <Td className="text-center">
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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              flush();
              e.currentTarget.blur();
            } else if (e.key === "Tab") {
              flush();
            }
          }}
          className={cn(
            inputClass,
            "w-[104px] text-[13.5px] font-extrabold",
            item.priceOverrideSar != null
              ? "border-border-md bg-surface text-heading"
              : "border-border bg-surface-2 text-text-2",
          )}
        />
      </Td>
      <Td className="text-center">
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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              flush();
              e.currentTarget.blur();
            } else if (e.key === "Tab") {
              flush();
            }
          }}
          className={cn(
            inputClass,
            "w-[84px]",
            item.areaOverrideSqm != null
              ? "border-border-md bg-surface text-heading"
              : "border-border bg-surface-2 text-text-2",
          )}
        />
      </Td>
      <TdLtr
        bare
        className={cn(
          "text-center text-[13.5px] font-bold",
          ratio != null && ratio >= 2 ? "text-red-text" : "text-heading",
        )}
        title={
          ratio != null && ratio >= 2
            ? "نسبة ≥ ٢ — تُفعِّل طريقة المضاعف على الجدول كاملاً"
            : undefined
        }
      >
        {areaRatio(subjectSqm, live.area)}
      </TdLtr>
    </>
  );
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
