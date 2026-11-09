"use client";

import { cn } from "@platform/ui-kit";
import {
  OCCUPANCY_DESCRIPTION_KEY,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import { InsReadField } from "../po-intake/PropertyDetailInspectionParts";
import { inspectorInvalidControlClass } from "../../lib/app-data/inspector-workspace-validation";
import { useInsControlClass } from "../po-intake/PropertyDetailInspectionFields";

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
  // The work page's layout (`work` density) (Omar 2026-11-09): the page's one control height; unchanged elsewhere.
  const insCtl = useInsControlClass("textarea");
  if (disabled) {
    return <InsReadField label="سبب الإشغال" value={value} multiline className="mt-2" />;
  }
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
        insCtl,
        "mt-2 w-full resize-y",
        invalid && inspectorInvalidControlClass,
      )}
    />
  );
}
