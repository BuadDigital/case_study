"use client";

import { useEffect, useRef, useState } from "react";
import {
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  cn,
} from "@platform/ui-kit";
import { ENGINEERING_SURVEY_CHECKLIST_ITEMS } from "../lib/engineering-survey-data";
import type { EngineeringSurveyChecklistRow } from "../lib/engineering-survey-data";
import { patchChecklistRow } from "../lib/engineering-survey-submission-storage";

const EMPTY_CHECKLIST_ROW: EngineeringSurveyChecklistRow = {
  answer: null,
  note: "",
};

function YesNoToggle({
  name,
  value,
  disabled,
  onChange,
}: {
  name: string;
  value: "yes" | "no" | null;
  disabled?: boolean;
  onChange: (next: "yes" | "no") => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="نعم أو لا"
      className="inline-flex rounded-[var(--radius-DEFAULT)] border border-border-md bg-surface-2 p-0.5"
    >
      {(
        [
          ["yes", "نعم"],
          ["no", "لا"],
        ] as const
      ).map(([v, label]) => {
        const on = value === v;
        return (
          <button
            key={v}
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
                ? v === "yes"
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

function ChecklistNoteField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (note: string) => void;
}) {
  const [text, setText] = useState(value);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(value);
  }, [value]);

  return (
    <Textarea
      rows={1}
      disabled={disabled}
      value={text}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        onChange(text);
      }}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        onChange(next);
      }}
      className="min-h-[38px] text-[12.5px]"
    />
  );
}

export function EngineeringSurveyChecklist({
  rows,
  disabled,
  onChange,
}: {
  rows: EngineeringSurveyChecklistRow[];
  disabled?: boolean;
  onChange: (rows: EngineeringSurveyChecklistRow[]) => void;
}) {
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-card">
      <Table wrapClassName="rounded-[var(--radius-lg)]">
        <THead>
          <Tr hoverable={false}>
            <Th className="w-12 text-center">#</Th>
            <Th>البند</Th>
            <Th className="w-[132px] text-center">نعم / لا</Th>
            <Th className="min-w-[160px]">ملاحظة</Th>
          </Tr>
        </THead>
        <TBody>
          {ENGINEERING_SURVEY_CHECKLIST_ITEMS.map((label, index) => {
            const row = rows[index] ?? EMPTY_CHECKLIST_ROW;
            return (
              <Tr key={label} hoverable={!disabled}>
                <Td className="w-12 text-center text-[12px] font-semibold text-text-3">
                  {index + 1}
                </Td>
                <Td className="text-[13px] font-medium leading-relaxed text-heading">
                  {label}
                </Td>
                <Td className="w-[132px] text-center">
                  <div className="flex justify-center">
                    <YesNoToggle
                      name={`eng-q-${index}`}
                      value={row.answer}
                      disabled={disabled}
                      onChange={(value) =>
                        onChange(
                          patchChecklistRow(rowsRef.current, index, {
                            answer: value,
                          }),
                        )
                      }
                    />
                  </div>
                </Td>
                <Td>
                  <ChecklistNoteField
                    value={row.note}
                    disabled={disabled}
                    onChange={(note) =>
                      onChange(
                        patchChecklistRow(rowsRef.current, index, { note }),
                      )
                    }
                  />
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
