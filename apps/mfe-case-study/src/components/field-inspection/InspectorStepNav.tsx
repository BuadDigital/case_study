"use client";

import { cn, MobileSectionPicker } from "@platform/ui-kit";

export type InspectorStepId = 1 | 2 | 3;

/**
 * Field-inspection wizard steps (Field Inspection Workspace design).
 * Each card reveals its own group of sections; the rest render nothing.
 */
const INSPECTOR_STEPS: {
  id: InspectorStepId;
  title: string;
  /** Phone segmented-control label (≤14 chars so the three fit side by side). */
  short: string;
  hint: string;
}[] = [
  {
    id: 1,
    title: "الموقع والتصوير",
    short: "الموقع والصور",
    hint: "تحديد موقع العقار على الخريطة، خصائص العقار، وتصوير العقار",
  },
  {
    id: 2,
    title: "بيانات العقار",
    short: "بيانات العقار",
    hint: "مكونات العقار وحدوده ومساحاته وخدماته",
  },
  {
    id: 3,
    title: "التجهيز والإكمال",
    short: "الإكمال",
    hint: "الملاحظات والتوثيق ثم إتمام المعاينة وإرسالها",
  },
];

export function InspectorStepNav({
  activeStep,
  doneSteps,
  onSelect,
  className,
}: {
  activeStep: InspectorStepId;
  /** Steps whose required fields are complete — shown with a check. */
  doneSteps?: ReadonlySet<InspectorStepId>;
  onSelect: (step: InspectorStepId) => void;
  className?: string;
}) {
  const active = INSPECTOR_STEPS.find((s) => s.id === activeStep) ?? INSPECTOR_STEPS[0];
  return (
    <>
      {/* Phones: a segmented control + the active step's hint, as in the case-study and
          valuation workspaces. The three tall step cards stacked into half a screen there, and
          their numbers read like the numbered section cards under them. */}
      <div className={cn("mb-3 lg:hidden", className)}>
        <MobileSectionPicker
          title="خطوات المعاينة"
          sections={INSPECTOR_STEPS.map((s) => ({ id: String(s.id), label: s.short }))}
          active={String(activeStep)}
          onChange={(id) => onSelect(Number(id) as InspectorStepId)}
        />
        <p className="m-0 mt-1.5 px-1 text-[11.5px] leading-relaxed text-text-3">
          {active.hint}
        </p>
      </div>
      <div
        className={cn(
          "mb-3 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 max-lg:hidden",
          className,
        )}
      >
        {INSPECTOR_STEPS.map((step) => {
          const selected = step.id === activeStep;
          const done = Boolean(doneSteps?.has(step.id));
          return (
            <button
              key={step.id}
              type="button"
              aria-current={selected ? "step" : undefined}
              onClick={() => onSelect(step.id)}
              className={cn(
                "flex w-full cursor-pointer items-start gap-2.5 rounded-xl border border-t-[3px] px-3.5 py-3 text-start font-inherit",
                "transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.985]",
                "motion-reduce:transition-none motion-reduce:active:scale-100",
                selected
                  ? "border-gold border-t-gold bg-[color-mix(in_srgb,var(--gold)_8%,var(--surface))]"
                  : "border-border border-t-border bg-surface hover:border-border-md hover:bg-surface-2",
              )}
            >
              <span
                className={cn(
                  "grid size-[26px] shrink-0 place-items-center rounded-full text-[12px] font-bold tabular-nums transition-colors duration-200",
                  selected
                    ? "bg-[color-mix(in_srgb,var(--heading)_18%,var(--ink))] text-on-ink"
                    : done
                      ? "bg-[color-mix(in_srgb,#3f8f5f_55%,var(--surface))] text-on-ink"
                      : "bg-surface-2 text-text-3",
                )}
              >
                {done && !selected ? "✓" : step.id}
              </span>
              <span className="min-w-0 flex-1 text-start">
                <span
                  className={cn(
                    "block text-[13px] font-bold transition-colors duration-200",
                    selected ? "text-gold-d" : "text-heading",
                  )}
                >
                  {step.title}
                </span>
                <span className="mt-[3px] block text-[11px] leading-relaxed text-text-3">
                  {step.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
