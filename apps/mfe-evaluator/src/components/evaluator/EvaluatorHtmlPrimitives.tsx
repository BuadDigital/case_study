"use client";

import type { ReactNode } from "react";
import {
  MobileSectionPicker,
  StatusPill,
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
      // `min(…, 100%)` — a wide minimum never forces a phone to scroll sideways.
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`,
      }}
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
      ? "border-[color-mix(in_srgb,var(--amber)_40%,var(--border))] bg-warning-bg text-amber-text"
      : variant === "red"
        ? "border-[color-mix(in_srgb,var(--danger)_40%,var(--border))] bg-danger-bg text-danger-text"
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

export function ValTabBar({
  tabs,
  active,
  onChange,
  onTabIntent,
}: {
  tabs: { id: string; label: string; hint?: string }[];
  active: string;
  onChange: (id: string) => void;
  /** Pointer or keyboard focus reached a tab — warm what it needs before the click. */
  onTabIntent?: (id: string) => void;
}) {
  const activeHint = tabs.find((t) => t.id === active)?.hint;
  return (
    <>
      {/* Phones: a section picker (+ the active step's hint), not a stack of tall step cards. */}
      <div className="pt-4 lg:hidden">
        <MobileSectionPicker
          title="قسم التقييم"
          sections={tabs.map((t) => ({ id: t.id, label: t.label }))}
          active={active}
          onChange={(id) => {
            onTabIntent?.(id);
            onChange(id);
          }}
        />
        {activeHint ? (
          <p className="m-0 mt-1.5 px-1 text-[11.5px] leading-relaxed text-text-3">
            {activeHint}
          </p>
        ) : null}
      </div>
      <div
        role="tablist"
        aria-label="أقسام نافذة التقييم"
        className="mb-1 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 pt-4 max-lg:hidden"
      >
        {tabs.map((tab, index) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-label={tab.label}
              aria-selected={selected}
              onClick={() => onChange(tab.id)}
              onPointerEnter={
                onTabIntent ? () => onTabIntent(tab.id) : undefined
              }
              onFocus={onTabIntent ? () => onTabIntent(tab.id) : undefined}
              className={cn(
                "flex w-full cursor-pointer items-start gap-2.5 rounded-xl border border-t-[3px] px-3.5 py-3 text-start font-inherit",
                "transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.985]",
                "motion-reduce:transition-none motion-reduce:active:scale-100",
                selected
                  ? "border-gold border-t-gold bg-[color-mix(in_srgb,var(--gold)_8%,var(--surface))] shadow-[0_6px_18px_-12px_color-mix(in_srgb,var(--gold)_70%,transparent)]"
                  : "border-border border-t-border bg-surface hover:border-border-md hover:border-t-[color-mix(in_srgb,var(--gold)_45%,var(--border))] hover:bg-surface-2",
              )}
            >
              <span
                className={cn(
                  "grid size-[26px] shrink-0 place-items-center rounded-full text-[12px] font-bold tabular-nums transition-colors duration-200",
                  selected ? "bg-ink text-white" : "bg-surface-2 text-text-3",
                )}
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-start">
                <span
                  className={cn(
                    "block text-[13px] font-bold transition-colors duration-200",
                    selected ? "text-gold-d" : "text-heading",
                  )}
                >
                  {tab.label}
                </span>
                {tab.hint ? (
                  <span className="mt-[3px] block text-[11px] leading-relaxed text-text-3">
                    {tab.hint}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
