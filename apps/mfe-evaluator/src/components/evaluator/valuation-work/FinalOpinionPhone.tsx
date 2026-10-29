// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • The weight box is type="text" filtered by costNumericInput (type="number" dropped Arabic
//           digits); the typed text stays while focused so «7,» can become «7,5».
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import { MobileRecordCard, MobileRecordList, cn } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import { parseLocaleNumber } from "@platform/app-shared/format/number";

import { costNumericInput } from "./lib/cost-approach-state";
import { fmt } from "./lib/shell-utils";
import type { useFinalOpinionWorkflow } from "./useFinalOpinionWorkflow";

export type ReconMethod = ReturnType<typeof useFinalOpinionWorkflow>["reconMethods"][number];

/** «القيمة الناتجة» / «القيمة بعد المشاركة» — table cell and phone field. */
export function reconMethodNote(m: ReconMethod, buildingOnly: boolean): string {
  return m.valueDocumentAttachmentId
    ? "قيمة واردة في مستند ذي قيمة — أثره من «مرفقات التقرير»"
    : m.approachKind === "cost"
      ? buildingOnly
        ? "مبنى فقط — تكلفة الإحلال ناقصاً الإهلاك"
        : "قيمة الأرض + تكلفة الإحلال − الإهلاك"
      : "مؤشر قيمة من طريقة المقارنة";
}

/** Participation-share input — table cell and phone card share it. */
export function ReconWeightInput({
  id,
  m,
  bad,
  invalid,
  onChange,
  touch,
}: {
  id: string;
  m: ReconMethod;
  bad: boolean;
  invalid: boolean;
  onChange: (raw: number) => void;
  touch?: boolean;
}) {
  // A text box (a type=number box drops Arabic-Indic digits): the typed text stays while the box
  // is focused («7,» on the way to «7,5»), the parsed share goes up on every keystroke.
  const [typed, setTyped] = useState<string | null>(null);
  return (
    <input
      id={id}
      dir="ltr"
      type="text"
      inputMode="decimal"
      value={typed ?? String(m.weightPct)}
      onChange={(e) => {
        const text = costNumericInput(e.target.value);
        setTyped(text);
        onChange(Math.min(100, Math.max(0, parseLocaleNumber(text) || 0)));
      }}
      onBlur={() => setTyped(null)}
      className={cn(
        "rounded-[7px] border p-2 text-center font-bold",
        touch ? "min-h-11 w-full text-[16px]" : "w-[82px]",
        bad
          ? "border-red bg-[rgba(192,85,61,.07)] text-red-text"
          : "border-border-md bg-surface text-heading",
        invalid && invalidControlClass,
      )}
    />
  );
}

export function ReconRationaleInput({
  m,
  onChange,
  touch,
}: {
  m: ReconMethod;
  onChange: (text: string) => void;
  touch?: boolean;
}) {
  return (
    <input
      value={m.rationale ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="مبرر نسبة المشاركة…"
      className={cn(
        "w-full rounded-[7px] border border-border px-2.5 py-2",
        touch ? "min-h-11 text-[16px]" : "text-xs",
      )}
    />
  );
}

/**
 * Phones: one card per approach — the 900px reconciliation table ran
 * off-screen. Same inputs as the table, then the weight-sum / weighted-value
 * footer.
 */
export function ReconMethodsPhone({
  id,
  idPrefix,
  methods,
  buildingOnly,
  methodComplete,
  methodShare,
  reconWeightsBad,
  weightSumLocal,
  weightedLocal,
  fieldErrors,
  onWeightChange,
  onRationaleChange,
}: {
  id: string | undefined;
  /** "" when the table is not mounted (phone ids take the error-scroll targets), else "m-". */
  idPrefix: string;
  methods: ReconMethod[];
  buildingOnly: boolean;
  methodComplete: ReturnType<typeof useFinalOpinionWorkflow>["methodComplete"];
  methodShare: (m: ReconMethod) => string;
  reconWeightsBad: boolean;
  weightSumLocal: number;
  weightedLocal: number;
  fieldErrors: Record<string, string>;
  onWeightChange: (idx: number, raw: number) => void;
  onRationaleChange: (idx: number, text: string) => void;
}) {
  return (
    <div id={id} className="mb-6 lg:hidden">
      <MobileRecordList>
        {methods.map((m, idx) => {
          const incomplete = !methodComplete(m.approachKind);
          return (
            <MobileRecordCard
              key={m.approachKind}
              tone={incomplete ? "red" : undefined}
              title={<span id={`${idPrefix}final-method-${idx}`}>{m.labelAr}</span>}
              subtitle={reconMethodNote(m, buildingOnly)}
              fields={[
                {
                  label: "القيمة الناتجة",
                  value: incomplete ? (
                    <span className="text-red-text">غير مكتمل</span>
                  ) : (
                    fmt(m.approachValue)
                  ),
                  ltr: !incomplete,
                },
                {
                  label: "القيمة بعد المشاركة",
                  value: incomplete ? "—" : methodShare(m),
                  ltr: !incomplete,
                },
              ]}
            >
              <div className="flex flex-col gap-2.5">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-text-3">
                    نسبة المشاركة (٪)
                  </span>
                  <ReconWeightInput
                    touch
                    id={`${idPrefix}final-method-weight-${idx}`}
                    m={m}
                    bad={reconWeightsBad}
                    invalid={Boolean(fieldErrors[`methods[${idx}].weightPct`])}
                    onChange={(raw) => onWeightChange(idx, raw)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-text-3">مبرر</span>
                  <ReconRationaleInput
                    touch
                    m={m}
                    onChange={(text) => onRationaleChange(idx, text)}
                  />
                </label>
              </div>
            </MobileRecordCard>
          );
        })}
      </MobileRecordList>
      <div className="mt-2.5 flex flex-col gap-1 rounded-[12px] border border-border bg-surface-2 px-4 py-3">
        <span
          className={cn(
            "text-[12.5px] font-bold",
            reconWeightsBad ? "text-red-text" : "text-[#3f8f5f]",
          )}
        >
          مجموع نسب المشاركة: {weightSumLocal}٪
          {reconWeightsBad ? " — يجب أن يساوي 100٪" : ""}
        </span>
        <span
          className={cn(
            "text-[13px] font-bold",
            reconWeightsBad ? "text-red-text" : "text-heading",
          )}
        >
          القيمة المرجّحة: <span dir="ltr">{fmt(weightedLocal)}</span> ر.س
        </span>
      </div>
    </div>
  );
}
