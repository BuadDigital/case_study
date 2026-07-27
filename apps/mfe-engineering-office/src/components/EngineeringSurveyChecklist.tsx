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
    <div className="overflow-visible">
      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr>
            <th className="w-[34px] bg-surface-2 px-3 py-2 text-center text-[11px] font-semibold text-text-2">
              #
            </th>
            <th className="bg-surface-2 px-3 py-2 text-start text-[11px] font-semibold text-text-2">
              البند
            </th>
            <th className="w-[110px] bg-surface-2 px-3 py-2 text-start text-[11px] font-semibold text-text-2">
              نعم / لا
            </th>
            <th className="w-[190px] bg-surface-2 px-3 py-2 text-start text-[11px] font-semibold text-text-2">
              ملاحظة
            </th>
          </tr>
        </thead>
        <tbody>
          {ENGINEERING_SURVEY_CHECKLIST_ITEMS.map((label, index) => {
            const row = rows[index] ?? { answer: null, note: "" };
            return (
              <tr key={label}>
                <td className="border-b border-border px-3 py-2 text-center align-middle text-text-3">
                  {index + 1}
                </td>
                <td className="border-b border-border px-3 py-2 align-middle leading-[1.6] text-text">
                  {label}
                </td>
                <td className="border-b border-border px-3 py-2 align-middle">
                  <div className="flex justify-center gap-3">
                    {(["yes", "no"] as const).map((value) => (
                      <label
                        key={value}
                        className="inline-flex cursor-pointer items-center gap-1 text-[11.5px]"
                      >
                        <input
                          type="radio"
                          name={`eng-q-${index}`}
                          checked={row.answer === value}
                          disabled={disabled}
                          className="accent-[var(--gold-d)]"
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
                <td className="border-b border-border px-3 py-2 align-middle">
                  <textarea
                    className={cn(
                      "min-h-[34px] w-full resize-y rounded-[9px] border border-border-md bg-surface-2 px-3 py-2 font-[inherit] text-[11.5px] outline-none",
                      "focus:border-gold-d focus:bg-surface",
                    )}
                    rows={1}
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
