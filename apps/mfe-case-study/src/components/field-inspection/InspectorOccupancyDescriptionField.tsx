"use client";

import { cn } from "@platform/ui-kit";
import {
  OCCUPANCY_DESCRIPTION_KEY,
} from "../../lib/prototype/inspector-workspace-data";
import { EDIT_CONTROL_CLASS } from "./FieldInspectionWorkParts";
import { inspectorInvalidControlClass } from "../../lib/prototype/inspector-workspace-validation";

/** Shown when «حالة الإشغال» = مشغول — explain why the property is occupied. */
export function InspectorOccupancyDescriptionField({
  value,
  disabled,
  invalid,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <textarea
      id={`ins-${OCCUPANCY_DESCRIPTION_KEY}`}
      rows={2}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-label="سبب الإشغال"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="صف سبب الإشغال (مثلاً: مستأجر، سكن عائلة المالك…)"
      className={cn(
        EDIT_CONTROL_CLASS,
        "mt-2 w-full resize-y",
        invalid && inspectorInvalidControlClass,
      )}
    />
  );
}
