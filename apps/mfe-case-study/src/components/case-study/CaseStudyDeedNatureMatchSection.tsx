"use client";

import {
  FormGroup,
  Label,
  Note,
  Textarea,
  cn,
} from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import {
  DEED_NATURE_MATCH_OPTIONS,
  deedNatureMatchRequiresNotes,
} from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import type { CaseStudyFormDraft } from "../../lib/app-data/case-study-form-model";

/**
 * Specialist review of deed↔nature match. Parties (inspector / engineering
 * office) or a prior survey propose; the specialist adopts or amends.
 * Lives on تبويب مدخلات المعاين — the case-study report is issued after valuation.
 */
const OUTCOME_HINTS: Record<string, string> = {
  matched:
    "الصك يطابق الطبيعة — يُسمح بإكمال التقييم ورفع تقرير دراسة الحالة.",
  differences:
    "توجد فروق بين الصك والطبيعة — يلزم توضيحها أدناه، ويُوقف مسار التقييم حتى تُعالَج (مسار تعذر).",
  impediment:
    "المطابقة غير ممكنة أو الحالة مرشحة لتعذر — يلزم التوضيح، ويُوقف التقييم ودراسة الحالة (مسار تعذر).",
};

export function CaseStudyDeedNatureMatchSection({
  draft,
  disabled,
  onPatch,
  outcomeInvalid,
  notesInvalid,
  sourceLabelAr,
  suggestedOutcome,
  onAdoptSuggestion,
}: {
  draft: Pick<CaseStudyFormDraft, "deedNatureMatchOutcome" | "deedNatureMatchNotes">;
  disabled?: boolean;
  onPatch: (patch: Partial<CaseStudyFormDraft>) => void;
  outcomeInvalid?: boolean;
  notesInvalid?: boolean;
  sourceLabelAr?: string;
  suggestedOutcome?: string;
  onAdoptSuggestion?: () => void;
}) {
  const outcome = draft.deedNatureMatchOutcome ?? "";
  const needsNotes = deedNatureMatchRequiresNotes(outcome);
  const canAdopt =
    Boolean(onAdoptSuggestion && suggestedOutcome && suggestedOutcome !== outcome);
  const outcomeHint = OUTCOME_HINTS[outcome] ?? "";

  return (
    <section
      id="cs-deed-nature-match"
      className={cn(
        "overflow-hidden rounded-[10px] border border-border",
        outcomeInvalid && invalidControlClass,
      )}
    >
      <header className="border-b border-border bg-surface-2 px-4 py-2.5">
        <h3 className="m-0 text-[12.5px] font-bold text-heading">
          مطابقة الصك على الطبيعة
        </h3>
      </header>

      <div className="grid gap-3.5 px-4 py-3.5">
        <Note tone="info">
          الطرف يقترح، وأنت تختار نتيجة المراجعة. الاختيار يُحفظ مباشرة ويحدد هل
          يستمر التقييم ودراسة الحالة أو يتحول لمسار تعذر.
        </Note>

        {sourceLabelAr ? (
          <p className="m-0 text-[12px] leading-relaxed text-text-2">
            {sourceLabelAr}
          </p>
        ) : null}

        {canAdopt ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onAdoptSuggestion}
            className="w-fit cursor-pointer rounded-[var(--radius-sm)] border border-gold bg-gold-soft px-3 py-[7px] text-[12px] font-bold text-gold-d disabled:cursor-not-allowed disabled:opacity-55"
          >
            قبول اقتراح الطرف كما هو
          </button>
        ) : null}

        <FormGroup>
          <Label className="mb-1 text-[11px] font-semibold text-text-2">
            نتيجة مراجعة الأخصائي
          </Label>
          <p className="mb-2 mt-0 text-[11px] leading-relaxed text-text-3">
            اختر نتيجة واحدة — ليست اعتمادًا نهائيًا للمعاملة، لكنها تؤثر فورًا على
            المسار المسموح بعده.
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="نتيجة مطابقة الصك على الطبيعة"
          >
            {DEED_NATURE_MATCH_OPTIONS.map((opt) => {
              const on = outcome === opt.value;
              return (
                <label
                  key={opt.value}
                  title={OUTCOME_HINTS[opt.value]}
                  className={cn(
                    "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-colors",
                    on
                      ? "border-ink bg-ink text-white"
                      : "border-border-md bg-surface text-text-2 hover:text-heading",
                    outcomeInvalid && !on && invalidControlClass,
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
          {outcomeHint ? (
            <p
              className={cn(
                "mb-0 mt-2 rounded-lg border px-3 py-2 text-[11.5px] leading-relaxed",
                outcome === "matched"
                  ? "border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[var(--success-bg)] text-[var(--success)]"
                  : "border-amber-200 bg-amber-50 text-amber-950",
              )}
              role="status"
            >
              {outcomeHint}
            </p>
          ) : null}
        </FormGroup>

        {needsNotes ? (
          <FormGroup>
            <Label
              htmlFor="deed-nature-match-notes"
              className="text-[11px] text-text-2"
            >
              ملاحظات الفروق / التعذر{" "}
              <span className="text-danger-text">*</span>
            </Label>
            <p className="mb-1.5 mt-0 text-[11px] text-text-3">
              إلزامية عند «فروق» أو «مرشح تعذر» — بدونها لا يُقبل رفع دراسة الحالة.
            </p>
            <Textarea
              id="deed-nature-match-notes"
              disabled={disabled}
              rows={3}
              value={draft.deedNatureMatchNotes ?? ""}
              aria-invalid={notesInvalid || undefined}
              onChange={(e) =>
                onPatch({ deedNatureMatchNotes: e.target.value })
              }
              className={cn(notesInvalid && invalidControlClass)}
              placeholder="صف الفرق أو سبب ترشيح التعذر…"
            />
          </FormGroup>
        ) : null}
      </div>
    </section>
  );
}
