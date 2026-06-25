"use client";

import { useMemo, useState } from "react";
import { Button, cn, Note } from "@platform/design-system";
import type { InternalDelegationLetter } from "../../lib/prototype/internal-delegation-letters";
import { updateDelegationLetterSelection } from "../../lib/prototype/internal-delegation-letters";
import { printInternalDelegationLetter } from "../../lib/prototype/internal-delegation-letter-html";
import { poPrimaryDataReadiness } from "../../lib/prototype/po-primary-data-readiness";
import {
  formatPropertyDeedDisplay,
  type PoIntakeRecord,
} from "../../lib/prototype/po-intake-data";

type Props = {
  letter: InternalDelegationLetter;
  record: PoIntakeRecord;
  onRefresh: () => void;
};

export function InternalDelegationLetterPanel({
  letter,
  record,
  onRefresh,
}: Props) {
  const readiness = useMemo(() => poPrimaryDataReadiness(record), [record]);
  const courtProperties = useMemo(
    () =>
      record.properties.filter((p) => p.court.trim() === letter.court.trim()),
    [record, letter.court],
  );
  const [selected, setSelected] = useState<string[]>(letter.selectedPropertyIds);

  function toggleProperty(propertyId: string) {
    setSelected((prev) => {
      const next = prev.includes(propertyId)
        ? prev.filter((id) => id !== propertyId)
        : [...prev, propertyId];
      updateDelegationLetterSelection(letter.id, next);
      onRefresh();
      return next;
    });
  }

  function handlePrint() {
    if (!readiness.ready) return;
    printInternalDelegationLetter(
      { ...letter, selectedPropertyIds: selected },
      record,
    );
  }

  return (
    <section className="overflow-hidden rounded-DEFAULT border border-border bg-surface-2/30">
      <div className="border-b border-border bg-surface px-3.5 py-2.5">
        <h3 className="m-0 text-[12px] font-semibold text-text">
          خطاب تفويض الشركة
        </h3>
      </div>

      <div className="px-3.5 py-3">
        <p className="mb-3 text-[11px] leading-relaxed text-text-2">
          اختر العقارات المشمولة في خطاب الزيارة لهذه المحكمة:
        </p>

        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {courtProperties.map((property) => {
            const checked = selected.includes(property.id);
            const label =
              formatPropertyDeedDisplay(property) || property.id;
            return (
              <li key={property.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors",
                    checked
                      ? "border-primary/50 bg-primary-light/40"
                      : "border-border bg-surface hover:border-primary/30 hover:bg-surface-2",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-primary"
                    checked={checked}
                    onChange={() => toggleProperty(property.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium text-text">
                      {label}
                    </span>
                    {property.ownerName ? (
                      <span className="mt-0.5 block text-[10px] text-text-3">
                        {property.ownerName}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {!readiness.ready ? (
          <Note tone="warn" className="mt-3 text-[11px]">
            التصدير متاح بعد اكتمال البيانات الأولية لجميع عقارات أمر العمل (
            {readiness.label}).
          </Note>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="w-full"
            disabled={!readiness.ready || selected.length === 0}
            onClick={handlePrint}
          >
            طباعة / تصدير الخطاب
          </Button>
          <p className="m-0 text-center text-[10px] text-text-3">
            {selected.length === 0
              ? "لم يُختر أي عقار بعد"
              : `${selected.length} ${selected.length === 1 ? "عقار مختار" : "عقارات مختارة"}`}
          </p>
        </div>
      </div>
    </section>
  );
}
