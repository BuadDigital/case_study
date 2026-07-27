"use client";

import { cn, useToast } from "@platform/design-system";
import type { EvaluatorChecklistAnswers } from "../../lib/evaluator/evaluator-window-data";
import {
  EVALUATOR_CONDITIONAL_QUESTIONS,
  EVALUATOR_SIMPLE_QUESTIONS,
} from "../../lib/evaluator/evaluator-window-data";
import { engBoxClassName, EngSection } from "./EvaluatorHtmlPrimitives";

type ChecklistKey = keyof EvaluatorChecklistAnswers;

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

  function yn(id: ChecklistKey, val: boolean | null) {
    return (
      <div className="flex justify-center gap-3">
        {(
          [
            [true, "نعم"],
            [false, "لا"],
          ] as const
        ).map(([v, label]) => (
          <label
            key={String(v)}
            className="inline-flex cursor-pointer items-center gap-1 text-[11.5px]"
          >
            <input
              type="radio"
              name={`valq_${String(id)}`}
              disabled={disabled}
              checked={val === v}
              onChange={() =>
                onChange({ [id]: v } as Partial<EvaluatorChecklistAnswers>)
              }
              className="accent-[var(--gold-d,#8c7857)]"
            />
            {label}
          </label>
        ))}
      </div>
    );
  }

  return (
    <div>
      <EngSection>قائمة فحص المقيم — {rows.length} بنداً</EngSection>
      {error ? (
        <p className="mb-2 m-0 text-[11px] text-[#a5432e]">{error}</p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr>
              {["#", "البند", "نعم / لا"].map((h, i) => (
                <th
                  key={h}
                  className={cn(
                    "bg-surface-2 px-3 py-2 text-[11px] font-semibold text-text-2",
                    i === 0 ? "w-[34px] text-center" : "text-start",
                    i === 2 && "w-[110px]",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((q, idx) => {
              const val = checklist[q.id] as boolean | null;
              const extra =
                q.id === "q_shared_deed" && checklist.q_shared_deed === true ? (
                  <div className="mt-2 grid gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-3.5">
                      <span className="text-[11.5px] font-bold text-text-2">
                        نطاق الملكية *
                      </span>
                      {(
                        [
                          ["full", "كامل المساحة"],
                          ["part", "جزء محدد"],
                        ] as const
                      ).map(([v, label]) => (
                        <label
                          key={v}
                          className="inline-flex cursor-pointer items-center gap-1 text-[11.5px]"
                        >
                          <input
                            type="radio"
                            name="valq_scope"
                            disabled={disabled}
                            checked={checklist.shared_deed_scope === v}
                            onChange={() => onChange({ shared_deed_scope: v })}
                            className="accent-[var(--gold-d,#8c7857)]"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {checklist.shared_deed_scope === "part" ? (
                      <div className="max-w-[260px]">
                        <label className="mb-1 block text-[11px] font-medium text-text-2">
                          نسبة الملكية * (مثال: 3/8 أو 37.5%)
                        </label>
                        <input
                          dir="ltr"
                          disabled={disabled}
                          value={checklist.shared_deed_percentage}
                          onChange={(e) =>
                            onChange({ shared_deed_percentage: e.target.value })
                          }
                          className="w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none"
                        />
                        {fieldErrors?.shared_deed_percentage ? (
                          <p className="mt-1 m-0 text-[11px] text-[#a5432e]">
                            {fieldErrors.shared_deed_percentage}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {fieldErrors?.shared_deed_scope ? (
                      <p className="m-0 text-[11px] text-[#a5432e]">
                        {fieldErrors.shared_deed_scope}
                      </p>
                    ) : null}
                  </div>
                ) : q.id === "q_lease_exists" &&
                  checklist.q_lease_exists === true ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3.5 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                    <span className="text-[11.5px] font-bold text-text-2">
                      هل عقد الإيجار ساري المفعول؟ *
                    </span>
                    {(
                      [
                        [true, "نعم"],
                        [false, "لا"],
                      ] as const
                    ).map(([v, label]) => (
                      <label
                        key={String(v)}
                        className="inline-flex cursor-pointer items-center gap-1 text-[11.5px]"
                      >
                        <input
                          type="radio"
                          name="valq_lease"
                          disabled={disabled}
                          checked={checklist.q_lease_active === v}
                          onChange={() => onChange({ q_lease_active: v })}
                          className="accent-[var(--gold-d,#8c7857)]"
                        />
                        {label}
                      </label>
                    ))}
                    {fieldErrors?.q_lease_active ? (
                      <p className="m-0 w-full text-[11px] text-[#a5432e]">
                        {fieldErrors.q_lease_active}
                      </p>
                    ) : null}
                  </div>
                ) : q.id === "q_technical_notes_exists" &&
                  checklist.q_technical_notes_exists === true ? (
                  <div className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                    <label className="mb-1 block text-[11px] font-medium text-text-2">
                      وصف الملاحظات الفنية *
                    </label>
                    <textarea
                      rows={2}
                      disabled={disabled}
                      value={checklist.technical_notes_text}
                      onChange={(e) =>
                        onChange({ technical_notes_text: e.target.value })
                      }
                      className="w-full resize-y rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none"
                    />
                    {fieldErrors?.technical_notes_text ? (
                      <p className="mt-1 m-0 text-[11px] text-[#a5432e]">
                        {fieldErrors.technical_notes_text}
                      </p>
                    ) : null}
                  </div>
                ) : null;

              return (
                <tr key={q.id}>
                  <td className="border-b border-border px-3 py-2 text-center text-text-3">
                    {idx + 1}
                  </td>
                  <td className="border-b border-border px-3 py-2 leading-relaxed text-text">
                    {q.label}
                    {extra}
                  </td>
                  <td className="w-[110px] border-b border-border px-3 py-2">
                    {yn(q.id, val)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
        <div className="text-[12.5px] font-semibold text-text">{value || "—"}</div>
        <button
          type="button"
          className="inline-flex shrink-0 border-none bg-transparent p-0.5 text-text-3 hover:text-gold-d"
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
