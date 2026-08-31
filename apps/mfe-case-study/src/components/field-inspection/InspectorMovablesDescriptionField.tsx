"use client";

import { cn } from "@platform/ui-kit";
import {
  MOVABLES_DESCRIPTION_KEY,
} from "../../lib/prototype/inspector-workspace-data";
import { EDIT_CONTROL_CLASS } from "./FieldInspectionWorkParts";
import { inspectorInvalidControlClass } from "../../lib/prototype/inspector-workspace-validation";

/** Field Inspection Workspace.dc.html — single-line input beside «يوجد منقولات». */
export function InspectorMovablesDescriptionField({
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
    <input
      id={`ins-${MOVABLES_DESCRIPTION_KEY}`}
      type="text"
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-label="وصف المنقولات"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="صف المنقولات الموجودة…"
      className={cn(
        EDIT_CONTROL_CLASS,
        "min-w-[240px] flex-1",
        invalid && inspectorInvalidControlClass,
      )}
    />
  );
}
