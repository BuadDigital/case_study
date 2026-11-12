"use client";

import { useState } from "react";
import {
  Button,
  FormGroup,
  Label,
  Textarea,
  cn,
} from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import {
  DEED_MATCH_OVERRIDE_REASON_MIN,
  DEED_NATURE_MATCH_OPTIONS,
  DeedNatureMatchOutcomes,
  deedMatchDissentLabel,
  deedMatchOverrideReasonMessage,
  deedNatureMatchRequiresNotes,
  type DeedMatchDissent,
} from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import type { CaseStudyReportDraft } from "@platform/app-shared/app-data/case-study-report-model";
import type { DeedMatchSideRow } from "../../lib/app-data/deed-nature-match-proposal";

/**
 * Each side of the deed beside the inspector's finding there (Omar 2026-11-10: the specialist decides
 * from what he sees here — the deed's boundary and length, the inspector's «مطابق / غير مطابق» and note).
 * Since 2026-11-12 it also carries each side's facade type, so the read-only «الحدود والأطوال»
 * table under it is not repeated; the column shows only when some side has a facade (an apartment
 * records none). The table spans its card like every table (a narrower one, tried 2026-11-12, left
 * an empty band beside it); the short columns keep a fixed width and their headers stay on one
 * line, so the deed's wording and the inspector's note share the rest.
 */
function DeedMatchSidesTable({ sides }: { sides: readonly DeedMatchSideRow[] }) {
  const th =
    "whitespace-nowrap border-b border-border bg-surface-2 px-3 py-1.5 text-right text-[11px] font-bold text-text-2";
  const td = "border-b border-border px-3 py-1.5 text-right align-top text-[12px] text-text";
  const showFacade = sides.some((s) => s.facade);
  return (
    <table className="w-full border-collapse overflow-hidden rounded-lg border border-border">
      <thead>
        <tr>
          <th className={cn(th, "w-28")}>الحد</th>
          {showFacade ? <th className={cn(th, "w-28")}>نوع الواجهة</th> : null}
          <th className={th}>حسب الصك</th>
          <th className={cn(th, "w-24")}>الطول</th>
          <th className={cn(th, "w-40")}>المعاين على الطبيعة</th>
          <th className={th}>ملاحظة المعاين</th>
        </tr>
      </thead>
      <tbody>
        {sides.map((s) => (
          <tr key={s.side}>
            <td className={cn(td, "font-semibold text-heading")}>{s.label}</td>
            {showFacade ? <td className={td}>{s.facade || "—"}</td> : null}
            <td className={td}>{s.deedDesc}</td>
            <td className={td}>
              <span dir="ltr">{s.deedLength}</span>
            </td>
            <td
              className={cn(
                td,
                "font-semibold",
                s.matches === true
                  ? "text-success-text"
                  : s.matches === false
                    ? "text-red-text"
                    : "text-text-3",
              )}
            >
              {s.matches === true ? "مطابق" : s.matches === false ? "غير مطابق" : "لم يحدد"}
            </td>
            <td className={cn(td, "text-text-2")}>{s.note || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Specialist review of deed↔nature match. Only the field inspector proposes;
 * a prior survey and the engineering office's verdict are shown as context
 * lines. The specialist adopts or amends.
 * Lives on تبويب مدخلات المعاين — the case-study report is issued after valuation.
 */
const OUTCOME_HINTS: Record<string, string> = {
  matched:
    "الصك يطابق الطبيعة — يُسمح بإكمال التقييم وإصدار تقرير دراسة الحالة.",
  differences:
    "توجد فروق بين الصك والطبيعة — يلزم توضيحها أدناه، ويُوقف مسار التقييم حتى تُعالَج (مسار تعذّر).",
  impediment:
    "المطابقة غير ممكنة أو الحالة تعذّر محتمل — يلزم التوضيح، ويُوقف التقييم ودراسة الحالة (مسار تعذّر).",
};

export function CaseStudyDeedNatureMatchSection({
  draft,
  disabled,
  onPatch,
  outcomeInvalid,
  notesInvalid,
  sourceLabelAr,
  suggestedOutcome,
  infoLinesAr,
  onAdoptSuggestion,
  dissent = null,
  sides = [],
}: {
  draft: Pick<CaseStudyReportDraft, "deedNatureMatchOutcome" | "deedNatureMatchNotes">;
  disabled?: boolean;
  onPatch: (patch: Partial<CaseStudyReportDraft>) => void;
  outcomeInvalid?: boolean;
  notesInvalid?: boolean;
  sourceLabelAr?: string;
  suggestedOutcome?: string;
  /** Prior-survey / engineering-office context — shown, never proposed. */
  infoLinesAr?: readonly string[];
  onAdoptSuggestion?: () => void;
  /** The four sides: the deed beside the inspector's finding (empty until the inspection is in). */
  sides?: readonly DeedMatchSideRow[];
  /**
   * Who said «غير مطابق» — the inspector (2026-10-29) or, since A→Z 2026-11-02 #20, the engineering office:
   * «مطابق» then needs the specialist's reason, and the labels name whoever it goes against.
   */
  dissent?: DeedMatchDissent | null;
}) {
  const outcome = draft.deedNatureMatchOutcome ?? "";
  const inspectorSaidNotMatched = dissent !== null;
  const dissentLabel = deedMatchDissentLabel(dissent);
  // An outcome that needs text — «فروق» / «تعذّر محتمل», or «مطابق» against the inspector — is not saved on
  // click: its notes are written first and saved with it (a click alone is refused by the server and rolled
  // back), and they start empty — the reason of one outcome never becomes the notes of another.
  const [pending, setPending] = useState<{ value: string; notes: string } | null>(null);
  const pendingIsOverride =
    pending?.value === DeedNatureMatchOutcomes.Matched && inspectorSaidNotMatched;
  const pendingMin = pendingIsOverride ? DEED_MATCH_OVERRIDE_REASON_MIN : 1;
  const pendingShort = (pending?.notes ?? "").trim().length < pendingMin;
  const pendingLabel =
    DEED_NATURE_MATCH_OPTIONS.find((o) => o.value === pending?.value)?.label ?? "";
  const savedOverrideReason =
    inspectorSaidNotMatched && outcome === DeedNatureMatchOutcomes.Matched
      ? (draft.deedNatureMatchNotes ?? "").trim()
      : "";
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
        {sourceLabelAr ? (
          <p className="m-0 text-[12px] leading-relaxed text-text-2">
            {sourceLabelAr}
          </p>
        ) : null}

        {sides.length > 0 ? <DeedMatchSidesTable sides={sides} /> : null}

        {infoLinesAr && infoLinesAr.length > 0 ? (
          <ul className="m-0 grid list-none gap-1 p-0 text-[11.5px] leading-relaxed text-text-3">
            {infoLinesAr.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}

        {canAdopt ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onAdoptSuggestion}
            className="w-fit cursor-pointer rounded-[var(--radius-sm)] border border-gold bg-gold-soft px-3 py-[7px] text-[12px] font-bold text-gold-d disabled:cursor-not-allowed disabled:opacity-55"
          >
            اعتماد اقتراح المعاين
          </button>
        ) : null}

        <FormGroup>
          {/* Omar 2026-11-12: no explanation bars here — each choice says what it does in its
              tooltip, and only a choice that stops the valuation is spelled out under them. */}
          <Label className="mb-1.5 text-[11px] font-semibold text-text-2">
            نتيجة مراجعة الأخصائي
          </Label>
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="نتيجة مطابقة الصك على الطبيعة"
            aria-invalid={outcomeInvalid || undefined}
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
                      ? "border-heading bg-[color-mix(in_srgb,var(--heading)_18%,var(--ink))] text-on-ink"
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
                    onChange={() => {
                      const needsText =
                        deedNatureMatchRequiresNotes(opt.value) ||
                        (inspectorSaidNotMatched && opt.value === DeedNatureMatchOutcomes.Matched);
                      if (needsText) {
                        setPending({ value: opt.value, notes: "" });
                        return;
                      }
                      setPending(null);
                      onPatch({ deedNatureMatchOutcome: opt.value, deedNatureMatchNotes: "" });
                    }}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
          {outcomeHint && outcome !== "matched" ? (
            <p
              className="mb-0 mt-2 rounded-lg border border-[color-mix(in_srgb,var(--amber)_40%,var(--border))] bg-warning-bg px-3 py-2 text-[11.5px] leading-relaxed text-amber-text"
              role="status"
            >
              {outcomeHint}
            </p>
          ) : null}
        </FormGroup>

        {pending ? (
          <FormGroup>
            <Label htmlFor="deed-match-pending-notes" className="text-[11px] text-text-2">
              {pendingIsOverride ? `سبب اعتماد «مطابق» خلافاً لرأي ${dissentLabel}` : "ملاحظات الفروق / التعذّر"}{" "}
              <span className="text-danger-text">*</span>
            </Label>
            <Textarea
              id="deed-match-pending-notes"
              disabled={disabled}
              rows={3}
              value={pending.notes}
              onChange={(e) => setPending({ ...pending, notes: e.target.value })}
              className={cn(pendingShort && pending.notes.length > 0 && invalidControlClass)}
              placeholder={
                pendingIsOverride
                  ? `لماذا تعتبر الصك مطابقاً للطبيعة رغم رأي ${dissentLabel}؟`
                  : "صف الفرق أو سبب ترشيح التعذّر…"
              }
            />
            {pendingIsOverride && pendingShort ? (
              <p className="mb-0 mt-1 text-[11px] text-text-3">{deedMatchOverrideReasonMessage(dissent)}</p>
            ) : null}
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                disabled={disabled || pendingShort}
                onClick={() => {
                  onPatch({
                    deedNatureMatchOutcome: pending.value,
                    deedNatureMatchNotes: pending.notes.trim(),
                  });
                  setPending(null);
                }}
              >
                {`حفظ «${pendingLabel}» مع ${pendingIsOverride ? "السبب" : "الملاحظات"}`}
              </Button>
              <Button type="button" variant="ghost" disabled={disabled} onClick={() => setPending(null)}>
                إلغاء
              </Button>
            </div>
          </FormGroup>
        ) : savedOverrideReason ? (
          <p className="m-0 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[11.5px] leading-relaxed text-text-2">
            سبب اعتماد «مطابق» خلافاً لرأي {dissentLabel}: {savedOverrideReason}
          </p>
        ) : null}

        {needsNotes && !pending ? (
          <FormGroup>
            <Label
              htmlFor="deed-nature-match-notes"
              className="text-[11px] text-text-2"
            >
              ملاحظات الفروق / التعذّر{" "}
              <span className="text-danger-text">*</span>
            </Label>
            <p className="mb-1.5 mt-0 text-[11px] text-text-3">
              إلزامية عند «فروق» أو «تعذّر محتمل» — بدونها لا يُقبل إصدار تقرير دراسة الحالة.
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
              placeholder="صف الفرق أو سبب ترشيح التعذّر…"
            />
          </FormGroup>
        ) : null}
      </div>
    </section>
  );
}
