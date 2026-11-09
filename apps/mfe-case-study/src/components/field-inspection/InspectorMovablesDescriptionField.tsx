"use client";

import { cn } from "@platform/ui-kit";
import {
  MOVABLES_DESCRIPTION_KEY,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import { InsReadField } from "../po-intake/PropertyDetailInspectionParts";
import { inspectorInvalidControlClass } from "../../lib/app-data/inspector-workspace-validation";
import { useInsControlClass } from "../po-intake/PropertyDetailInspectionFields";

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
  // The work page's layout (`work` density) (Omar 2026-11-09): the page's one control height; unchanged elsewhere.
  const insCtl = useInsControlClass();
  if (disabled) return <InsReadField label="وصف المنقولات" value={value} multiline />;
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
        insCtl,
        "min-w-[240px] flex-1",
        invalid && inspectorInvalidControlClass,
      )}
    />
  );
}
