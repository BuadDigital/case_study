"use client";

import type { ReactNode } from "react";
import { Tab, TabBar, cn, StatusPill, type StatusPillStyle } from "@platform/ui-kit";

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

/** Case Study.html `.primary` compact. */
export const valPrimaryBtnClassName =
  "inline-flex items-center gap-1.5 rounded-lg border-none bg-ink px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,0.6)] transition-[transform,background] hover:bg-navy-3 hover:-translate-y-px";

/** Field-inspection `InsCard` language — aligns evaluator input sections with the rest of the app. */
export function ValCard({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-3.5 rounded-[var(--radius-lg)] border border-border bg-surface px-[18px] py-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="h-[15px] w-[3px] rounded-full bg-gold" aria-hidden />
        <h4 className="m-0 text-[13px] font-bold text-heading">{title}</h4>
        <span className="flex-1" />
        {badge}
      </div>
      {children}
    </section>
  );
}

/** Field-inspection `InsField` language — label above value, no boxed background. */
export function ValField({
  label,
  value,
  ltr,
}: {
  label: string;
  value?: ReactNode;
  ltr?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] font-semibold text-text-2">{label}</div>
      <div
        className={cn(
          "text-[13px] font-semibold text-heading",
          ltr && "[direction:ltr] text-start",
        )}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}

export function ValFieldsGrid({
  children,
  min = 150,
}: {
  children: ReactNode;
  min?: number;
}) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}
    >
      {children}
    </div>
  );
}

/** Field-inspection `TABLE_TH`/`TABLE_TD` language — used inside ValCard tables. */
export const valTableThClassName =
  "border border-border bg-surface-2 px-2.5 py-[7px] text-[11px] font-bold text-text-2";
export const valTableTdClassName =
  "border border-border px-2.5 py-1.5 align-middle text-[12px]";

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
    <TabBar
      className="z-10 mx-[-20px] mb-0 flex flex-wrap items-stretch gap-x-0.5 gap-y-0 !overflow-x-hidden overflow-y-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-border bg-transparent px-3.5 sm:px-3.5"
      aria-label="أقسام نافذة التقييم"
    >
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <Tab
            key={tab.id}
            active={on}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative mb-0 max-lg:min-h-0 border-0 border-b-0 px-2.5 py-[9px] text-[12.5px] font-normal text-text-2",
              "rounded-none transition-[background,color] duration-150",
              "hover:bg-[color-mix(in_srgb,#102B4E_6%,transparent)] hover:text-heading",
              on &&
                "!border-0 !bg-ink !font-normal !text-white hover:!bg-ink hover:!text-white",
            )}
          >
            {tab.label}
          </Tab>
        );
      })}
    </TabBar>
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
