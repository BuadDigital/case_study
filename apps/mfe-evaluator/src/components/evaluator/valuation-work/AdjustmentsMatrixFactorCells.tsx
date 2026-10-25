"use client";

import { useState } from "react";
import { cn } from "@platform/ui-kit";
import { commitKeys, tdLabelClass } from "./AdjustmentsMatrixCells.styles";
import type { TouchProps } from "./AdjustmentsMatrixCells";
import { useMatrixCellDraft } from "./useMatrixCellDraft";

/**
 * The factor-row pieces of the adjustments matrix — the label cell (pick /
 * include / delete / rename / area factor), the free-text draft input and the
 * add-a-factor controls. Shared by the desktop table and the phone cards.
 */

export function LabelCell({
  label,
  hint,
  tip,
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
  touch,
  className,
}: TouchProps & {
  label: string;
  hint?: string;
  tip?: string;
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
  onAreaFactorChange?: (value: string) => Promise<boolean> | void;
  /** Two-step delete: × → “Delete? ✓ ×”. */
  deleteKey?: string;
  confirmDelete?: string | null;
  onConfirmDelete?: (key: string | null) => void;
  onDelete?: () => void;
  /** Custom difference factor — the name is typed in the label cell. */
  onRenameLabel?: (text: string) => void;
}) {
  const Wrap = touch ? "div" : "td";
  const btn = touch ? "size-11 text-[16px]" : "size-6 text-[13px]";
  const confirmBtn = touch ? "size-11 text-[15px]" : "size-[22px] text-[12px]";
  return (
    <Wrap className={touch ? className : tdLabelClass}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {onRenameLabel ? (
            <InlineDraftInput
              disabled={locked}
              placeholder="اسم العامل…"
              value={label}
              onCommit={onRenameLabel}
              className={cn(
                "w-full rounded-[7px] border border-dashed border-border-md bg-surface px-2 py-1 font-bold text-heading",
                touch ? "min-h-11 text-[16px]" : "text-[12.5px]",
              )}
            />
          ) : (
            <div
              title={tip || undefined}
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
            tabIndex={-1}
            title={
              picked
                ? "الأساس المعتمد في التسويات"
                : "اعتماد هذا الأساس في التسويات"
            }
            disabled={locked}
            onClick={onPick}
            className={cn(
              "ms-auto grid shrink-0 cursor-pointer place-items-center rounded-full border font-bold leading-none text-gold-d disabled:cursor-not-allowed",
              btn,
              picked ? "border-gold bg-gold-soft" : "border-border bg-surface",
            )}
          >
            {picked ? "●" : ""}
          </button>
        ) : null}
        {removable ? (
          <button
            type="button"
            tabIndex={-1}
            title={
              included === false
                ? "تفعيل احتساب البند"
                : "استبعاد البند من الاحتساب"
            }
            disabled={locked}
            onClick={onToggle}
            className={cn(
              "grid shrink-0 cursor-pointer place-items-center rounded-[7px] border font-bold leading-none text-gold-d disabled:cursor-not-allowed",
              btn,
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
                tabIndex={-1}
                title="تأكيد الحذف"
                disabled={locked}
                onClick={() => {
                  onConfirmDelete(null);
                  onDelete();
                }}
                className={cn(
                  "grid cursor-pointer place-items-center rounded-[7px] border border-danger bg-danger-bg font-bold leading-none text-danger-text disabled:cursor-not-allowed",
                  confirmBtn,
                )}
              >
                ✓
              </button>
              <button
                type="button"
                tabIndex={-1}
                title="إلغاء"
                onClick={() => onConfirmDelete(null)}
                className={cn(
                  "grid cursor-pointer place-items-center rounded-[7px] border border-border bg-surface font-bold leading-none text-text-2",
                  confirmBtn,
                )}
              >
                ×
              </button>
            </span>
          ) : (
            <button
              type="button"
              tabIndex={-1}
              title="حذف البند من الجدول"
              disabled={locked}
              onClick={() => onConfirmDelete(deleteKey)}
              className={cn(
                "grid shrink-0 cursor-pointer place-items-center rounded-[7px] border border-border bg-surface font-bold leading-none text-text-3 disabled:cursor-not-allowed",
                btn,
              )}
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
        <AreaFactorInput
          value={areaFactor}
          locked={locked}
          touch={touch}
          onCommit={onAreaFactorChange}
        />
      ) : null}
    </Wrap>
  );
}

function AreaFactorInput({
  value,
  locked,
  touch,
  onCommit,
}: {
  value: number;
  locked: boolean;
  touch?: boolean;
  onCommit: (raw: string) => Promise<boolean> | void;
}) {
  const { text, change, flush, onKeyDown } = useMatrixCellDraft(String(value), onCommit);

  return (
    <label className={cn("mt-1.5 flex items-center gap-[7px]", touch && "mt-2.5 justify-between gap-3")}>
      <span className="text-[10.5px] font-medium text-gold-d">
        نسبة التسوية لكل مثل أو مضاعف (٪)
      </span>
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
          "rounded-[7px] border border-border-md bg-surface text-center font-bold text-heading",
          touch ? "min-h-11 w-24 shrink-0 px-2 text-[16px]" : "w-16 px-[7px] py-[5px] text-[12px]",
        )}
      />
    </label>
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
      onKeyDown={(e) =>
        commitKeys(e, () => {
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
        })
      }
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

/** Add-a-difference-factor picker — the table's last row, or a block in the phone factor card. */
export function AddFactorControls({
  options,
  locked,
  onAdd,
  onAddCustom,
  touch,
}: {
  options: { factorKey: string; labelAr: string }[];
  locked: boolean;
  onAdd: (factorKey: string, labelAr: string) => void;
  onAddCustom: () => void;
  touch?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", touch && "flex-wrap")}>
      <span className={cn("text-[12px] font-semibold text-text-2", touch && "w-full")}>
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
          className={cn(
            "rounded-[var(--radius-sm)] border border-border-md bg-surface px-2.5 text-heading",
            touch ? "min-h-11 min-w-0 flex-1 text-[16px]" : "min-w-[180px] py-[7px] text-[12.5px]",
          )}
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
        tabIndex={touch ? undefined : -1}
        disabled={locked}
        onClick={onAddCustom}
        className={cn(
          "cursor-pointer rounded-[var(--radius-sm)] border-none bg-ink px-3.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-55",
          touch ? "min-h-11 text-[14px]" : "py-[7px] text-[12.5px]",
        )}
      >
        إضافة
      </button>
    </div>
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
        <AddFactorControls
          options={options}
          locked={locked}
          onAdd={onAdd}
          onAddCustom={onAddCustom}
        />
      </td>
    </tr>
  );
}
