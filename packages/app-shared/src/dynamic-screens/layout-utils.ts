import type {
  DynamicScreenFieldBinding,
  DynamicScreenLayoutCell,
} from "@platform/types";

const GRID_COLS = 12;

/** Flow bindings into rows when layout is missing or after width change. */
export function autoLayoutBindings(
  bindings: DynamicScreenFieldBinding[],
  widthByFieldId: Record<string, number>,
): DynamicScreenFieldBinding[] {
  let x = 0;
  let y = 0;
  let rowHeight = 1;

  return bindings.map((binding) => {
    const w = Math.min(
      GRID_COLS,
      Math.max(1, widthByFieldId[binding.fieldId] ?? binding.layout?.w ?? 12),
    );
    if (x + w > GRID_COLS) {
      x = 0;
      y += rowHeight;
      rowHeight = 1;
    }
    const layout: DynamicScreenLayoutCell = {
      x,
      y,
      w,
      h: binding.layout?.h ?? 1,
    };
    x += w;
    if (x >= GRID_COLS) {
      x = 0;
      y += layout.h;
      rowHeight = 1;
    }
    rowHeight = Math.max(rowHeight, layout.h);
    return { ...binding, layout };
  });
}

export function compactLayoutRows(
  bindings: DynamicScreenFieldBinding[],
): DynamicScreenFieldBinding[] {
  const sorted = [...bindings].sort(
    (a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x,
  );
  const widthByFieldId = Object.fromEntries(
    sorted.map((b) => [b.fieldId, b.layout.w]),
  );
  return autoLayoutBindings(sorted, widthByFieldId);
}

export const GRID_COLUMN_COUNT = GRID_COLS;
