"use client";

import { useMemo } from "react";
import { Label, Select, cn, formControlClassName } from "@platform/design-system";
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
  const { data: catalog } = useFailureTypesQuery();

  const groupedOptions = useMemo(() => {
    if (!catalog) return [];
    return catalog.categories
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((category) => ({
        category,
        types: catalog.problemTypes
          .filter((t) => t.categoryId === category.id)
          .sort((a, b) => a.order - b.order),
      }));
  }, [catalog]);

  const selectedType = catalog?.problemTypes.find((t) => t.id === problemTypeId);

  return (
    <>
      <div className="mb-2.5">
        <Label className="text-[11px] font-semibold text-text-2">نوع التعذر *</Label>
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

      <div className="mb-2.5">
        <Label htmlFor={`${idPrefix}_problem_type`} className="text-[11px] font-semibold text-text-2">
          نوع المشكلة *
        </Label>
        <Select
          id={`${idPrefix}_problem_type`}
          className="mt-1 text-xs"
          value={problemTypeId}
          onChange={(e) => onProblemTypeIdChange(e.target.value)}
        >
          <option value="">— اختر من القائمة —</option>
          {groupedOptions.map(({ category, types }) => (
            <optgroup key={category.id} label={category.label}>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        <p className="mt-1.5 min-h-[2.5rem] text-[10px] leading-relaxed text-text-3">
          {selectedType?.description ?? "\u00a0"}
        </p>
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
          placeholder="وصف تفصيلي للمشكلة (اختياري)"
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
