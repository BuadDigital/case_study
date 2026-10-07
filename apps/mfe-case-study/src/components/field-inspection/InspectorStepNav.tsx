"use client";

import { cn } from "@platform/ui-kit";

export type InspectorStepId = 1 | 2 | 3;

/**
 * Field-inspection wizard steps (Field Inspection Workspace design).
 * Each card reveals its own group of sections; the rest render nothing.
 */
export const INSPECTOR_STEPS: {
  id: InspectorStepId;
  title: string;
  hint: string;
}[] = [
  {
    id: 1,
    title: "الموقع والتصوير",
    hint: "تحديد موقع العقار على الخريطة، خصائص العقار، وتصوير العقار",
  },
  {
    id: 2,
    title: "بيانات العقار",
    hint: "مكوّنات العقار وحدوده ومساحاته وخدماته",
  },
  {
    id: 3,
    title: "التجهيز والإكمال",
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
  return (
    <div
      className={cn(
        "mb-3 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3",
        className,
      )}
    >
      {INSPECTOR_STEPS.map((step) => {
        const active = step.id === activeStep;
        const done = Boolean(doneSteps?.has(step.id));
        return (
          <button
            key={step.id}
            type="button"
            aria-current={active ? "step" : undefined}
            onClick={() => onSelect(step.id)}
            className={cn(
              "flex w-full cursor-pointer items-start gap-2.5 rounded-xl border border-t-[3px] px-3.5 py-3 text-start font-inherit",
              "transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.985]",
              "motion-reduce:transition-none motion-reduce:active:scale-100",
              active
                ? "border-gold border-t-gold bg-[color-mix(in_srgb,var(--gold)_8%,var(--surface))]"
                : "border-border border-t-border bg-surface hover:border-border-md hover:bg-surface-2",
            )}
          >
            <span
              className={cn(
                "grid size-[26px] shrink-0 place-items-center rounded-full text-[12px] font-bold tabular-nums transition-colors duration-200",
                active
                  ? "bg-[color-mix(in_srgb,var(--heading)_18%,var(--ink))] text-on-ink"
                  : done
                    ? "bg-[color-mix(in_srgb,#3f8f5f_55%,var(--surface))] text-on-ink"
                    : "bg-surface-2 text-text-3",
              )}
            >
              {done && !active ? "✓" : step.id}
            </span>
            <span className="min-w-0 flex-1 text-start">
              <span
                className={cn(
                  "block text-[13px] font-bold transition-colors duration-200",
                  active ? "text-gold-d" : "text-heading",
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
  );
}
