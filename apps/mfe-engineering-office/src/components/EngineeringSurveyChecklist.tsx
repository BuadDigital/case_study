"use client";

import { useEffect, useRef, useState } from "react";
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import {
  MobileRecordCard,
  MobileRecordList,
  TBody,
  THead,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
  cn,
  opsLetterCard,
} from "@platform/ui-kit";
import { ENGINEERING_SURVEY_CHECKLIST_ITEMS } from "../lib/engineering-survey-data";
import type { EngineeringSurveyChecklistRow } from "../lib/engineering-survey-data";
import { patchChecklistRow } from "../lib/engineering-survey-submission-model";

const EMPTY_CHECKLIST_ROW: EngineeringSurveyChecklistRow = {
  answer: null,
  note: "",
};

function YesNoToggle({
  name,
  value,
  disabled,
  onChange,
  block,
}: {
  name: string;
  value: "yes" | "no" | null;
  disabled?: boolean;
  onChange: (next: "yes" | "no") => void;
  /** Phone card: full width, 44px-tall halves. */
  block?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="نعم أو لا"
      className={cn(
        "inline-flex rounded-[var(--radius-DEFAULT)] border border-border-md bg-surface-2 p-0.5",
        block && "flex w-full",
      )}
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
              block && "min-h-11 flex-1 text-[13px]",
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
  className,
}: {
  value: string;
  disabled?: boolean;
  onChange: (note: string) => void;
  className?: string;
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
      className={cn("min-h-[38px] text-[12.5px]", className)}
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
  const desktop = useViewportDesktop();
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const patchRow = (
    index: number,
    patch: Partial<EngineeringSurveyChecklistRow>,
  ) => onChange(patchChecklistRow(rowsRef.current, index, patch));

  return (
    <>
      {/* Phones: one card per item — نعم/لا at full width, the note under it. */}
      {desktop !== true ? (
        <MobileRecordList className="lg:hidden">
          {ENGINEERING_SURVEY_CHECKLIST_ITEMS.map((label, index) => {
            const row = rows[index] ?? EMPTY_CHECKLIST_ROW;
            return (
              <MobileRecordCard
                key={label}
                tone={row.answer === null ? "gold" : undefined}
                title={
                  <span className="font-medium">
                    <bdi className="me-1.5 tabular-nums text-text-3">
                      {index + 1}.
                    </bdi>
                    {label}
                  </span>
                }
              >
                <YesNoToggle
                  block
                  name={`m-eng-q-${index}`}
                  value={row.answer}
                  disabled={disabled}
                  onChange={(value) => patchRow(index, { answer: value })}
                />
                <label className="mt-2.5 block">
                  <span className="mb-1 block text-[11px] font-medium text-text-3">
                    ملاحظة
                  </span>
                  <ChecklistNoteField
                    value={row.note}
                    disabled={disabled}
                    className="min-h-11 text-[13px]"
                    onChange={(note) => patchRow(index, { note })}
                  />
                </label>
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
                            patchRow(index, { answer: value })
                          }
                        />
                      </div>
                    </Td>
                    <Td>
                      <ChecklistNoteField
                        value={row.note}
                        disabled={disabled}
                        onChange={(note) => patchRow(index, { note })}
                      />
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </div>
      ) : null}
    </>
  );
}
