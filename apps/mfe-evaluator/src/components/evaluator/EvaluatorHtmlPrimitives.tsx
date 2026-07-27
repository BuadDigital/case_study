"use client";

import type { ReactNode } from "react";
import { cn, StatusPill, type StatusPillStyle } from "@platform/design-system";

/** Case Study.html `ENG_BOX` — soft surface field cell. */
export const engBoxClassName =
  "rounded-lg border border-border bg-surface-2 px-3 py-2.5";

/** Case Study.html `INP_STYLE`. */
export const valInputClassName =
  "w-full rounded-[9px] border border-border-md bg-surface-2 px-3 py-2.5 font-[inherit] text-[13px] text-text outline-none";

/** Case Study.html `.tf-lbl`. */
export const valLabelClassName =
  "mb-[7px] block text-[12px] font-semibold text-text-2";

/** Case Study.html `.card` inside val window. */
export const valCardClassName =
  "rounded-xl border border-border bg-surface p-[18px_20px] shadow-card";

/** Case Study.html `.pp-head`. */
export const valPpHeadClassName =
  "mb-3.5 rounded-[14px] border border-border bg-surface px-[22px] py-[18px] shadow-card";

/** Case Study.html `.chip`. */
export const valChipClassName =
  "inline-flex items-center gap-1 rounded-md bg-gold-soft px-2.5 py-[3px] text-[12px] font-bold text-gold-d";

/** Case Study.html `.panel-note`. */
export const panelNoteClassName =
  "rounded-xl border border-dashed border-border-md bg-surface px-[26px] py-[26px] text-center text-[13px] leading-relaxed text-text-3";

/** Case Study.html `.primary` compact. */
export const valPrimaryBtnClassName =
  "inline-flex items-center gap-1.5 rounded-lg border-none bg-ink px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,0.6)] transition-[transform,background] hover:bg-navy-3 hover:-translate-y-px";

export function EngSection({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 mt-[18px] border-b border-border pb-[7px] text-[13px] font-bold text-heading first:mt-0">
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
        "mb-3.5 rounded-lg border px-3 py-2.5 text-[11.5px] leading-[1.7]",
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

export function ValBackLink({
  onClick,
  children = "العودة إلى قائمة التقييم",
}: {
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2 inline-flex items-center gap-1.5 border-none bg-transparent p-0 py-1.5 text-[12.5px] font-semibold text-text-2 transition-colors hover:text-gold-d"
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

export function ValStatusPill({
  label,
  color,
}: {
  label: string;
  /** CSS color matching HTML `pill(t,c)` — GOLD/NAVY/GREEN/AMBER/GRAY */
  color: string;
}) {
  const style: StatusPillStyle = { base: color, fg: color };
  return <StatusPill label={label} style={style} />;
}

export const VAL_STATUS_COLORS = {
  draft: "var(--gold)",
  submitted: "#3f8f5f",
  reopened: "#d9a441",
  completed: "#3f8f5f",
  gated: "#8a8d96",
} as const;

export function ValTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="-mx-0.5 mb-[18px] flex gap-0 overflow-x-auto overflow-y-hidden border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:h-0">
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "-mb-px shrink-0 border-b-2 bg-transparent px-3.5 py-2.5 font-[inherit] text-[12.5px] transition-colors",
              on
                ? "border-gold-d font-bold text-heading"
                : "border-transparent font-medium text-text-2",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function ValDepChip({
  label,
  ok,
  title,
}: {
  label: string;
  ok: boolean;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-[7px] rounded-lg border px-[11px] py-1.5 text-[11px] font-bold",
        ok
          ? "border-[color-mix(in_srgb,#3f8f5f_30%,transparent)] bg-[color-mix(in_srgb,#3f8f5f_8%,transparent)] text-[#2f7a4d]"
          : "border-border-md bg-surface-2 text-text-3",
      )}
    >
      {ok ? (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m5 13 4 4L19 7" />
        </svg>
      ) : (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )}
      {label}
    </span>
  );
}
