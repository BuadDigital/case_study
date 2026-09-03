"use client";

import { cn } from "@platform/ui-kit";
import {
  ESG_ENV_FACTORS,
  ESG_GOV_FACTORS,
  ESG_NONE_NOTES,
  ESG_SOC_FACTORS,
  type SpecialistEsgGroup,
} from "@case-study/mfe/lib/app-data/valuation-report-specialist-esg";

const thClass ="border-b border-border bg-surface-2 px-2.5 py-2 text-start text-[11px] font-bold text-text-2";
const tdClass = "border-b border-border px-2.5 py-2.5 align-top text-[12.5px]";
const inputClass = "w-full rounded-[var(--radius)] border border-border-md bg-surface px-2.5 py-2 text-[12.5px] text-text outline-none focus:border-ink disabled:cursor-not-allowed disabled:opacity-60";

function EsgEditorRow({
  label,
  factors,
  group,
  noneNotes,
  disabled = false,
  onChange,
}: {
  label: string;
  factors: readonly string[];
  group: SpecialistEsgGroup;
  noneNotes: string;
  disabled?: boolean;
  onChange: (next: SpecialistEsgGroup) => void;
}) {
  const hasImpact = !group.none;
  const displayNotes = group.none
    ? group.notes.trim() || noneNotes
    : group.notes;

  return (
    <tr>
      <td className={cn(tdClass, "font-semibold text-text-2")}>
        <div>{label}</div>
        <div className="mt-1 text-[10.5px] font-normal leading-relaxed text-text-3">
          عوامل للاعتبار: {factors.join(" · ")}
        </div>
      </td>
      <td className={cn(tdClass, "text-center")}>
        <label className="inline-flex cursor-pointer flex-col items-center gap-1.5 text-[12px] font-semibold text-heading">
          <input
            type="checkbox"
            className="size-4 accent-[var(--ink)] disabled:cursor-not-allowed"
            checked={hasImpact}
            disabled={disabled}
            onChange={(e) => {
              if (e.target.checked) {
                onChange({
                  none: false,
                  selected: [],
                  notes:
                    group.notes.trim() === noneNotes || !group.notes.trim()
                      ? ""
                      : group.notes,
                });
              } else {
                onChange({
                  none: true,
                  selected: [],
                  notes: noneNotes,
                });
              }
            }}
          />
          <span className="text-[11px] font-medium text-text-2">يوجد تأثير</span>
        </label>
      </td>
      <td className={tdClass}>
        <textarea
          className={cn(inputClass, "min-h-[72px] resize-y", group.none && "text-text-2")}
          rows={3}
          disabled={disabled || group.none}
          readOnly={group.none}
          placeholder={
            group.none ? noneNotes : "وصف الأثر عند وجود تأثير على القيمة التقديرية"
          }
          value={displayNotes}
          onChange={(e) =>
            onChange({ none: false, selected: [], notes: e.target.value })
          }
        />
      </td>
    </tr>
  );
}

/** ESG block filled by the appraiser on final review — printed in the valuation report. */
export function ValuationReportEsgEditor({
  esgEnv,
  esgSoc,
  esgGov,
  disabled = false,
  onPatch,
}: {
  esgEnv: SpecialistEsgGroup;
  esgSoc: SpecialistEsgGroup;
  esgGov: SpecialistEsgGroup;
  disabled?: boolean;
  onPatch: (patch: {
    esgEnv?: SpecialistEsgGroup;
    esgSoc?: SpecialistEsgGroup;
    esgGov?: SpecialistEsgGroup;
  }) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse">
        <thead>
          <tr>
            <th className={cn(thClass, "w-[28%]")}>المجموعة</th>
            <th className={cn(thClass, "w-[14%] text-center")}>يوجد تأثير</th>
            <th className={thClass}>وصف الأثر</th>
          </tr>
        </thead>
        <tbody>
          <EsgEditorRow
            label="التأثيرات البيئية"
            factors={ESG_ENV_FACTORS}
            group={esgEnv}
            noneNotes={ESG_NONE_NOTES.env}
            disabled={disabled}
            onChange={(next) => onPatch({ esgEnv: next })}
          />
          <EsgEditorRow
            label="التأثيرات الاجتماعية"
            factors={ESG_SOC_FACTORS}
            group={esgSoc}
            noneNotes={ESG_NONE_NOTES.soc}
            disabled={disabled}
            onChange={(next) => onPatch({ esgSoc: next })}
          />
          <EsgEditorRow
            label="تأثيرات الحوكمة"
            factors={ESG_GOV_FACTORS}
            group={esgGov}
            noneNotes={ESG_NONE_NOTES.gov}
            disabled={disabled}
            onChange={(next) => onPatch({ esgGov: next })}
          />
        </tbody>
      </table>
    </div>
  );
}
