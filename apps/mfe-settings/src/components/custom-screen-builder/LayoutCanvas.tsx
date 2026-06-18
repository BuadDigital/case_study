"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GridLayout, { type Layout } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { Button } from "@platform/design-system";
import {
  GRID_COLUMN_COUNT,
  autoLayoutBindings,
} from "@platform/app-shared/dynamic-screens/layout-utils";
import {
  bindingForField,
  fieldById,
} from "@platform/app-shared/dynamic-screens/definition-utils";
import type {
  DynamicScreenDefinition,
  DynamicScreenFieldBinding,
} from "@platform/types";

type Props = {
  definition: DynamicScreenDefinition;
  onChange: (definition: DynamicScreenDefinition) => void;
};

export function LayoutCanvas({ definition, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    setWidth(node.offsetWidth);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(
    () =>
      definition.bindings.map((binding) => ({
        i: binding.fieldId,
        x: binding.layout.x,
        y: binding.layout.y,
        w: binding.layout.w,
        h: binding.layout.h,
        minW: 2,
        maxW: GRID_COLUMN_COUNT,
        minH: 1,
      })),
    [definition.bindings],
  );

  function updateBindings(nextBindings: DynamicScreenFieldBinding[]): void {
    onChange({
      ...definition,
      bindings: nextBindings,
      status: nextBindings.length > 0 ? "موجودة" : "مخططة",
    });
  }

  function handleLayoutChange(nextLayout: Layout): void {
    const items = [...nextLayout];
    const nextBindings = definition.bindings.map((binding) => {
      const item = items.find((layoutItem) => layoutItem.i === binding.fieldId);
      if (!item) return binding;
      return {
        ...binding,
        layout: {
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        },
      };
    });
    updateBindings(nextBindings);
  }

  function updateBinding(
    fieldId: string,
    patch: Partial<DynamicScreenFieldBinding>,
  ): void {
    updateBindings(
      definition.bindings.map((binding) =>
        binding.fieldId === fieldId ? { ...binding, ...patch } : binding,
      ),
    );
  }

  function removeBinding(fieldId: string): void {
    updateBindings(
      definition.bindings.filter((binding) => binding.fieldId !== fieldId),
    );
  }

  if (definition.bindings.length === 0) {
    return (
      <div className="rounded border border-dashed border-border px-4 py-10 text-center text-xs text-text-3">
        لم تُضف حقول بعد — أنشئ حقلاً أو أضفه من القائمة.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-text-3">
        اسحب الحقول وغيّر حجمها على الشبكة (12 عمود).
      </p>
      <div ref={containerRef} className="w-full">
        <GridLayout
          className="layout"
          layout={layout}
          cols={GRID_COLUMN_COUNT}
          rowHeight={72}
          width={width}
          margin={[12, 12] as [number, number]}
          containerPadding={[0, 0] as [number, number]}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
        >
          {definition.bindings.map((binding) => {
            const field = fieldById(definition, binding.fieldId);
            if (!field) return null;
            return (
              <div
                key={binding.fieldId}
                className="rounded border border-border bg-surface px-2 py-2 shadow-sm"
              >
                <div className="drag-handle mb-2 flex cursor-move items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-text">
                      {field.name}
                    </p>
                    <p className="font-mono text-[10px] text-text-3">
                      {field.ref}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeBinding(binding.fieldId)}
                  >
                    ✕
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        binding.mode === "input" ? "primary" : "outline"
                      }
                      onClick={() =>
                        updateBinding(binding.fieldId, { mode: "input" })
                      }
                    >
                      إدخال
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={binding.mode === "view" ? "primary" : "outline"}
                      onClick={() =>
                        updateBinding(binding.fieldId, {
                          mode: "view",
                          required: false,
                        })
                      }
                    >
                      عرض
                    </Button>
                  </div>
                  {binding.mode === "input" ? (
                    <label className="flex items-center gap-2 text-[11px] text-text">
                      <input
                        type="checkbox"
                        checked={Boolean(binding.required)}
                        onChange={(event) =>
                          updateBinding(binding.fieldId, {
                            required: event.target.checked,
                          })
                        }
                      />
                      إلزامي
                    </label>
                  ) : null}
                </div>
              </div>
            );
          })}
        </GridLayout>
      </div>
    </div>
  );
}

export function appendFieldToDefinition(
  definition: DynamicScreenDefinition,
  fieldId: string,
): DynamicScreenDefinition {
  if (bindingForField(definition, fieldId)) return definition;
  const newBinding: DynamicScreenFieldBinding = {
    fieldId,
    mode: "input",
    required: false,
    layout: { x: 0, y: 0, w: 12, h: 1 },
  };
  const merged = [...definition.bindings, newBinding];
  const widthByFieldId = Object.fromEntries(
    merged.map((binding) => [binding.fieldId, binding.layout.w]),
  );
  const nextBindings = autoLayoutBindings(merged, widthByFieldId);
  return {
    ...definition,
    bindings: nextBindings,
    status: nextBindings.length > 0 ? "موجودة" : "مخططة",
  };
}
