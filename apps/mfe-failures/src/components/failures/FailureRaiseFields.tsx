"use client";

import { Input, Label, cn, formControlClassName } from "@platform/design-system";
import type { FailureSeverity } from "../../lib/failures-types";

const fieldTextareaClass = cn(
  formControlClassName,
  "min-h-[72px] resize-y py-2 leading-relaxed",
);

export function FailureRaiseFields({
  severity,
  onSeverityChange,
  problemDescription,
  onProblemDescriptionChange,
  note,
  onNoteChange,
  idPrefix = "fail",
}: {
  severity: FailureSeverity;
  onSeverityChange: (value: FailureSeverity) => void;
  problemDescription: string;
  onProblemDescriptionChange: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
  idPrefix?: string;
}) {
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
        <Label htmlFor={`${idPrefix}_problem`} className="text-[11px] font-semibold text-text-2">
          اكتب المشكلة *
        </Label>
        <Input
          id={`${idPrefix}_problem`}
          className="mt-1 text-xs"
          value={problemDescription}
          onChange={(e) => onProblemDescriptionChange(e.target.value)}
          placeholder="صف المشكلة باختصار"
        />
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
