"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@platform/ui-kit";
import {
  COMMIT_MS,
  commitKeys,
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
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);
  const committed = value ?? "";
  const text = draft ?? committed;

  function clearTimer() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function flush() {
    const raw = pending.current;
    pending.current = null;
    clearTimer();
    if (raw == null || !factorKey || !onCommit) return;
    if (raw === committed) {
      setDraft(null);
      return;
    }
    void Promise.resolve(onCommit(factorKey, raw)).then((ok) => {
      if (ok !== false) setDraft((d) => (d === raw ? null : d));
    });
  }

  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

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
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          pending.current = raw;
          clearTimer();
          timer.current = setTimeout(flush, COMMIT_MS);
        }}
        onKeyDown={(e) =>
          commitKeys(e, flush, () => {
            pending.current = null;
            clearTimer();
            setDraft(null);
          })
        }
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
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);

  function clearTimer() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function flush() {
    const raw = pending.current;
    pending.current = null;
    clearTimer();
    if (raw == null) return;
    if (raw === value || !onCommit) {
      setDraft(null);
      return;
    }
    void Promise.resolve(onCommit(cellKey, raw)).then((ok) => {
      if (ok !== false) setDraft((d) => (d === raw ? null : d));
    });
  }

  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  const Wrap = touch ? "div" : "td";
  return (
    <Wrap className={touch ? className : tdCellClass}>
      <input
        dir="ltr"
        inputMode="decimal"
        enterKeyHint="next"
        type="text"
        disabled={disabled}
        value={draft ?? value}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          pending.current = raw;
          clearTimer();
          timer.current = setTimeout(flush, COMMIT_MS);
        }}
        onKeyDown={(e) =>
          commitKeys(e, flush, () => {
            pending.current = null;
            clearTimer();
            setDraft(null);
          })
        }
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
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);

  function clearTimer() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function flush() {
    const raw = pending.current;
    pending.current = null;
    clearTimer();
    if (raw == null) return;
    if (raw === value) {
      setDraft(null);
      return;
    }
    void Promise.resolve(onCommit(raw)).then((ok) => {
      if (ok !== false) setDraft((d) => (d === raw ? null : d));
    });
  }

  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  const Wrap = touch ? "div" : "td";
  return (
    <Wrap className={touch ? className : tdCellClass}>
      <input
        dir="ltr"
        inputMode="decimal"
        enterKeyHint="next"
        type="text"
        disabled={locked}
        value={draft ?? value}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          pending.current = raw;
          clearTimer();
          timer.current = setTimeout(flush, COMMIT_MS);
        }}
        onKeyDown={(e) =>
          commitKeys(e, flush, () => {
            pending.current = null;
            clearTimer();
            setDraft(null);
          })
        }
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
