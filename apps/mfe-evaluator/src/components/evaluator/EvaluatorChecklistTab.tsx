"use client";

import {
  Input,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  cn,
  useToast,
} from "@platform/design-system";
import type { EvaluatorChecklistAnswers } from "../../lib/evaluator/evaluator-window-data";
import {
  EVALUATOR_CONDITIONAL_QUESTIONS,
  EVALUATOR_SIMPLE_QUESTIONS,
} from "../../lib/evaluator/evaluator-window-data";
import { engBoxClassName, EngSection } from "./EvaluatorHtmlPrimitives";

type ChecklistKey = keyof EvaluatorChecklistAnswers;

function YesNoToggle({
  name,
  value,
  disabled,
  onChange,
}: {
  name: string;
  value: boolean | null;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="نعم أو لا"
      className="inline-flex rounded-[var(--radius-DEFAULT)] border border-border-md bg-surface-2 p-0.5"
    >
      {(
        [
          [true, "نعم"],
          [false, "لا"],
        ] as const
      ).map(([v, label]) => {
        const on = value === v;
        return (
          <button
            key={String(v)}
            type="button"
            role="radio"
            name={name}
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(
              "min-w-[44px] rounded-[calc(var(--radius-DEFAULT)-2px)] border border-transparent px-2.5 py-1.5 text-[12px] font-semibold transition-colors",
              "disabled:cursor-not-allowed disabled:opacity-55",
              on
                ? v
                  ? "border-[color-mix(in_srgb,#3f8f5f_35%,transparent)] bg-[color-mix(in_srgb,#3f8f5f_14%,transparent)] text-[#2f7a4d]"
                  : "border-[color-mix(in_srgb,#d9694f_35%,transparent)] bg-[color-mix(in_srgb,#d9694f_12%,transparent)] text-[#a5432e]"
                : "bg-transparent text-text-2 hover:bg-surface hover:text-heading",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
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
  const rows = [
    ...EVALUATOR_SIMPLE_QUESTIONS,
    ...EVALUATOR_CONDITIONAL_QUESTIONS,
  ];

  return (
    <div>
      <EngSection>قائمة فحص المقيم — {rows.length} بنداً</EngSection>
      {error ? (
        <p className="mb-2 m-0 text-[12px] text-danger-text" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-card">
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

              const extra =
                q.id === "q_shared_deed" && checklist.q_shared_deed === true ? (
                  <div
                    className={cn(
                      engBoxClassName,
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
                        className="inline-flex flex-wrap gap-1.5"
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
                                "rounded-[var(--radius-DEFAULT)] border px-3 py-1.5 text-[12px] font-semibold transition-colors",
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
                      <div className="max-w-[280px]">
                        <label
                          htmlFor="val-shared-deed-pct"
                          className="mb-1.5 block text-[12px] font-semibold text-text-2"
                        >
                          نسبة الملكية <span className="text-danger-text">*</span>
                          <span className="ms-1 font-normal text-text-3">
                            (مثال: 3/8 أو 37.5%)
                          </span>
                        </label>
                        <Input
                          id="val-shared-deed-pct"
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
                ) : q.id === "q_lease_exists" &&
                  checklist.q_lease_exists === true ? (
                  <div
                    className={cn(
                      engBoxClassName,
                      "mt-3 flex flex-wrap items-center gap-3 border-[color-mix(in_srgb,var(--gold)_28%,transparent)] bg-[color-mix(in_srgb,var(--gold)_6%,transparent)]",
                    )}
                  >
                    <span className="text-[12px] font-bold text-heading">
                      هل عقد الإيجار ساري المفعول؟{" "}
                      <span className="text-danger-text">*</span>
                    </span>
                    <YesNoToggle
                      name="valq_lease"
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
                ) : q.id === "q_technical_notes_exists" &&
                  checklist.q_technical_notes_exists === true ? (
                  <div
                    className={cn(
                      engBoxClassName,
                      "mt-3 border-[color-mix(in_srgb,var(--gold)_28%,transparent)] bg-[color-mix(in_srgb,var(--gold)_6%,transparent)]",
                    )}
                  >
                    <label
                      htmlFor="val-technical-notes"
                      className="mb-1.5 block text-[12px] font-semibold text-text-2"
                    >
                      وصف الملاحظات الفنية{" "}
                      <span className="text-danger-text">*</span>
                    </label>
                    <Textarea
                      id="val-technical-notes"
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
                ) : null;

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
                        onChange={(v) =>
                          onChange({
                            [q.id]: v,
                          } as Partial<EvaluatorChecklistAnswers>)
                        }
                      />
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </div>
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
    <div className={`${engBoxClassName} relative`}>
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
              () => showToast(`نُسخ: ${value}`, "success"),
              () => showToast("تعذر النسخ التلقائي.", "error"),
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
