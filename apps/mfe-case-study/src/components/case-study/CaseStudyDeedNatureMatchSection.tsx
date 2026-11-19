"use client";

import { useId, useState, type ReactNode } from "react";
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

/** What each outcome does — the choice's tooltip, and spelled out under the choices when it stops the valuation. */
const OUTCOME_HINTS: Record<string, string> = {
  [DeedNatureMatchOutcomes.Matched]: "الصك يطابق الطبيعة — يُسمح بإكمال التقييم وإصدار تقرير دراسة الحالة.",
  [DeedNatureMatchOutcomes.Differences]:
    "الصك لا يطابق الطبيعة — يلزم توضيح الفرق أدناه، ويُوقف مسار التقييم حتى يُعالَج (مسار تعذّر).",
  [DeedNatureMatchOutcomes.Impediment]:
    "المطابقة غير ممكنة أو الحالة تعذّر محتمل — يلزم التوضيح، ويُوقف التقييم ودراسة الحالة (مسار تعذّر).",
};

/** An outcome with the notes it is saved with, while the specialist writes them. */
type OutcomeEdit = { value: string; notes: string };

/**
 * The specialist's review of the deed↔nature match, on the inspector's inputs tab: the four sides beside
 * the inspector's findings, then the specialist's outcome. Only the field inspector proposes; a prior
 * survey and the engineering office's verdict are context lines.
 *
 * How it works: the buttons show the choice being made (`edit`), else the saved outcome; the inspector's
 * suggestion carries a «اقتراح المعاين» tag on its own button (it replaced a separate «اعتماد اقتراح المعاين»
 * button, 2026-11-19, that did what a click on the tagged button does). «مطابق» saves on
 * the click; an outcome that needs text — «غير مطابق» / «تعذّر محتمل», or «مطابق» against whoever said
 * «غير مطابق» — opens its notes, saved with it in one save (the server refuses it without them). Saved
 * notes are read, and changed through «تعديل».
 * Edge cases: clicking the saved outcome again drops the choice being made (it used to stay open — a
 * radio already checked fires no change); a new outcome starts with empty notes, so one outcome's reason
 * never becomes another's — except that «غير مطابق» suggested by the inspector starts with his notes for
 * each side, to edit; an outcome saved without its notes opens them at once.
 */
export function CaseStudyDeedNatureMatchSection({
  draft,
  disabled,
  onPatch,
  sourceLabelAr,
  suggestedOutcome,
  infoLinesAr,
  suggestedNotes = "",
  officeDetails,
  dissent = null,
  sides = [],
}: {
  draft: Pick<CaseStudyReportDraft, "deedNatureMatchOutcome" | "deedNatureMatchNotes">;
  disabled?: boolean;
  /** Saves at once — called once per decision, never per keystroke. */
  onPatch: (patch: Partial<CaseStudyReportDraft>) => void;
  sourceLabelAr?: string;
  suggestedOutcome?: string;
  /** Prior-survey / engineering-office context — shown, never proposed. */
  infoLinesAr?: readonly string[];
  /** The inspector's notes for each side, the start of «غير مطابق»'s notes when he suggested it. */
  suggestedNotes?: string;
  /** What the engineering office sent, behind «عرض ما أرسله المكتب الهندسي» — given once it is sent. */
  officeDetails?: ReactNode;
  /** The four sides: the deed beside the inspector's finding (empty until the inspection is in). */
  sides?: readonly DeedMatchSideRow[];
  /**
   * Who said «غير مطابق» — the inspector (2026-10-29) or, since A→Z 2026-11-02 #20, the engineering office:
   * «مطابق» then needs the specialist's reason, and the labels name whoever it goes against.
   */
  dissent?: DeedMatchDissent | null;
}) {
  const radioName = useId();
  const outcome = draft.deedNatureMatchOutcome ?? "";
  const savedNotes = (draft.deedNatureMatchNotes ?? "").trim();
  const dissentLabel = deedMatchDissentLabel(dissent);
  const isOverride = (value: string) => dissent !== null && value === DeedNatureMatchOutcomes.Matched;
  const needsText = (value: string) => deedNatureMatchRequiresNotes(value) || isOverride(value);
  const labelOf = (value: string) => DEED_NATURE_MATCH_OPTIONS.find((o) => o.value === value)?.label ?? "";

  const [edit, setEdit] = useState<OutcomeEdit | null>(null);
  const [officeOpen, setOfficeOpen] = useState(false);
  // An outcome saved without the text it needs opens its notes at once.
  const editor = edit ?? (needsText(outcome) && !savedNotes ? { value: outcome, notes: "" } : null);
  const shown = editor?.value ?? outcome;
  const shownHint = shown !== DeedNatureMatchOutcomes.Matched ? (OUTCOME_HINTS[shown] ?? "") : "";

  function choose(value: string) {
    if (value === outcome) {
      setEdit(null);
      return;
    }
    if (needsText(value)) {
      const fromInspector = value === suggestedOutcome && value === DeedNatureMatchOutcomes.Differences;
      setEdit({ value, notes: fromInspector ? suggestedNotes : "" });
      return;
    }
    setEdit(null);
    onPatch({ deedNatureMatchOutcome: value, deedNatureMatchNotes: "" });
  }

  return (
    <section id="cs-deed-nature-match" className="overflow-hidden rounded-[10px] border border-border">
      <header className="border-b border-border bg-surface-2 px-4 py-2.5">
        <h3 className="m-0 text-[12.5px] font-bold text-heading">مطابقة الصك على الطبيعة</h3>
      </header>

      <div className="grid gap-3.5 px-4 py-3.5">
        {sourceLabelAr ? <p className="m-0 text-[12px] leading-relaxed text-text-2">{sourceLabelAr}</p> : null}

        {sides.length > 0 ? <DeedMatchSidesTable sides={sides} /> : null}

        {infoLinesAr && infoLinesAr.length > 0 ? (
          <ul className="m-0 grid list-none gap-1 p-0 text-[11.5px] leading-relaxed text-text-3">
            {infoLinesAr.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}

        {officeDetails ? (
          <div>
            <button
              type="button"
              aria-expanded={officeOpen}
              onClick={() => setOfficeOpen((open) => !open)}
              className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[11.5px] font-semibold text-heading underline-offset-2 hover:underline"
            >
              <i className={cn("ti text-sm", officeOpen ? "ti-chevron-up" : "ti-chevron-down")} aria-hidden />
              {officeOpen ? "إخفاء ما أرسله المكتب الهندسي" : "عرض ما أرسله المكتب الهندسي"}
            </button>
            {officeOpen ? officeDetails : null}
          </div>
        ) : null}

        <FormGroup>
          {/* Omar 2026-11-12: no explanation bars here — each choice says what it does in its
              tooltip, and only a choice that stops the valuation is spelled out under them. */}
          <Label className="mb-1.5 text-[11px] font-semibold text-text-2">نتيجة مراجعة الأخصائي</Label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="نتيجة مطابقة الصك على الطبيعة">
            {DEED_NATURE_MATCH_OPTIONS.map((opt) => {
              const on = shown === opt.value;
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
                    name={radioName}
                    className="sr-only"
                    checked={on}
                    disabled={disabled}
                    onChange={() => choose(opt.value)}
                  />
                  {opt.label}
                  {opt.value === suggestedOutcome ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-px text-[10px] font-bold",
                        on ? "bg-white/20 text-on-ink" : "bg-gold-soft text-gold-d",
                      )}
                    >
                      اقتراح المعاين
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
          {shownHint ? (
            <p
              className="mb-0 mt-2 rounded-lg border border-[color-mix(in_srgb,var(--amber)_40%,var(--border))] bg-warning-bg px-3 py-2 text-[11.5px] leading-relaxed text-amber-text"
              role="status"
            >
              {shownHint}
            </p>
          ) : null}
        </FormGroup>

        {editor ? (
          <OutcomeNotesEditor
            edit={editor}
            override={isOverride(editor.value)}
            outcomeLabel={labelOf(editor.value)}
            dissent={dissent}
            disabled={disabled}
            onChange={setEdit}
            onCancel={edit ? () => setEdit(null) : undefined}
            onSave={() => {
              onPatch({ deedNatureMatchOutcome: editor.value, deedNatureMatchNotes: editor.notes.trim() });
              setEdit(null);
            }}
          />
        ) : needsText(outcome) && savedNotes ? (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[11.5px] leading-relaxed text-text-2">
            <p className="m-0 whitespace-pre-line">
              <span className="font-semibold text-heading">
                {isOverride(outcome) ? `سبب اعتماد «مطابق» خلافاً لرأي ${dissentLabel}` : `ملاحظات «${labelOf(outcome)}»`}:
              </span>{" "}
              {savedNotes}
            </p>
            {!disabled ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEdit({ value: outcome, notes: draft.deedNatureMatchNotes ?? "" })}
              >
                تعديل
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** The notes an outcome is saved with — written here, saved once with «حفظ». */
function OutcomeNotesEditor({
  edit,
  override,
  outcomeLabel,
  dissent,
  disabled,
  onChange,
  onCancel,
  onSave,
}: {
  edit: OutcomeEdit;
  /** «مطابق» against whoever said «غير مطابق»: a reason of DEED_MATCH_OVERRIDE_REASON_MIN characters. */
  override: boolean;
  outcomeLabel: string;
  dissent: DeedMatchDissent | null;
  disabled?: boolean;
  onChange: (edit: OutcomeEdit) => void;
  /** Absent when there is no saved state to go back to (an outcome saved without its notes). */
  onCancel?: () => void;
  onSave: () => void;
}) {
  const id = useId();
  const dissentLabel = deedMatchDissentLabel(dissent);
  const short = edit.notes.trim().length < (override ? DEED_MATCH_OVERRIDE_REASON_MIN : 1);
  return (
    <FormGroup>
      <Label htmlFor={id} className="text-[11px] text-text-2">
        {override ? `سبب اعتماد «مطابق» خلافاً لرأي ${dissentLabel}` : `ملاحظات «${outcomeLabel}»`}{" "}
        <span className="text-danger-text">*</span>
      </Label>
      <p className="mb-1.5 mt-0 text-[11px] text-text-3">
        {override
          ? deedMatchOverrideReasonMessage(dissent)
          : "إلزامية — بدونها لا تُحفظ النتيجة ولا يُصدر تقرير دراسة الحالة."}
      </p>
      <Textarea
        id={id}
        disabled={disabled}
        rows={3}
        value={edit.notes}
        onChange={(e) => onChange({ ...edit, notes: e.target.value })}
        className={cn(short && edit.notes.length > 0 && invalidControlClass)}
        placeholder={
          override
            ? `لماذا تعتبر الصك مطابقاً للطبيعة رغم رأي ${dissentLabel}؟`
            : "صف الفرق أو سبب ترشيح التعذّر…"
        }
      />
      <div className="mt-2 flex gap-2">
        <Button type="button" disabled={disabled || short} onClick={onSave}>
          {`حفظ «${outcomeLabel}»`}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" disabled={disabled} onClick={onCancel}>
            إلغاء
          </Button>
        ) : null}
      </div>
    </FormGroup>
  );
}
