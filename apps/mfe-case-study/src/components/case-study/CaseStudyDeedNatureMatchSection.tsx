"use client";

import {
  FormGroup,
  Label,
  Note,
  Textarea,
  cn,
} from "@platform/ui-kit";
import type { CaseStudyFormDraft } from "../../lib/app-data/case-study-form-storage";

const MATCH_OPTIONS = [
  { value: "matched" as const, label: "مطابق" },
  { value: "differences" as const, label: "فروق" },
  { value: "impediment" as const, label: "مرشح تعذر" },
];

/**
 * Deed↔nature match gate — valuation spec.
 * Required for traditional deeds before the calc engine; registered title skips it.
 */
export function CaseStudyDeedNatureMatchSection({
  draft,
  disabled,
  onPatch,
}: {
  draft: CaseStudyFormDraft;
  disabled?: boolean;
  onPatch: (patch: Partial<CaseStudyFormDraft>) => void;
}) {
  const outcome = draft.deedNatureMatchOutcome ?? "";
  const needsNotes = outcome === "differences" || outcome === "impediment";

  return (
    <section className="overflow-hidden rounded-[10px] border border-border">
      <header className="border-b border-border bg-surface-2 px-4 py-2.5">
        <h3 className="m-0 text-[12.5px] font-bold text-heading">
          مطابقة الصك على الطبيعة
        </h3>
      </header>

      <div className="grid gap-3.5 px-4 py-3.5">
        <Note tone="info">
          الحدود تُطبع من الصك؛ الرفع المساحي للمطابقة فقط. أي اختلاف غير محسوم يوقف مسار التقييم (بوابة جودة).
        </Note>

        <FormGroup>
          <Label className="mb-2 text-[11px] font-semibold text-text-2">
            مخرج المطابقة
          </Label>
          <div className="flex flex-wrap gap-2">
            {MATCH_OPTIONS.map((opt) => {
              const on = outcome === opt.value;
              return (
                <label
                  key={opt.value}
                  className={cn(
                    "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-colors",
                    on
                      ? "border-ink bg-ink text-white"
                      : "border-border-md bg-surface text-text-2 hover:text-heading",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <input
                    type="radio"
                    name="deed-nature-match"
                    className="sr-only"
                    checked={on}
                    disabled={disabled}
                    onChange={() =>
                      onPatch({ deedNatureMatchOutcome: opt.value })
                    }
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </FormGroup>

        {needsNotes ? (
          <FormGroup>
            <Label
              htmlFor="deed-nature-match-notes"
              className="text-[11px] text-text-2"
            >
              ملاحظات الفروق / التعذر
            </Label>
            <Textarea
              id="deed-nature-match-notes"
              disabled={disabled}
              rows={3}
              value={draft.deedNatureMatchNotes ?? ""}
              onChange={(e) =>
                onPatch({ deedNatureMatchNotes: e.target.value })
              }
            />
          </FormGroup>
        ) : null}
      </div>
    </section>
  );
}
