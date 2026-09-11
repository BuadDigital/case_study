"use client";

import { cn } from "@platform/ui-kit";

export type CaseStudyWorkspaceTab = "study" | "appraisal";

/**
 * Numbered section cards for the case-study workspace — same look as the inspector's
 * `InspectorStepNav`, so the two sections are obvious instead of a thin text tab bar.
 */
const CASE_STUDY_WORKSPACE_STEPS: {
  id: CaseStudyWorkspaceTab;
  number: number;
  title: string;
  hint: string;
}[] = [
  {
    id: "study",
    number: 1,
    title: "نموذج الدراسة",
    hint: "أسئلة دراسة الحالة وإجابات الأطراف",
  },
  {
    id: "appraisal",
    number: 2,
    title: "تقييم العقار",
    hint: "مطابقة الصك ومراجعة المعاينة ومدخلات التقييم",
  },
];

export function CaseStudyWorkspaceStepNav({
  active,
  onSelect,
  className,
}: {
  active: CaseStudyWorkspaceTab;
  onSelect: (tab: CaseStudyWorkspaceTab) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="أقسام دراسة الحالة"
      className={cn(
        "mb-3 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3",
        className,
      )}
    >
      {CASE_STUDY_WORKSPACE_STEPS.map((step) => {
        const selected = step.id === active;
        return (
          <button
            key={step.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(step.id)}
            className={cn(
              "flex w-full cursor-pointer items-start gap-2.5 rounded-xl border border-t-[3px] px-3.5 py-3 text-start font-inherit transition-colors",
              selected
                ? "border-gold border-t-gold bg-[color-mix(in_srgb,var(--gold)_8%,var(--surface))]"
                : "border-border border-t-border bg-surface",
            )}
          >
            <span
              className={cn(
                "grid size-[26px] shrink-0 place-items-center rounded-full text-[12px] font-bold tabular-nums",
                selected ? "bg-ink text-white" : "bg-surface-2 text-text-3",
              )}
            >
              {step.number}
            </span>
            <span className="min-w-0 flex-1 text-start">
              <span
                className={cn(
                  "block text-[13px] font-bold",
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
  );
}
