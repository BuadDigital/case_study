"use client";

import type { ReactNode } from "react";
import {
  StatusPill,
  Tab,
  TabBar,
  cn,
  opsFieldBox,
  opsWorkCard,
  statusPillStyleFromColor,
} from "@platform/ui-kit";

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
    <section className={cn(opsWorkCard, "mb-3.5")}>
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
    <div className={opsFieldBox}>
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
  return <StatusPill label={label} style={statusPillStyleFromColor(color)} />;
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
