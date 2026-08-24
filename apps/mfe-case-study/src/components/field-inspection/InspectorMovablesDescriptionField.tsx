"use client";

import { Label, Textarea, cn } from "@platform/ui-kit";
import {
  MOVABLES_DESCRIPTION_KEY,
  MOVABLES_DESCRIPTION_LABEL,
} from "../../lib/prototype/inspector-workspace-data";
import { inspectorInvalidControlClass } from "../../lib/prototype/inspector-workspace-validation";

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
    <div id={`ins-feature-${MOVABLES_DESCRIPTION_KEY}`} className="mt-2 space-y-1">
      <Label htmlFor={`ins-${MOVABLES_DESCRIPTION_KEY}`}>
        {MOVABLES_DESCRIPTION_LABEL}
        {invalid ? (
          <span className="ms-1.5 text-[10px] font-bold text-danger">مطلوب</span>
        ) : null}
      </Label>
      <Textarea
        id={`ins-${MOVABLES_DESCRIPTION_KEY}`}
        rows={3}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="أجهزة، أثاث، معدات…"
        className={cn(invalid && inspectorInvalidControlClass)}
      />
    </div>
  );
}
