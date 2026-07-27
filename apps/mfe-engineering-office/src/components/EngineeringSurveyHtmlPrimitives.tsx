"use client";

import type { ReactNode } from "react";
import { StatusPill, type StatusPillStyle, cn } from "@platform/design-system";

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

export function EngBackLink({
  onClick,
  children = "العودة إلى الرفع المساحي",
}: {
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2 inline-flex cursor-pointer items-center gap-[7px] border-none bg-transparent p-0 py-1.5 text-[12.5px] font-semibold text-text-2 transition-colors hover:text-gold-d"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="-scale-x-100"
        aria-hidden
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
      {children}
    </button>
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
    <div className="mb-[18px] flex gap-0 overflow-x-auto overflow-y-hidden border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:h-0">
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "-mb-px shrink-0 cursor-pointer border-b-2 bg-transparent px-3.5 py-2.5 font-[inherit] text-[12.5px] transition-colors",
              on
                ? "border-gold-d font-bold text-heading"
                : "border-transparent font-medium text-text-2",
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
  title,
  hint,
  fileName,
  disabled,
  onPick,
  onClear,
  error,
}: {
  title: string;
  hint: string;
  fileName: string;
  disabled?: boolean;
  onPick: (file: File | null) => void;
  onClear: () => void;
  error?: string;
}) {
  return (
    <div>
      {!disabled ? (
        <div className="rounded-[10px] border-2 border-dashed border-border-md bg-surface-2 p-[18px] text-center">
          <div className="mb-[3px] text-xs font-bold text-text-2">{title}</div>
          <div className="mb-2.5 text-[11px] text-text-3">{hint}</div>
          <label
            className={cn(
              engPrimaryBtnClassName,
              "!px-4 !py-1.5 !text-[11.5px]",
            )}
          >
            اختيار ملف
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              disabled={disabled}
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
          </label>
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
