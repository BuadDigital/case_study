"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@platform/ui-kit";
import {
  buildGregorianMonthGrid,
  buildHijriMonthGrid,
  convertDualCalendarDate,
  dualCalendarMonthLabel,
  dualCalendarViewAnchor,
  dualCalendarYearLabel,
  listDualCalendarYears,
  normalizeDualCalendarView,
  sameDualCalendarDate,
  stepDualCalendarMonth,
  todayDualCalendarParts,
  type DualCalendarDateParts,
  type DualCalendarKind,
} from "../../lib/prototype/dual-calendar-date";

const WEEKDAY_HEADERS = ["س", "ح", "ن", "ث", "ر", "خ", "ج"] as const;

function CalendarKindToggle({
  calendar,
  onChange,
}: {
  calendar: DualCalendarKind;
  onChange: (kind: DualCalendarKind) => void;
}) {
  return (
    <div
      className="mb-2.5 flex rounded-full border border-border-md bg-[color-mix(in_srgb,var(--text-3)_8%,transparent)] p-0.5"
      role="group"
      aria-label="نوع التقويم"
    >
      {(["gregorian", "hijri"] as const).map((kind) => {
        const on = calendar === kind;
        return (
          <button
            key={kind}
            type="button"
            className={cn(
              "flex-1 rounded-full px-2 py-1 font-inherit text-[10.5px] font-semibold transition-colors",
              on
                ? "bg-ink text-white shadow-sm"
                : "text-text-2 hover:text-heading",
            )}
            aria-pressed={on}
            onClick={() => {
              if (!on) onChange(kind);
            }}
          >
            {kind === "gregorian" ? "ميلادي" : "هجري"}
          </button>
        );
      })}
    </div>
  );
}

export function DualCalendarPickerPanel({
  selected,
  calendar,
  onCalendarChange,
  onSelect,
}: {
  selected: DualCalendarDateParts | null;
  calendar: DualCalendarKind;
  onCalendarChange: (kind: DualCalendarKind) => void;
  onSelect: (parts: DualCalendarDateParts) => void;
}) {
  const anchor = useMemo(
    () => dualCalendarViewAnchor(calendar, selected),
    [selected, calendar],
  );
  const [viewYear, setViewYear] = useState(anchor.year);
  const [viewMonth, setViewMonth] = useState(anchor.month);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const selectedYearRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const next = normalizeDualCalendarView(
      calendar,
      anchor.year,
      anchor.month,
      selected,
    );
    setViewYear(next.year);
    setViewMonth(next.month);
    setYearPickerOpen(false);
  }, [anchor.year, anchor.month, calendar, selected]);

  useEffect(() => {
    if (!yearPickerOpen) return;
    selectedYearRef.current?.scrollIntoView({ block: "nearest" });
  }, [yearPickerOpen, viewYear]);

  const today = useMemo(() => todayDualCalendarParts(calendar), [calendar]);
  const monthLabel = dualCalendarMonthLabel(calendar, viewYear, viewMonth);
  const yearLabel = dualCalendarYearLabel(calendar, viewYear);
  const yearOptions = useMemo(() => listDualCalendarYears(calendar), [calendar]);
  const grid = useMemo(
    () =>
      calendar === "gregorian"
        ? buildGregorianMonthGrid(viewYear, viewMonth)
        : buildHijriMonthGrid(viewYear, viewMonth),
    [calendar, viewYear, viewMonth],
  );

  const setView = (year: number, month: number) => {
    const next = normalizeDualCalendarView(calendar, year, month, selected);
    setViewYear(next.year);
    setViewMonth(next.month);
  };

  const shiftMonth = (delta: number) => {
    const next = stepDualCalendarMonth(calendar, viewYear, viewMonth, delta);
    setView(next.year, next.month);
  };

  const navButtonClass =
    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-md bg-surface text-[13px] font-bold text-text-2 hover:bg-[color-mix(in_srgb,var(--text-3)_10%,transparent)]";

  const handleCalendarKindChange = (kind: DualCalendarKind) => {
    onCalendarChange(kind);
    setYearPickerOpen(false);
    const converted = selected
      ? convertDualCalendarDate(selected, kind)
      : todayDualCalendarParts(kind);
    if (converted) {
      setView(converted.year, converted.month);
    }
  };

  return (
    <div
      className="w-[288px] max-w-[calc(100vw-1rem)] shrink-0 rounded-xl border border-border bg-surface p-3 shadow-[0_8px_28px_color-mix(in_srgb,var(--ink)_18%,transparent)]"
      role="dialog"
      aria-label="اختيار التاريخ"
    >
      <CalendarKindToggle calendar={calendar} onChange={handleCalendarKindChange} />

      <div className="mb-1.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1">
        <button
          type="button"
          className={navButtonClass}
          aria-label="الشهر السابق"
          onClick={() => shiftMonth(-1)}
        >
          ‹
        </button>
        <span className="truncate px-1 text-center text-[12px] font-bold text-heading">
          {monthLabel}
        </span>
        <button
          type="button"
          className={navButtonClass}
          aria-label="الشهر التالي"
          onClick={() => shiftMonth(1)}
        >
          ›
        </button>
      </div>

      <button
        type="button"
        className={cn(
          "mb-2 w-full rounded-md border px-2 py-1.5 font-inherit text-[12px] font-bold tabular-nums transition-colors [direction:ltr]",
          yearPickerOpen
            ? "border-gold bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] text-heading"
            : "border-border-md bg-surface text-heading hover:bg-[color-mix(in_srgb,var(--text-3)_8%,transparent)]",
        )}
        aria-expanded={yearPickerOpen}
        aria-label={`السنة: ${yearLabel}`}
        onClick={() => setYearPickerOpen((open) => !open)}
      >
        {yearLabel}
      </button>

      {yearPickerOpen ? (
        <div className="mb-1 max-h-[196px] overflow-y-auto rounded-lg border border-border-md bg-surface-2 p-1.5">
          <div className="grid grid-cols-4 gap-1">
            {yearOptions.map((year) => {
              const on = year === viewYear;
              return (
                <button
                  key={year}
                  ref={on ? selectedYearRef : undefined}
                  type="button"
                  className={cn(
                    "rounded-md px-1 py-1.5 text-[11px] font-semibold tabular-nums transition-colors",
                    on
                      ? "bg-ink text-white"
                      : "text-heading hover:bg-[color-mix(in_srgb,var(--text-3)_12%,transparent)]",
                  )}
                  onClick={() => {
                    setView(year, viewMonth);
                    setYearPickerOpen(false);
                  }}
                >
                  {year}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAY_HEADERS.map((label) => (
            <div
              key={label}
              className="py-1 text-[10px] font-bold text-text-3"
              aria-hidden
            >
              {label}
            </div>
          ))}
          {grid.map((cell, index) =>
            cell ? (
              <button
                key={`${cell.parts.year}-${cell.parts.month}-${cell.parts.day}-${index}`}
                type="button"
                className={cn(
                  "rounded-md py-1.5 text-[11px] font-semibold transition-colors",
                  sameDualCalendarDate(cell.parts, selected)
                    ? "bg-ink text-white"
                    : "text-heading hover:bg-[color-mix(in_srgb,var(--text-3)_12%,transparent)]",
                  sameDualCalendarDate(cell.parts, today) &&
                    !sameDualCalendarDate(cell.parts, selected) &&
                    "ring-1 ring-gold ring-inset",
                )}
                onClick={() => onSelect(cell.parts)}
              >
                {cell.day}
              </button>
            ) : (
              <div key={`empty-${index}`} aria-hidden />
            ),
          )}
        </div>
      )}
    </div>
  );
}
