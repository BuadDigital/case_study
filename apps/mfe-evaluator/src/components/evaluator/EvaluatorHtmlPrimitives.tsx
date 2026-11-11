"use client";

import type { ReactNode } from "react";
import {
  MobileSectionPicker,
  OpsInfoNote,
  OpsSectionTitle,
  cn,
  opsWorkCard,
  useWorkDensity,
  WORK_FORM_GRID_CLASS,
  type OpsInfoNoteVariant,
} from "@platform/ui-kit";

/**
 * The gap between a section's header rule and its first content on the appraiser's page.
 *
 * How it works: the sections frame gives a section's body no top padding of its own, so the
 * sections that open on plain content (the summary, the approaches, the review) take it here —
 * one value for the three.
 */
export const WORK_SECTION_TOP_GAP = "pt-5";

/**
 * Field-inspection `InsCard` language — aligns evaluator input sections with the rest of the app.
 * Inside the sections frame (`work` density, Omar 2026-11-10) the section is already the panel, so
 * the card is flat: its title and fields with a thin rule above, no frame of its own; the last
 * card of a section has no bottom margin (the section's bottom padding is the gap under it).
 * Edge cases: a card with neither `title` nor `badge` has no header row — its content starts the
 * card (the summary's documents card, whose section header already names it).
 */
export function ValCard({
  title,
  badge,
  children,
}: {
  title?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const work = useWorkDensity();
  return (
    <section
      className={cn(
        work
          ? // The last card: no bottom margin of its own, nor of its last line.
            "mb-4 last:mb-0 last:[&>*:last-child]:mb-0 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-border [&:not(:first-child)]:pt-4"
          : cn(opsWorkCard, "mb-3.5"),
      )}
    >
      {title || badge ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {title ? (
            <>
              <span className="h-[15px] w-[3px] rounded-full bg-gold" aria-hidden />
              <h4 className="m-0 text-[13px] font-bold text-heading">{title}</h4>
            </>
          ) : null}
          <span className="flex-1" />
          {badge}
        </div>
      ) : null}
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
  // The sections frame: four fields to a row at most, whatever the `min` of the standalone screens.
  if (useWorkDensity()) return <div className={WORK_FORM_GRID_CLASS}>{children}</div>;
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
  return <OpsSectionTitle className="first:mt-0">{children}</OpsSectionTitle>;
}

export function EngInfo({
  children,
  variant,
}: {
  children: ReactNode;
  variant?: OpsInfoNoteVariant;
}) {
  return (
    <OpsInfoNote variant={variant} className="mb-3.5">
      {children}
    </OpsInfoNote>
  );
}

// `ValStatusPill` color: CSS color matching HTML `pill(t,c)` — GOLD/NAVY/GREEN/AMBER/GRAY.
export {
  OpsReadField as EngField,
  ColorStatusPill as ValStatusPill,
} from "@platform/ui-kit";

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
