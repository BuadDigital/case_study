"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { StatusPill, type StatusPillStyle, cn } from "@platform/ui-kit";

/** Case Study.html `ENG_BOX` */
export const engBoxClassName =
  "rounded-lg border border-border bg-surface-2 px-3 py-2.5";

/** Case Study.html `INP_STYLE` */
export const engInputClassName =
  "w-full rounded-[9px] border border-border-md bg-surface-2 px-3 py-[9px] font-[inherit] text-[13px] text-text outline-none disabled:opacity-70";

export const engLabelClassName =
  "mb-[7px] block text-[12px] font-semibold text-text-2";

export const engCardClassName =
  "rounded-xl border border-border bg-surface p-[18px_20px] shadow-card";

export const engPpHeadClassName =
  "mb-3.5 rounded-[14px] border border-border bg-surface px-[22px] py-[18px] shadow-card";

export const engChipClassName =
  "inline-flex items-center gap-1 rounded-md bg-gold-soft px-2.5 py-[3px] text-[12px] font-bold text-gold-d";

export const engPrimaryBtnClassName =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border-none bg-ink px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,0.6)] transition-[transform,background] hover:bg-navy-3 hover:-translate-y-px disabled:pointer-events-none disabled:opacity-55 disabled:hover:translate-y-0";

export function EngSection({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 mt-[18px] border-b border-border pb-[7px] text-[13px] font-bold text-heading">
      {children}
    </div>
  );
}

export function EngInfo({
  children,
  variant = "gold",
}: {
  children: ReactNode;
  variant?: "gold" | "amber" | "red";
}) {
  const styles =
    variant === "amber"
      ? "border-[#fad7a0] bg-[#fef3d7] text-[#7a5b12]"
      : variant === "red"
        ? "border-[color-mix(in_srgb,#d9694f_30%,transparent)] bg-[color-mix(in_srgb,#d9694f_9%,transparent)] text-[#a5432e]"
        : "border-[color-mix(in_srgb,var(--gold)_28%,transparent)] bg-[color-mix(in_srgb,var(--gold)_8%,transparent)] text-text-2";
  return (
    <div
      className={cn(
        "mb-3 rounded-lg border px-3 py-2.5 text-[11.5px] leading-[1.7]",
        styles,
      )}
    >
      {children}
    </div>
  );
}

export function EngField({
  label,
  value,
  ltr,
  children,
}: {
  label: string;
  value?: ReactNode;
  ltr?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={engBoxClassName}>
      <div className="mb-[3px] text-[10.5px] text-text-3">{label}</div>
      <div
        className={cn(
          "text-[12.5px] font-semibold text-text",
          ltr && "text-end [direction:ltr]",
        )}
      >
        {children ?? value ?? "—"}
      </div>
    </div>
  );
}

export function EngStatusPill({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  const style: StatusPillStyle = { base: color, fg: color };
  return <StatusPill label={label} style={style} />;
}

export const ENG_STATUS_COLORS = {
  draft: "var(--gold)",
  submitted: "#3f8f5f",
  reopened: "#d9a441",
  completed: "#3f8f5f",
  view: "#8a8d96",
  unpaid: "#8a8d96",
  pending: "#d9a441",
} as const;

/** Matches the Case Study / appraiser tab bar — active tab fills a navy «ink» box. */
export function EngTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; dot?: boolean; badge?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      className="z-10 mx-[-20px] mb-[18px] flex flex-wrap gap-x-0.5 gap-y-0 overflow-visible whitespace-nowrap border-b border-border bg-transparent px-3.5 sm:px-3.5"
      role="tablist"
      aria-label="أقسام مساحة عمل الرفع المساحي"
    >
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative mb-0 max-lg:min-h-0 cursor-pointer rounded-none border-0 border-b-0 bg-transparent px-2.5 py-[9px] font-[inherit] text-[12.5px] font-normal text-text-2 transition-[background,color] duration-150",
              "hover:bg-[color-mix(in_srgb,#102B4E_6%,transparent)] hover:text-heading",
              on && "!bg-ink !font-normal !text-white hover:!bg-ink hover:!text-white",
            )}
          >
            {tab.label}
            {tab.dot ? (
              <span
                className="ms-1 inline-block size-1.5 rounded-full bg-gold-d align-middle"
                aria-hidden
              />
            ) : null}
            {tab.badge && tab.badge > 0 ? (
              <span className="ms-1 rounded-[10px] bg-danger-bg px-1.5 py-px text-[10px] font-medium text-danger-text">
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function EngUploadBox({
  id,
  title,
  hint,
  fileName,
  disabled,
  onPick,
  onClear,
  error,
}: {
  id?: string;
  title: string;
  hint: string;
  fileName: string;
  disabled?: boolean;
  onPick: (file: File | null) => void;
  onClear: () => void;
  error?: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function isPdfFile(file: File): boolean {
    const type = (file.type || "").toLowerCase();
    if (type === "application/pdf") return true;
    return file.name.toLowerCase().endsWith(".pdf");
  }

  function pickFromList(files: FileList | File[] | null | undefined) {
    const file = files?.[0];
    if (!file || !isPdfFile(file)) return;
    onPick(file);
  }

  return (
    <div id={id}>
      {!disabled ? (
        <div
          role="button"
          tabIndex={0}
          aria-label={`${title} — اختر ملفاً أو اسحبه هنا`}
          className={cn(
            "cursor-pointer rounded-[10px] border-2 border-dashed p-[18px] text-center transition-[border-color,background]",
            dragOver
              ? "border-gold-d bg-[color-mix(in_srgb,var(--gold)_12%,transparent)]"
              : "border-border-md bg-surface-2",
            error &&
              "border-danger bg-danger-bg/40 ring-2 ring-[color-mix(in_srgb,var(--danger)_28%,transparent)]",
          )}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Avoid flicker when leaving into a child element.
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            pickFromList(e.dataTransfer.files);
          }}
        >
          <div className="mb-[3px] text-xs font-bold text-text-2">{title}</div>
          <div className="mb-2.5 text-[11px] text-text-3">
            {dragOver
              ? "أفلِت ملف PDF هنا"
              : `${hint} · أو اسحب الملف وأفلِته هنا`}
          </div>
          <span
            className={cn(
              engPrimaryBtnClassName,
              "!pointer-events-none !px-4 !py-1.5 !text-[11.5px]",
            )}
          >
            اختيار ملف
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              pickFromList(e.target.files);
              e.target.value = "";
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
      {fileName ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-[#a9dfbf] bg-[#d5f5ef] px-3 py-2 text-xs">
          <span>📎 {fileName}</span>
          {!disabled ? (
            <button
              type="button"
              className="cursor-pointer border-none bg-transparent text-sm text-text-3"
              onClick={onClear}
              aria-label="حذف الملف"
            >
              ✕
            </button>
          ) : null}
        </div>
      ) : disabled ? (
        <div className="px-0.5 py-1.5 text-xs text-text-3">لم يُرفع أي ملف.</div>
      ) : null}
      {error ? (
        <p className="mt-1 text-[11px] text-[#a5432e]">{error}</p>
      ) : null}
    </div>
  );
}
