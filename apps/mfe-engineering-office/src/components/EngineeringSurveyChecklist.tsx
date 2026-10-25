"use client";

import { useEffect, useRef, useState } from "react";
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import { useLatestRef } from "@platform/app-shared/hooks/use-latest-ref";
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
  YesNoToggle,
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

/** Survey rows store «yes» / «no»; the shared toggle speaks booleans. */
function answerIsYes(answer: EngineeringSurveyChecklistRow["answer"]): boolean | null {
  return answer === null ? null : answer === "yes";
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
  const rowsRef = useLatestRef(rows);
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
                  value={answerIsYes(row.answer)}
                  disabled={disabled}
                  onChange={(yes) => patchRow(index, { answer: yes ? "yes" : "no" })}
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
                          value={answerIsYes(row.answer)}
                          disabled={disabled}
                          onChange={(yes) =>
                            patchRow(index, { answer: yes ? "yes" : "no" })
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
