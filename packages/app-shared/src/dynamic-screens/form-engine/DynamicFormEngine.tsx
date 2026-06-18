"use client";

import type { DynamicScreenDefinition } from "@platform/types";
import { fieldById } from "../definition-utils";
import { GRID_COLUMN_COUNT } from "../layout-utils";
import { FieldControl } from "./FieldControl";

export type DynamicFormEngineProps = {
  definition: DynamicScreenDefinition;
  values: Record<string, unknown>;
  readOnly?: boolean;
  preview?: boolean;
  onChange?: (fieldId: string, value: unknown) => void;
};

export function DynamicFormEngine({
  definition,
  values,
  readOnly = false,
  preview = false,
  onChange,
}: DynamicFormEngineProps) {
  const sorted = [...definition.bindings].sort(
    (a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x,
  );

  if (sorted.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-text-3">
        {preview
          ? "أضف حقولاً لتظهر الشاشة هنا"
          : "هذه الشاشة لا تزال بدون حقول."}
      </p>
    );
  }

  const maxRow = sorted.reduce(
    (max, binding) => Math.max(max, binding.layout.y + binding.layout.h),
    0,
  );

  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(${GRID_COLUMN_COUNT}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${maxRow}, auto)`,
      }}
    >
      {sorted.map((binding) => {
        const field = fieldById(definition, binding.fieldId);
        if (!field) return null;
        return (
          <div
            key={binding.fieldId}
            style={{
              gridColumn: `${binding.layout.x + 1} / span ${binding.layout.w}`,
              gridRow: `${binding.layout.y + 1} / span ${binding.layout.h}`,
            }}
          >
            <FieldControl
              field={field}
              binding={binding}
              value={values[field.id]}
              readOnly={readOnly}
              onChange={
                onChange
                  ? (value) => onChange(field.id, value)
                  : undefined
              }
            />
          </div>
        );
      })}
    </div>
  );
}
