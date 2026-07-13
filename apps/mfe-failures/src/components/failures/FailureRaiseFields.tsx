"use client";

import { useEffect, useMemo } from "react";
import {
  InlineLoadingSkeleton,
  Label,
  cn,
  formControlClassName,
} from "@platform/design-system";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import {
  FAILURE_PROBLEM_TYPES,
  FAILURE_TYPE_CATEGORIES,
  failureProblemTypeLabel,
} from "../../lib/failure-types-data";
import {
  filterFailureCategoriesForRole,
  filterFailureProblemTypesForRole,
} from "../../lib/failure-category-role-visibility";
import type { FailureSeverity } from "../../lib/failures-types";
import { useFailureTypesQuery } from "../../query/failure-types-queries";

const fieldTextareaClass = cn(
  formControlClassName,
  "min-h-[72px] resize-y py-2 leading-relaxed",
);

export function FailureRaiseFields({
  severity,
  onSeverityChange,
  problemTypeId,
  onProblemTypeIdChange,
  note,
  onNoteChange,
  idPrefix = "fail",
}: {
  severity: FailureSeverity;
  onSeverityChange: (value: FailureSeverity) => void;
  problemTypeId: string;
  onProblemTypeIdChange: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
  idPrefix?: string;
}) {
  const { role } = usePrototype();
  const { data: catalog, isPending } = useFailureTypesQuery();

  const categories = useMemo(() => {
    const rows = catalog?.categories?.length
      ? catalog.categories
      : FAILURE_TYPE_CATEGORIES;
    return filterFailureCategoriesForRole(
      role,
      [...rows].sort((a, b) => a.order - b.order),
    );
  }, [catalog?.categories, role]);

  const problemTypes = useMemo(() => {
    const rows = catalog?.problemTypes?.length
      ? catalog.problemTypes
      : FAILURE_PROBLEM_TYPES;
    return filterFailureProblemTypesForRole(
      role,
      [...rows].sort((a, b) => a.order - b.order),
    );
  }, [catalog?.problemTypes, role]);

  useEffect(() => {
    if (!problemTypeId) return;
    if (problemTypes.some((type) => type.id === problemTypeId)) return;
    onProblemTypeIdChange("");
  }, [problemTypeId, problemTypes, onProblemTypeIdChange]);

  const selectedType = problemTypes.find((type) => type.id === problemTypeId);

  return (
    <>
      <div className="mb-2.5">
        <Label className="text-[11px] font-semibold text-text-2">
          نوع المشكلة *
        </Label>
        {isPending && !catalog ? (
          <InlineLoadingSkeleton className="mt-1.5 h-9" />
        ) : (
          <select
            id={`${idPrefix}_problem_type`}
            className={cn(formControlClassName, "mt-1.5 w-full text-xs")}
            value={problemTypeId}
            onChange={(e) => onProblemTypeIdChange(e.target.value)}
          >
            <option value="">— اختر نوع التعذر —</option>
            {categories.map((category) => {
              const types = problemTypes.filter(
                (type) => type.categoryId === category.id,
              );
              if (types.length === 0) return null;
              return (
                <optgroup key={category.id} label={category.label}>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        )}
        {selectedType?.description ? (
          <p className="mt-1.5 text-[10px] leading-relaxed text-text-3">
            {selectedType.description}
          </p>
        ) : problemTypeId ? (
          <p className="mt-1.5 text-[10px] text-text-3">
            {failureProblemTypeLabel(problemTypeId)}
          </p>
        ) : null}
      </div>

      <div className="mb-2.5">
        <Label className="text-[11px] font-semibold text-text-2">
          درجة التعذر *
        </Label>
        <div className="mt-1.5 flex flex-wrap gap-4">
          <label className="inline-flex cursor-pointer items-center gap-1 text-xs">
            <input
              type="radio"
              name={`${idPrefix}_severity`}
              checked={severity === "suspected"}
              onChange={() => onSeverityChange("suspected")}
            />
            احتمال تعذر
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1 text-xs">
            <input
              type="radio"
              name={`${idPrefix}_severity`}
              checked={severity === "internal"}
              onChange={() => onSeverityChange("internal")}
            />
            تعذر داخلي
          </label>
        </div>
      </div>

      <div className="mb-3">
        <Label htmlFor={`${idPrefix}_note`} className="text-[11px] font-semibold text-text-2">
          ملاحظات
        </Label>
        <textarea
          id={`${idPrefix}_note`}
          className={cn(fieldTextareaClass, "mt-1")}
          rows={3}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="تفاصيل إضافية (اختياري)"
        />
      </div>

      <p className="mb-3 min-h-[2.75rem] text-[10px] leading-relaxed text-text-3">
        {severity === "internal"
          ? "يُضبط حالة الصك إلى «قيد التحقق» ويُوقف العمل على العقار حتى يُعالج التعذر."
          : "احتمال تعذر — إشارة تحذيرية فقط دون إيقاف العمل على العقار."}
      </p>
    </>
  );
}
