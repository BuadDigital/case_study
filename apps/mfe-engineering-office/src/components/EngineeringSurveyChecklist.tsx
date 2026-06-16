"use client";

import { cn } from "@platform/design-system";
import { ENGINEERING_SURVEY_CHECKLIST_ITEMS } from "../lib/engineering-survey-data";
import type { EngineeringSurveyChecklistRow } from "../lib/engineering-survey-data";
import { patchChecklistRow } from "../lib/engineering-survey-submission-storage";

export function EngineeringSurveyChecklist({
  rows,
  disabled,
  onChange,
}: {
  rows: EngineeringSurveyChecklistRow[];
  disabled?: boolean;
  onChange: (rows: EngineeringSurveyChecklistRow[]) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className="w-7 bg-surface-2 px-4 py-2 text-center text-[11px] font-medium text-text-2">
              #
            </th>
            <th className="bg-surface-2 px-4 py-2 text-start text-[11px] font-medium text-text-2">
              البند
            </th>
            <th className="w-[90px] bg-surface-2 px-4 py-2 text-start text-[11px] font-medium text-text-2">
              نعم / لا
            </th>
            <th className="w-40 bg-surface-2 px-4 py-2 text-start text-[11px] font-medium text-text-2">
              ملاحظة
            </th>
          </tr>
        </thead>
        <tbody>
          {ENGINEERING_SURVEY_CHECKLIST_ITEMS.map((label, index) => {
            const row = rows[index] ?? { answer: null, note: "" };
            return (
              <tr key={label} className="hover:bg-surface-2">
                <td className="border-b border-border px-4 py-2 text-center align-middle text-text-3">
                  {index + 1}
                </td>
                <td className="min-w-[200px] border-b border-border px-4 py-2 align-middle leading-snug text-text">
                  {label}
                </td>
                <td className="border-b border-border px-4 py-2 align-middle">
                  <div className="flex justify-center gap-2.5">
                    {(["yes", "no"] as const).map((value) => (
                      <label
                        key={value}
                        className="inline-flex cursor-pointer items-center gap-0.5 text-[11px]"
                      >
                        <input
                          type="radio"
                          name={`eng-q-${index}`}
                          checked={row.answer === value}
                          disabled={disabled}
                          onChange={() =>
                            onChange(
                              patchChecklistRow(rows, index, { answer: value }),
                            )
                          }
                        />
                        {value === "yes" ? "نعم" : "لا"}
                      </label>
                    ))}
                  </div>
                </td>
                <td className="border-b border-border px-4 py-2 align-middle">
                  <textarea
                    className={cn(
                      "min-h-11 w-full resize-y rounded-[5px] border border-border bg-surface-2 px-1.5 py-1 font-inherit text-[11px] outline-none",
                      "focus:border-primary focus:bg-surface",
                    )}
                    rows={2}
                    disabled={disabled}
                    value={row.note}
                    onChange={(e) =>
                      onChange(
                        patchChecklistRow(rows, index, { note: e.target.value }),
                      )
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
