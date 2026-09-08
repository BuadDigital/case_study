"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { cn, opsLetterCard } from "@platform/ui-kit";
import type { ValuationComparableSelectionDto } from "@platform/api-client";

/** Enter commits like blur does (same onBlur handler); Escape discards the field's own change. */
function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") {
    e.preventDefault();
    e.currentTarget.blur();
  }
}

/**
 * Presentational pieces of the adjustments matrix — the percentage formatters,
 * the shared cell classes and every table cell. Each cell owns its own draft so
 * a keystroke re-renders one cell, not the ~120-component table
 * (rerender-defer-reads). No data fetching, no matrix rules.
 */
export function pct(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(2)}%`;
}

export function pctClass(n: number): string {
  if (n > 0) return "text-[#2f7a4d]";
  if (n < 0) return "text-danger-text";
  return "text-text-2";
}

/** compEdit: effective comparable values after this valuation’s overrides. */
export function effPrice(item: ValuationComparableSelectionDto): number {
  return item.effectivePriceSar ?? item.comparable.price;
}
export function effUnit(item: ValuationComparableSelectionDto): number {
  return item.effectivePricePerSqm ?? item.comparable.pricePerSqm;
}
export function effArea(item: ValuationComparableSelectionDto): number {
  return item.effectiveAreaSqm ?? item.comparable.areaSqm;
}

/* ─── Module-level static classes — design-system tokens (brand + dark mode) via Tailwind ─── */
export const thBandClass =
  "border-b-2 border-b-gold bg-surface-2 px-4 py-[13px] text-start text-[12px] font-bold text-heading";
export const thCompBaseClass =
  "min-w-[126px] border-b-2 border-b-gold px-3 py-[11px] text-center text-[12px] font-bold text-heading";
export const thCompClass = cn(
  thCompBaseClass,
  "border-s border-s-border bg-surface-2",
);
export const tdLabelClass =
  "border-b border-border px-4 py-[9px] text-start align-top";
export const tdSubjClass =
  "min-w-[150px] border-x border-b border-border bg-surface-2 px-2.5 py-[7px] text-center align-middle";
export const tdCellClass =
  "border-b border-s border-border px-2.5 py-[7px] text-center align-middle";
export const tdJustClass =
  "min-w-[230px] border-b border-s border-border px-3 py-[7px] text-start align-middle";
export const noteClass = "mt-[3px] text-[10px] font-normal text-text-3";
export const cellInputBaseClass =
  "w-24 rounded-[7px] border px-2 py-[7px] text-center text-[13px] font-bold";
export const panelCardClass = cn(opsLetterCard, "mb-6");

/* ─── Module-level cell components —
   Defining them inside the parent remounts them on every render
   (lost input focus + noticeable lag) — rerender-no-inline-components. ─── */

export function LabelCell({
  label,
  hint,
  tip,
  definition,
  locked,
  pickable,
  picked,
  onPick,
  removable,
  included,
  onToggle,
  offNote,
  areaFactor,
  onAreaFactorChange,
  deleteKey,
  confirmDelete,
  onConfirmDelete,
  onDelete,
  onRenameLabel,
}: {
  label: string;
  hint?: string;
  tip?: string;
  definition?: string;
  locked: boolean;
  pickable?: boolean;
  picked?: boolean;
  onPick?: () => void;
  removable?: boolean;
  included?: boolean;
  onToggle?: () => void;
  offNote?: string;
  /** Present only on the area row — “adjustment % per multiple / ratio”. */
  areaFactor?: number;
  onAreaFactorChange?: (value: string) => void;
  /** Two-step delete: × → “Delete? ✓ ×”. */
  deleteKey?: string;
  confirmDelete?: string | null;
  onConfirmDelete?: (key: string | null) => void;
  onDelete?: () => void;
  /** Custom difference factor — the name is typed in the label cell. */
  onRenameLabel?: (text: string) => void;
}) {
  return (
    <td className={tdLabelClass}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {onRenameLabel ? (
            <InlineDraftInput
              disabled={locked}
              placeholder="اسم العامل…"
              value={label}
              onCommit={onRenameLabel}
              className="w-full rounded-[7px] border border-dashed border-border-md bg-surface px-2 py-1 text-[12.5px] font-bold text-heading"
            />
          ) : (
            <div
              title={tip || definition || undefined}
              className="cursor-default text-[12.5px] font-bold leading-[1.35] text-heading"
            >
              {label}
            </div>
          )}
          {hint ? (
            <div className="mt-px text-[10.5px] font-normal leading-[1.4] text-text-3">
              {hint}
            </div>
          ) : null}
        </div>
        {pickable ? (
          <button
            type="button"
            title={
              picked
                ? "الأساس المعتمد في التسويات"
                : "اعتماد هذا الأساس في التسويات"
            }
            disabled={locked}
            onClick={onPick}
            className={cn(
              "ms-auto grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border text-[13px] font-bold leading-none text-gold-d disabled:cursor-not-allowed",
              picked ? "border-gold bg-gold-soft" : "border-border bg-surface",
            )}
          >
            {picked ? "●" : ""}
          </button>
        ) : null}
        {removable ? (
          <button
            type="button"
            title={
              included === false
                ? "تفعيل احتساب البند"
                : "استبعاد البند من الاحتساب"
            }
            disabled={locked}
            onClick={onToggle}
            className={cn(
              "grid size-6 shrink-0 cursor-pointer place-items-center rounded-[7px] border text-[13px] font-bold leading-none text-gold-d disabled:cursor-not-allowed",
              included === false
                ? "border-border bg-surface"
                : "border-gold bg-gold-soft",
            )}
          >
            {included === false ? "" : "✓"}
          </button>
        ) : null}
        {deleteKey && onDelete && onConfirmDelete ? (
          confirmDelete === deleteKey ? (
            <span className="inline-flex shrink-0 items-center gap-1">
              <span className="text-[10.5px] font-bold text-danger">
                حذف؟
              </span>
              <button
                type="button"
                title="تأكيد الحذف"
                disabled={locked}
                onClick={() => {
                  onConfirmDelete(null);
                  onDelete();
                }}
                className="grid size-[22px] cursor-pointer place-items-center rounded-[7px] border border-danger bg-danger-bg text-[12px] font-bold leading-none text-danger-text disabled:cursor-not-allowed"
              >
                ✓
              </button>
              <button
                type="button"
                title="إلغاء"
                onClick={() => onConfirmDelete(null)}
                className="grid size-[22px] cursor-pointer place-items-center rounded-[7px] border border-border bg-surface text-[12px] font-bold leading-none text-text-2"
              >
                ×
              </button>
            </span>
          ) : (
            <button
              type="button"
              title="حذف البند من الجدول"
              disabled={locked}
              onClick={() => onConfirmDelete(deleteKey)}
              className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-[7px] border border-border bg-surface text-[13px] font-bold leading-none text-text-3 disabled:cursor-not-allowed"
            >
              ×
            </button>
          )
        ) : null}
      </div>
      {offNote ? (
        <div className="mt-[3px] text-[10.5px] font-semibold text-danger">
          {offNote}
        </div>
      ) : null}
      {areaFactor != null && onAreaFactorChange ? (
        <label className="mt-1.5 flex items-center gap-[7px]">
          <span className="text-[10.5px] font-medium text-gold-d">
            نسبة التسوية لكل مثل أو مضاعف (٪)
          </span>
          <input
            dir="ltr"
            type="number"
            min={0}
            max={50}
            step={0.5}
            disabled={locked}
            defaultValue={String(areaFactor)}
            onBlur={(e) => onAreaFactorChange(e.target.value)}
            onKeyDown={commitOnEnter}
            className="w-16 rounded-[7px] border border-border-md bg-surface px-[7px] py-[5px] text-center text-[12px] font-bold text-heading"
          />
        </label>
      ) : null}
    </td>
  );
}

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
}: {
  factorKey?: string;
  value?: string;
  locked?: boolean;
  /** On blur only when the value changed; returning false keeps the draft (save failed). */
  onCommit?: (factorKey: string, text: string) => Promise<boolean> | void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (!factorKey || !onCommit) {
    return <td className={tdJustClass} />;
  }
  const committed = value ?? "";
  const text = draft ?? committed;
  return (
    <td className={tdJustClass}>
      <input
        type="text"
        value={text}
        disabled={locked}
        placeholder="مبرر عامل التسوية"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={commitOnEnter}
        onBlur={() => {
          if (draft == null) return;
          if (draft === committed) {
            setDraft(null);
            return;
          }
          void Promise.resolve(onCommit(factorKey, draft)).then((ok) => {
            if (ok !== false) setDraft(null);
          });
        }}
        className="w-full rounded-[7px] border border-border bg-surface px-2.5 py-[7px] text-[12px] font-medium text-text"
      />
    </td>
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
}: {
  cellKey: string;
  value: string;
  disabled: boolean;
  muted: boolean;
  auto?: boolean;
  note?: string;
  extra?: ReactNode;
  /** On blur only when the value changed; returning false keeps the draft (save failed). */
  onCommit?: (key: string, raw: string) => Promise<boolean> | void;
}) {
  // Draft lives in the cell — was in the parent and re-rendered ~120 components per keystroke
  // (rerender-defer-reads); commit on blur only when changed, as before.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <td className={tdCellClass}>
      <input
        dir="ltr"
        type="text"
        disabled={disabled}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={commitOnEnter}
        onBlur={() => {
          if (draft == null) return;
          if (draft === value || !onCommit) {
            setDraft(null);
            return;
          }
          void Promise.resolve(onCommit(cellKey, draft)).then((ok) => {
            if (ok !== false) setDraft(null);
          });
        }}
        className={cn(
          cellInputBaseClass,
          muted || auto
            ? "border-border text-gold-d"
            : "border-border-md text-heading",
          muted || disabled ? "bg-surface-2" : "bg-surface",
        )}
      />
      {note ? <div className={noteClass}>{note}</div> : null}
      {extra}
    </td>
  );
}

/** Text field with a local draft — commits on blur only when changed (comp/subject description). */
export function InlineDraftInput({
  value,
  disabled,
  placeholder,
  className,
  onCommit,
  hintUntilFocus = false,
}: {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onCommit: (text: string) => void;
  /** Spec hint: hide the current text on focus and restore it if nothing was typed. */
  hintUntilFocus?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [edited, setEdited] = useState(false);
  const display = draft ?? (hintUntilFocus && focused ? "" : value);
  return (
    <input
      type="text"
      disabled={disabled}
      placeholder={focused ? undefined : placeholder}
      value={display}
      onFocus={() => {
        setFocused(true);
        if (hintUntilFocus && draft == null) setDraft("");
      }}
      onChange={(e) => {
        setEdited(true);
        setDraft(e.target.value);
      }}
      onKeyDown={commitOnEnter}
      onBlur={() => {
        setFocused(false);
        if (draft == null) return;
        if (hintUntilFocus && !edited) {
          setDraft(null);
          return;
        }
        const text = draft;
        setDraft(null);
        setEdited(false);
        if (text !== value) onCommit(text);
      }}
      className={cn(
        className,
        focused ? "placeholder:opacity-0" : hintUntilFocus && value && "text-text-3",
      )}
    />
  );
}

/** Relative-weight cell with its local draft — same blur-commit contract. */
export function WeightCell({
  value,
  manual,
  suggestedNote,
  locked,
  onCommit,
}: {
  value: string;
  manual: boolean | undefined;
  suggestedNote: string;
  locked: boolean;
  onCommit: (raw: string) => Promise<boolean> | void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <td className={tdCellClass}>
      <input
        dir="ltr"
        type="text"
        disabled={locked}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={commitOnEnter}
        onBlur={() => {
          if (draft == null) return;
          if (draft === value) {
            setDraft(null);
            return;
          }
          void Promise.resolve(onCommit(draft)).then((ok) => {
            if (ok !== false) setDraft(null);
          });
        }}
        className={cn(
          cellInputBaseClass,
          manual
            ? "border-border-md bg-surface text-heading"
            : "border-border bg-surface-2 text-gold-d",
        )}
      />
      <div className={noteClass}>{manual ? "تجاوز يدوي" : suggestedNote}</div>
    </td>
  );
}

export function AddFactorRow({
  options,
  locked,
  colSpan,
  onAdd,
  onAddCustom,
}: {
  options: { factorKey: string; labelAr: string }[];
  locked: boolean;
  colSpan: number;
  onAdd: (factorKey: string, labelAr: string) => void;
  onAddCustom: () => void;
}) {
  return (
    <tr className="bg-surface-2">
      <td colSpan={colSpan} className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] font-semibold text-text-2">
            إضافة عامل اختلاف
          </span>
          {options.length > 0 ? (
            <select
              disabled={locked}
              value=""
              onChange={(e) => {
                const key = e.target.value;
                const opt = options.find((o) => o.factorKey === key);
                if (opt) onAdd(opt.factorKey, opt.labelAr);
              }}
              className="min-w-[180px] rounded-[var(--radius-sm)] border border-border-md bg-surface px-2.5 py-[7px] text-[12.5px] text-heading"
            >
              <option value="" disabled>
                اختر من القائمة…
              </option>
              {options.map((o) => (
                <option key={o.factorKey} value={o.factorKey}>
                  {o.labelAr}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            disabled={locked}
            onClick={onAddCustom}
            className="cursor-pointer rounded-[var(--radius-sm)] border-none bg-ink px-3.5 py-[7px] text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
          >
            إضافة
          </button>
        </div>
      </td>
    </tr>
  );
}
