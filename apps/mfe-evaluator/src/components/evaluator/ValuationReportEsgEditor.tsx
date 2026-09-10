"use client";

import { cn } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import {
  ESG_NONE_NOTES,
  type SpecialistEsgGroup,
} from "@platform/app-shared/app-data/valuation-report-specialist-esg";

const thClass =
  "border-b border-border bg-surface-2 px-2.5 py-2 text-[11px] font-bold text-text-2";
const tdClass = "border-b border-border px-2.5 py-2.5 align-top text-[12.5px]";
const inputClass =
  "w-full rounded-[var(--radius)] border border-border-md bg-surface px-2.5 py-2 text-[12.5px] text-text outline-none focus:border-ink disabled:cursor-not-allowed disabled:opacity-60";

function EsgEditorRow({
  label,
  group,
  noneNotes,
  disabled = false,
  invalid = false,
  onChange,
}: {
  label: string;
  group: SpecialistEsgGroup;
  noneNotes: string;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (next: SpecialistEsgGroup) => void;
}) {
  const hasImpact = !group.none;
  const displayNotes = group.none
    ? group.notes.trim() || noneNotes
    : group.notes;

  return (
    <tr>
      <td className={cn(tdClass, "text-start font-semibold text-text-2")}>
        {label}
      </td>
      <td className={cn(tdClass, "align-middle text-center")}>
        <label className="mx-auto inline-flex cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-[var(--ink)] disabled:cursor-not-allowed"
            checked={hasImpact}
            disabled={disabled}
            aria-label="يوجد تأثير"
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
        </label>
      </td>
      <td className={cn(tdClass, "text-start")}>
        <textarea
          className={cn(
            inputClass,
            "min-h-[72px] resize-y",
            group.none && "text-text-2",
            invalid && invalidControlClass,
          )}
          rows={3}
          disabled={disabled || group.none}
          readOnly={group.none}
          placeholder={
            group.none
              ? noneNotes
              : "وصف الأثر عند وجود تأثير على القيمة التقديرية"
          }
          value={displayNotes}
          onChange={(e) =>
            onChange({ none: false, selected: [], notes: e.target.value })
          }
        />
        {invalid ? (
          <p className="mt-1.5 mb-0 text-[11px] font-semibold text-danger-text">
            وصف الأثر إلزامي عند اختيار «يوجد تأثير»
          </p>
        ) : null}
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
  invalidGroups,
  onPatch,
}: {
  esgEnv: SpecialistEsgGroup;
  esgSoc: SpecialistEsgGroup;
  esgGov: SpecialistEsgGroup;
  disabled?: boolean;
  invalidGroups?: ReadonlyArray<"env" | "soc" | "gov">;
  onPatch: (patch: {
    esgEnv?: SpecialistEsgGroup;
    esgSoc?: SpecialistEsgGroup;
    esgGov?: SpecialistEsgGroup;
  }) => void;
}) {
  const invalid = new Set(invalidGroups ?? []);
  return (
    <div id="val-esg" className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse">
        <thead>
          <tr>
            <th className={cn(thClass, "w-[28%] text-start")}>المجموعة</th>
            <th className={cn(thClass, "w-[14%] text-center")}>يوجد تأثير</th>
            <th className={cn(thClass, "text-start")}>وصف الأثر</th>
          </tr>
        </thead>
        <tbody>
          <EsgEditorRow
            label="التأثيرات البيئية"
            group={esgEnv}
            noneNotes={ESG_NONE_NOTES.env}
            disabled={disabled}
            invalid={invalid.has("env")}
            onChange={(next) => onPatch({ esgEnv: next })}
          />
          <EsgEditorRow
            label="التأثيرات الاجتماعية"
            group={esgSoc}
            noneNotes={ESG_NONE_NOTES.soc}
            disabled={disabled}
            invalid={invalid.has("soc")}
            onChange={(next) => onPatch({ esgSoc: next })}
          />
          <EsgEditorRow
            label="تأثيرات الحوكمة"
            group={esgGov}
            noneNotes={ESG_NONE_NOTES.gov}
            disabled={disabled}
            invalid={invalid.has("gov")}
            onChange={(next) => onPatch({ esgGov: next })}
          />
        </tbody>
      </table>
    </div>
  );
}
