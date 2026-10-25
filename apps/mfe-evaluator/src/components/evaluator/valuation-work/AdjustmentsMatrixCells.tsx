"use client";

import type { ReactNode } from "react";
import type { ValuationComparableSelectionDto } from "@platform/api-client";
import { cn } from "@platform/ui-kit";
import type { factorDescriptor } from "./lib/factor-registry";
import type { MatrixDispatch } from "./lib/matrix-actions";
import {
  pct,
  pctClass,
  effPrice,
  effUnit,
  effArea,
  thBandClass,
  thCompBaseClass,
  thCompClass,
  tdLabelClass,
  tdSubjClass,
  tdCellClass,
  tdJustClass,
  noteClass,
  cellInputBaseClass,
  cellInputTouchClass,
  panelCardClass,
} from "./AdjustmentsMatrixCells.styles";
import { useMatrixCellDraft } from "./useMatrixCellDraft";

export {
  pct,
  pctClass,
  effPrice,
  effUnit,
  effArea,
  thBandClass,
  thCompBaseClass,
  thCompClass,
  tdLabelClass,
  tdSubjClass,
  tdCellClass,
  tdJustClass,
  noteClass,
  cellInputBaseClass,
  cellInputTouchClass,
  panelCardClass,
};

/**
 * Presentational pieces of the adjustments matrix — the percentage formatters,
 * the shared cell classes and every table cell. Each cell owns its own draft so
 * a keystroke re-renders one cell, not the ~120-component table
 * (rerender-defer-reads). No data fetching, no matrix rules.
 */

/**
 * `touch` — the same cell for the phone cards: a `<div>` (with `className`)
 * instead of a `<td>`, full-width inputs and 44px buttons. Same draft/commit
 * logic, so a phone edit saves exactly like a table edit.
 */
export type TouchProps = { touch?: boolean; className?: string };

/* ─── Module-level cell components —
   Defining them inside the parent remounts them on every render
   (lost input focus + noticeable lag) — rerender-no-inline-components. ─── */

export function SubjCell({ value, note }: { value: string; note?: string }) {
  return (
    <td className={tdSubjClass}>
      <span className="text-[12.5px] font-bold text-gold-d">{value}</span>
      {note ? <div className={noteClass}>{note}</div> : null}
    </td>
  );
}

/** One justification covering every comparable in the row. Draft lives in the cell. */
export function JustCell({
  factorKey,
  value,
  locked,
  onCommit,
  touch,
  className,
}: TouchProps & {
  factorKey?: string;
  value?: string;
  locked?: boolean;
  /** Commits while typing (debounced) and on Tab/blur; returning false keeps the draft (save failed). */
  onCommit?: (factorKey: string, text: string) => Promise<boolean> | void;
}) {
  const { text, change, flush, onKeyDown } = useMatrixCellDraft(
    value ?? "",
    factorKey && onCommit ? (raw) => onCommit(factorKey, raw) : undefined,
  );

  if (!factorKey || !onCommit) {
    return touch ? null : <td className={tdJustClass} />;
  }
  const Wrap = touch ? "div" : "td";
  return (
    <Wrap className={touch ? className : tdJustClass}>
      <input
        type="text"
        value={text}
        disabled={locked}
        placeholder="مبرر عامل التسوية"
        onChange={(e) => change(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={flush}
        className={cn(
          "w-full rounded-[7px] border border-border bg-surface px-2.5 py-[7px] font-medium text-text",
          touch ? "min-h-11 text-[16px]" : "text-[12px]",
        )}
      />
    </Wrap>
  );
}

export function CompReadonly({
  value,
  note,
  valueClassName = "text-heading",
}: {
  value: string;
  note?: string;
  valueClassName?: string;
}) {
  return (
    <td className={tdCellClass}>
      <span
        dir="ltr"
        className={cn(
          "font-[Tajawal,sans-serif] text-[14px] font-extrabold",
          valueClassName,
        )}
      >
        {value}
      </span>
      {note ? <div className={noteClass}>{note}</div> : null}
    </td>
  );
}

export function CompInput({
  cellKey,
  value,
  disabled,
  muted,
  auto,
  note,
  extra,
  onCommit,
  touch,
  className,
}: TouchProps & {
  cellKey: string;
  value: string;
  disabled: boolean;
  muted: boolean;
  auto?: boolean;
  note?: string;
  extra?: ReactNode;
  /** Commits while typing (debounced) and on Tab/blur; returning false keeps the draft. */
  onCommit?: (key: string, raw: string) => Promise<boolean> | void;
}) {
  const { text, change, flush, onKeyDown } = useMatrixCellDraft(
    value,
    onCommit ? (raw) => onCommit(cellKey, raw) : undefined,
  );

  const Wrap = touch ? "div" : "td";
  return (
    <Wrap className={touch ? className : tdCellClass}>
      <input
        dir="ltr"
        inputMode="decimal"
        enterKeyHint="next"
        type="text"
        disabled={disabled}
        value={text}
        onChange={(e) => change(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={flush}
        className={cn(
          touch ? cellInputTouchClass : cellInputBaseClass,
          muted || auto
            ? "border-border text-gold-d"
            : "border-border-md text-heading",
          muted || disabled ? "bg-surface-2" : "bg-surface",
        )}
      />
      {note ? <div className={noteClass}>{note}</div> : null}
      {extra}
    </Wrap>
  );
}

/**
 * A comparable's percentage on one factor row (table cell or phone field). Saves through the
 * matrix dispatch; read-only and muted while the factor is excluded.
 */
export function FactorPctInput({
  item,
  factorKey,
  value,
  included,
  locked,
  dispatch,
  note,
  extra,
  touch,
}: {
  touch?: boolean;
  item: ValuationComparableSelectionDto;
  factorKey: string;
  value: number;
  included: boolean;
  locked: boolean;
  dispatch: MatrixDispatch;
  note?: string;
  extra?: ReactNode;
}) {
  return (
    <CompInput
      touch={touch}
      cellKey={`${item.id}:${factorKey}`}
      value={String(value)}
      disabled={locked || !included}
      muted={!included}
      note={note}
      extra={extra}
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
    />
  );
}

/** Note under a market-conditions cell: the deal's age, or the comparable's transaction kind. */
export function sequentialCompNote(
  desc: ReturnType<typeof factorDescriptor>,
  item: ValuationComparableSelectionDto,
): string | undefined {
  if (desc?.compNote === "deal-age") return `عمر الصفقة ${item.market?.dealAgeMonths ?? "—"} شهراً`;
  if (desc?.compNote === "kind-suggested") return item.comparable.transactionKindLabelAr;
  return undefined;
}

/** Relative-weight cell with its local draft — same blur-commit contract. */
export function WeightCell({
  value,
  manual,
  suggestedNote,
  locked,
  onCommit,
  touch,
  className,
}: TouchProps & {
  value: string;
  manual: boolean | undefined;
  suggestedNote: string;
  locked: boolean;
  onCommit: (raw: string) => Promise<boolean> | void;
}) {
  const { text, change, flush, onKeyDown } = useMatrixCellDraft(value, onCommit);

  const Wrap = touch ? "div" : "td";
  return (
    <Wrap className={touch ? className : tdCellClass}>
      <input
        dir="ltr"
        inputMode="decimal"
        enterKeyHint="next"
        type="text"
        disabled={locked}
        value={text}
        onChange={(e) => change(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={flush}
        className={cn(
          touch ? cellInputTouchClass : cellInputBaseClass,
          manual
            ? "border-border-md bg-surface text-heading"
            : "border-border bg-surface-2 text-gold-d",
        )}
      />
      <div className={noteClass}>{manual ? "تجاوز يدوي" : suggestedNote}</div>
    </Wrap>
  );
}
