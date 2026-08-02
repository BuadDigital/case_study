"use client";

import { useMemo } from "react";
import {
  failureRecordTitle,
  failureStatusLabel,
  failuresForProperty,
} from "@failures/mfe";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";
import {
  engBoxClassName,
  EngStatusPill,
} from "./EngineeringSurveyHtmlPrimitives";

/**
 * Case Study.html eng survey failures log:
 * ENG_BOX rows with text + pill «مفتوح», or empty line.
 */
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
      <p className="m-0 text-xs leading-relaxed text-text-3">
        لا توجد تعذرات مسجلة على هذا العقار.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {rows.map((failure) => {
        const text =
          failure.internalNote?.trim() || failureRecordTitle(failure);
        const open =
          failure.status === "internal" ||
          failure.status === "review" ||
          failure.status === "suspended";
        return (
          <div
            key={failure.id}
            className={`${engBoxClassName} flex items-start justify-between gap-2.5`}
          >
            <span className="min-w-0 flex-1 text-xs leading-relaxed text-text">
              {text}
            </span>
            <EngStatusPill
              label={open ? "مفتوح" : failureStatusLabel(failure.status)}
              color={open ? "#d9694f" : "#3f8f5f"}
            />
          </div>
        );
      })}
    </div>
  );
}
