"use client";

import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import {
  Input,
  MobileRecordCard,
  MobileRecordList,
  TBody,
  THead,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
  YesNoToggle,
  cn,
  opsFieldBox,
  opsLetterCard,
  useToast,
} from "@platform/ui-kit";
import type { EvaluatorChecklistAnswers } from "../../lib/evaluator/evaluator-window-data";
import {
  EVALUATOR_CONDITIONAL_QUESTIONS,
  EVALUATOR_SIMPLE_QUESTIONS,
} from "../../lib/evaluator/evaluator-window-data";
import { EngSection } from "./EvaluatorHtmlPrimitives";

type ChecklistKey = keyof EvaluatorChecklistAnswers;

/** The follow-up a «نعم» opens under some items — shared by the table row and the phone card. */
function ChecklistRowExtra({
  qid,
  idPrefix,
  checklist,
  disabled,
  fieldErrors,
  onChange,
  phone,
}: {
  qid: ChecklistKey;
  /** Keeps input ids unique while the table and the cards are both mounted. */
  idPrefix: string;
  checklist: EvaluatorChecklistAnswers;
  disabled?: boolean;
  fieldErrors?: Record<string, string>;
  onChange: (patch: Partial<EvaluatorChecklistAnswers>) => void;
  /** Phone card: the nested نعم/لا spans the card width. */
  phone?: boolean;
}) {
  return (
    qid === "q_shared_deed" && checklist.q_shared_deed === true ? (
      <div
        className={cn(
          opsFieldBox,
          "mt-3 space-y-3 border-[color-mix(in_srgb,var(--gold)_28%,transparent)] bg-[color-mix(in_srgb,var(--gold)_6%,transparent)]",
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12px] font-bold text-heading">
            نطاق الملكية <span className="text-danger-text">*</span>
          </span>
          <div
            role="radiogroup"
            aria-label="نطاق الملكية"
            className="inline-flex flex-wrap gap-1.5 max-lg:flex max-lg:w-full"
          >
            {(
              [
                ["full", "كامل المساحة"],
                ["part", "جزء محدد"],
              ] as const
            ).map(([v, label]) => {
              const on = checklist.shared_deed_scope === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={disabled}
                  onClick={() => onChange({ shared_deed_scope: v })}
                  className={cn(
                    "rounded-[var(--radius-DEFAULT)] border px-3 py-1.5 text-[12px] font-semibold transition-colors max-lg:min-h-11 max-lg:flex-1",
                    "disabled:cursor-not-allowed disabled:opacity-55",
                    on
                      ? "border-gold bg-gold-soft text-gold-d"
                      : "border-border-md bg-surface text-text-2 hover:border-gold hover:text-gold-d",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {checklist.shared_deed_scope === "part" ? (
          <div className="lg:max-w-[280px]">
            <label
              htmlFor={`${idPrefix}-shared-deed-pct`}
              className="mb-1.5 block text-[12px] font-semibold text-text-2"
            >
              نسبة الملكية <span className="text-danger-text">*</span>
              <span className="ms-1 font-normal text-text-3">
                (مثال: 3/8 أو 37.5%)
              </span>
            </label>
            <Input
              id={`${idPrefix}-shared-deed-pct`}
              dir="ltr"
              disabled={disabled}
              hasError={Boolean(fieldErrors?.shared_deed_percentage)}
              value={checklist.shared_deed_percentage}
              onChange={(e) =>
                onChange({ shared_deed_percentage: e.target.value })
              }
            />
            {fieldErrors?.shared_deed_percentage ? (
              <p className="mt-1 m-0 text-xs text-danger-text">
                {fieldErrors.shared_deed_percentage}
              </p>
            ) : null}
          </div>
        ) : null}
        {fieldErrors?.shared_deed_scope ? (
          <p className="m-0 text-xs text-danger-text">
            {fieldErrors.shared_deed_scope}
          </p>
        ) : null}
      </div>
    ) : qid === "q_lease_exists" &&
      checklist.q_lease_exists === true ? (
      <div
        className={cn(
          opsFieldBox,
          "mt-3 flex flex-wrap items-center gap-3 border-[color-mix(in_srgb,var(--gold)_28%,transparent)] bg-[color-mix(in_srgb,var(--gold)_6%,transparent)]",
        )}
      >
        <span className="text-[12px] font-bold text-heading">
          هل عقد الإيجار ساري المفعول؟{" "}
          <span className="text-danger-text">*</span>
        </span>
        <YesNoToggle
          block={phone}
          name={`${idPrefix}q_lease`}
          value={checklist.q_lease_active}
          disabled={disabled}
          onChange={(v) => onChange({ q_lease_active: v })}
        />
        {fieldErrors?.q_lease_active ? (
          <p className="m-0 w-full text-xs text-danger-text">
            {fieldErrors.q_lease_active}
          </p>
        ) : null}
      </div>
    ) : qid === "q_technical_notes_exists" &&
      checklist.q_technical_notes_exists === true ? (
      <div
        className={cn(
          opsFieldBox,
          "mt-3 border-[color-mix(in_srgb,var(--gold)_28%,transparent)] bg-[color-mix(in_srgb,var(--gold)_6%,transparent)]",
        )}
      >
        <label
          htmlFor={`${idPrefix}-technical-notes`}
          className="mb-1.5 block text-[12px] font-semibold text-text-2"
        >
          وصف الملاحظات الفنية{" "}
          <span className="text-danger-text">*</span>
        </label>
        <Textarea
          id={`${idPrefix}-technical-notes`}
          rows={2}
          disabled={disabled}
          hasError={Boolean(fieldErrors?.technical_notes_text)}
          value={checklist.technical_notes_text}
          onChange={(e) =>
            onChange({ technical_notes_text: e.target.value })
          }
          className="bg-surface"
        />
        {fieldErrors?.technical_notes_text ? (
          <p className="mt-1 m-0 text-xs text-danger-text">
            {fieldErrors.technical_notes_text}
          </p>
        ) : null}
      </div>
    ) : null
  );
}

export function EvaluatorChecklistTab({
  checklist,
  disabled,
  error,
  fieldErrors,
  onChange,
}: {
  checklist: EvaluatorChecklistAnswers;
  disabled?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  onChange: (patch: Partial<EvaluatorChecklistAnswers>) => void;
}) {
  const desktop = useViewportDesktop();
  const rows = [
    ...EVALUATOR_SIMPLE_QUESTIONS,
    ...EVALUATOR_CONDITIONAL_QUESTIONS,
  ];
  const setAnswer = (id: ChecklistKey, v: boolean) =>
    onChange({ [id]: v } as Partial<EvaluatorChecklistAnswers>);

  return (
    <div>
      <EngSection>قائمة فحص المقيّم — {rows.length} بنداً</EngSection>
      {error ? (
        <p className="mb-2 m-0 text-[12px] text-danger-text" role="alert">
          {error}
        </p>
      ) : null}

      {/* Phones: one card per item — question on top, a full-width نعم/لا under it,
          then the follow-up fields the answer opens. */}
      {desktop !== true ? (
        <MobileRecordList className="lg:hidden">
          {rows.map((q, idx) => {
            const val = checklist[q.id] as boolean | null;
            const rowError = fieldErrors?.[q.id];
            return (
              <MobileRecordCard
                key={q.id}
                tone={rowError ? "red" : val === null ? "gold" : undefined}
                title={
                  <span className="font-medium">
                    <bdi className="me-1.5 tabular-nums text-text-3">{idx + 1}.</bdi>
                    {q.label}
                  </span>
                }
              >
                <YesNoToggle
                  block
                  name={`mvalq_${String(q.id)}`}
                  value={val}
                  disabled={disabled}
                  onChange={(v) => setAnswer(q.id, v)}
                />
                {rowError ? (
                  <p className="mt-1.5 m-0 text-xs text-danger-text">{rowError}</p>
                ) : null}
                <ChecklistRowExtra
                  qid={q.id}
                  idPrefix="mval"
                  phone
                  checklist={checklist}
                  disabled={disabled}
                  fieldErrors={fieldErrors}
                  onChange={onChange}
                />
              </MobileRecordCard>
            );
          })}
        </MobileRecordList>
      ) : null}

      {desktop !== false ? (
      <div className={cn(opsLetterCard, "max-lg:hidden")}>
        <Table wrapClassName="rounded-[var(--radius-lg)]">
          <THead>
            <Tr hoverable={false}>
              <Th className="w-12 text-center">#</Th>
              <Th>البند</Th>
              <Th className="w-[132px] text-center">نعم / لا</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((q, idx) => {
              const val = checklist[q.id] as boolean | null;
              const rowError = fieldErrors?.[q.id];

              const extra = (
                <ChecklistRowExtra
                  qid={q.id}
                  idPrefix="val"
                  checklist={checklist}
                  disabled={disabled}
                  fieldErrors={fieldErrors}
                  onChange={onChange}
                />
              );

              return (
                <Tr key={q.id} hoverable={!disabled}>
                  <Td className="w-12 text-center text-[12px] font-semibold text-text-3">
                    {idx + 1}
                  </Td>
                  <Td className="leading-relaxed">
                    <div className="text-[13px] font-medium text-heading">
                      {q.label}
                    </div>
                    {rowError ? (
                      <p className="mt-1 m-0 text-xs text-danger-text">
                        {rowError}
                      </p>
                    ) : null}
                    {extra}
                  </Td>
                  <Td className="w-[132px] text-center">
                    <div className="flex justify-center">
                      <YesNoToggle
                        name={`valq_${String(q.id)}`}
                        value={val}
                        disabled={disabled}
                        onChange={(v) => setAnswer(q.id, v)}
                      />
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </div>
      ) : null}
    </div>
  );
}

export function EvaluatorCopyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { showToast } = useToast();
  return (
    <div className={`${opsFieldBox} relative`}>
      <div className="mb-[3px] text-[10.5px] text-text-3">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12.5px] font-semibold text-text">
          {value || "—"}
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 rounded-[var(--radius-sm)] border-none bg-transparent p-1 text-text-3 transition-colors hover:bg-surface hover:text-gold-d"
          title={`نسخ ${label}`}
          onClick={() => {
            void navigator.clipboard.writeText(value).then(
              () => showToast(`تم النسخ: ${value}`, "success"),
              () => showToast("تعذّر النسخ.", "error"),
            );
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
