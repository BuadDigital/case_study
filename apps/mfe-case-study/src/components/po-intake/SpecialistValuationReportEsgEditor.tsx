"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@platform/ui-kit";
import {
  ESG_ENV_FACTORS,
  ESG_GOV_FACTORS,
  ESG_NONE_NOTES,
  ESG_SOC_FACTORS,
  loadSpecialistEsgInputs,
  saveSpecialistEsgInputs,
  type SpecialistEsgGroup,
  type SpecialistEsgInputs,
} from "../../lib/app-data/valuation-report-specialist-esg";

const thClass =
  "border-b border-border bg-surface-2 px-2.5 py-2 text-start text-[11px] font-bold text-text-2";
const tdClass = "border-b border-border px-2.5 py-2.5 align-top text-[12.5px]";
const inputClass =
  "w-full rounded-[var(--radius)] border border-border-md bg-surface px-2.5 py-2 text-[12.5px] text-text outline-none focus:border-ink";

function EsgEditorRow({
  label,
  factors,
  group,
  noneNotes,
  onChange,
}: {
  label: string;
  factors: readonly string[];
  group: SpecialistEsgGroup;
  noneNotes: string;
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
            className="size-4 accent-[var(--ink)]"
            checked={hasImpact}
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
          disabled={group.none}
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

/** Editable ESG block for case specialist / CDO / admin on property documents. */
export function SpecialistValuationReportEsgEditor({
  propertyId,
}: {
  propertyId: string;
}) {
  const [inputs, setInputs] = useState<SpecialistEsgInputs>(() =>
    loadSpecialistEsgInputs(propertyId),
  );

  useEffect(() => {
    setInputs(loadSpecialistEsgInputs(propertyId));
  }, [propertyId]);

  const patchGroup = useCallback(
    (key: keyof SpecialistEsgInputs, next: SpecialistEsgGroup) => {
      setInputs((prev) => {
        const merged = { ...prev, [key]: next };
        saveSpecialistEsgInputs(propertyId, merged);
        return merged;
      });
    },
    [propertyId],
  );

  return (
    <section className="mb-4 rounded-[var(--radius-lg)] border border-border bg-surface px-3.5 py-3.5">
      <div className="mb-2 text-[13px] font-extrabold text-heading">
        العوامل البيئية والاجتماعية والحوكمة (ESG)
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-text-3">
        يعبّئها الأخصائي وتظهر للمقيّم في تقييم العقار للعرض فقط، وتُطبع في التقرير.
      </p>
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
              group={inputs.esgEnv}
              noneNotes={ESG_NONE_NOTES.env}
              onChange={(esgEnv) => patchGroup("esgEnv", esgEnv)}
            />
            <EsgEditorRow
              label="التأثيرات الاجتماعية"
              factors={ESG_SOC_FACTORS}
              group={inputs.esgSoc}
              noneNotes={ESG_NONE_NOTES.soc}
              onChange={(esgSoc) => patchGroup("esgSoc", esgSoc)}
            />
            <EsgEditorRow
              label="تأثيرات الحوكمة"
              factors={ESG_GOV_FACTORS}
              group={inputs.esgGov}
              noneNotes={ESG_NONE_NOTES.gov}
              onChange={(esgGov) => patchGroup("esgGov", esgGov)}
            />
          </tbody>
        </table>
      </div>
    </section>
  );
}
