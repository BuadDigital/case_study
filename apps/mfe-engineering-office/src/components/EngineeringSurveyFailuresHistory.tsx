"use client";

import { useMemo } from "react";
import { formatDateAr } from "@case-study/mfe";
import {
  failureRecordTitle,
  failureSeverityLabel,
  failureStatusLabel,
  failuresForProperty,
} from "@failures/mfe";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";

export function EngineeringSurveyFailuresHistory({
  poNumber,
  propertyId,
  deedNumber,
}: {
  poNumber: string;
  propertyId: string;
  deedNumber: string;
}) {
  const { data: failures = [] } = useFailuresQuery();

  const rows = useMemo(
    () =>
      failuresForProperty(failures, { poNumber, propertyId, deedNumber }).sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [deedNumber, failures, poNumber, propertyId],
  );

  if (rows.length === 0) {
    return (
      <p className="mt-3 text-xs leading-relaxed text-text-3">
        لا توجد تعذرات مسجلة على هذا العقار بعد.
      </p>
    );
  }

  return (
    <ul className="mt-3 space-y-2">
      {rows.map((failure) => (
        <li
          key={failure.id}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs"
        >
          <p className="m-0 font-medium text-text">
            {failureRecordTitle(failure)}
          </p>
          {failure.internalNote?.trim() ? (
            <p className="mt-1 mb-0 text-text-2">{failure.internalNote.trim()}</p>
          ) : null}
          <p className="mt-1.5 mb-0 text-[11px] text-text-3">
            {failureSeverityLabel(failure.severity)} ·{" "}
            {failureStatusLabel(failure.status)} ·{" "}
            {formatDateAr(failure.updatedAt.slice(0, 10))}
          </p>
        </li>
      ))}
    </ul>
  );
}
