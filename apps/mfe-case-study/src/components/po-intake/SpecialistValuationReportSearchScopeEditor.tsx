"use client";

import { useEffect, useState } from "react";
import {
  loadSpecialistSearchScopeNotes,
  saveSpecialistSearchScopeNotes,
} from "../../lib/prototype/valuation-report-specialist-search-scope";

/** Editable search-scope notes for case specialist / CDO / admin. */
export function SpecialistValuationReportSearchScopeEditor({
  propertyId,
}: {
  propertyId: string;
}) {
  const [notes, setNotes] = useState(() =>
    loadSpecialistSearchScopeNotes(propertyId),
  );

  useEffect(() => {
    setNotes(loadSpecialistSearchScopeNotes(propertyId));
  }, [propertyId]);

  return (
    <section className="mb-4 rounded-[var(--radius-lg)] border border-border bg-surface px-3.5 py-3.5">
      <div className="mb-2 text-[13px] font-extrabold text-heading">نطاق البحث</div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-text-3">
        النقاط الثابتة من إعدادات التقرير. أضف ملاحظات خاصة بهذه المعاملة — تظهر
        للمقيّم للعرض فقط وتُطبع في التقرير.
      </p>
      <textarea
        className="min-h-[72px] w-full resize-y rounded-[var(--radius)] border border-border-md bg-surface px-2.5 py-2 text-[12.5px] text-text outline-none focus:border-ink"
        rows={3}
        placeholder="ملاحظات نطاق البحث (إن وُجدت)"
        value={notes}
        onChange={(e) => {
          const next = e.target.value;
          setNotes(next);
          saveSpecialistSearchScopeNotes(propertyId, next);
        }}
      />
    </section>
  );
}
