"use client";

import { useEffect, useState } from "react";
import { rememberPropertyPoNumber } from "@platform/app-shared/storage/specialist-report-extras-sync";
import {
  loadSpecialistFinishingLevel,
  saveSpecialistFinishingLevel,
  type SpecialistFinishingLevel,
} from "../../lib/app-data/valuation-report-specialist-finishing";

const OPTIONS: { value: SpecialistFinishingLevel; label: string }[] = [
  { value: "", label: "— اختر المستوى —" },
  { value: "luxury", label: "تشطيب فاخر" },
  { value: "medium", label: "تشطيب متوسط" },
  { value: "ordinary", label: "تشطيب عادي" },
  { value: "none", label: "بدون تشطيب" },
];

/** Editable finishing level for case specialist — printed/highlighted in the report. */
export function SpecialistValuationReportFinishingEditor({
  propertyId,
  poNumber,
}: {
  propertyId: string;
  poNumber?: string;
}) {
  const [level, setLevel] = useState(() =>
    loadSpecialistFinishingLevel(propertyId),
  );

  useEffect(() => {
    setLevel(loadSpecialistFinishingLevel(propertyId));
  }, [propertyId]);

  useEffect(() => {
    const id = propertyId.trim();
    const po = (poNumber ?? "").trim();
    if (id && po) rememberPropertyPoNumber(id, po);
  }, [propertyId, poNumber]);

  return (
    <section className="mb-4 rounded-[var(--radius-lg)] border border-border bg-surface px-3.5 py-3.5">
      <div className="mb-2 text-[13px] font-extrabold text-heading">
        مستوى تشطيبات البناء
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-text-3">
        المستوى المختار يُظلَّل في التقرير. أوصاف الفاخر/المتوسط/العادي من إعدادات
        المنشأة.
      </p>
      <select
        className="w-full rounded-[var(--radius)] border border-border-md bg-surface px-2.5 py-2 text-[12.5px] font-semibold text-text outline-none focus:border-ink"
        value={level}
        onChange={(e) => {
          const next = e.target.value as SpecialistFinishingLevel;
          setLevel(next);
          saveSpecialistFinishingLevel(propertyId, next);
        }}
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value || "empty"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </section>
  );
}
