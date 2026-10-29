// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Floors  A repeated-floors line with no count shows an empty box with «العدد» placeholder, not a
//            phantom «2» the save never sent; an empty count is stored as null so the alert asks for it.
//  • Digits  Floor count and build ratio keep Arabic/Persian digits (costNumericInput) instead of
//            dropping them.
// Round 2 (1b19bedc)
//  • A new or switched repeated-floors line starts with no count (repeatedFloorCountForItem), not 2.
//  • Build ratio is read with costNum, so «7,5» is 7.5.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import type { ValuationCostLineDto } from "@platform/api-client";
import { useState } from "react";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import { parseLocaleNumber } from "@platform/app-shared/format/number";
import { cn } from "@platform/ui-kit";

import {
  COST_GROUP1_KEYS,
  COST_ITEM_OPTIONS,
  COST_UNIT_OPTIONS,
} from "./lib/cost-line-math";
import { costNum, costNumericInput, repeatedFloorCountForItem } from "./lib/cost-approach-state";
import { fmt } from "./lib/shell-utils";
import type { CostApproachWorkflow } from "./useCostApproachWorkflow";

/**
 * Per-line editors of the direct cost lines — shared by the desktop table
 * (`CostApproachLinesTable`) and the phone cards (`CostApproachLinesPhone`).
 */

type CostGroup = "area" | "extra";
export const COST_GROUPS = [
  ["area", "مسطحات المبنى والأدوار", false],
  ["extra", "تكاليف وتجهيزات إضافية", true],
] as const;

/** Phone control: 44px tall, 16px text so iOS never zooms on focus. */
const touchControl = "min-h-11 w-full text-[16px]";

type ComputedCostLine = CostApproachWorkflow["totals"]["computedLines"][number];
type LinePatch = Parameters<CostApproachWorkflow["patchLine"]>[1];

/**
 * One line's editors — the table row's cells and the phone card's fields
 * render these same pieces, so both write through `patch` identically.
 */
type CostLineEditor = {
  line: ValuationCostLineDto;
  comp: ComputedCostLine;
  /** `cost-line-${idx}` — the error-scroll target prefix. */
  idBase: string;
  nameOptions: typeof COST_ITEM_OPTIONS;
  applyItem: (value: string) => void;
  patch: (partial: LinePatch) => void;
  lineError: (field: string) => string | undefined;
  indirectSumLocal: number;
  touch?: boolean;
};

export function costLineEditor(
  workflow: CostApproachWorkflow,
  fieldErrors: Record<string, string>,
  idx: number,
  group: CostGroup,
  idPrefix: string,
  touch?: boolean,
): CostLineEditor {
  const { costDraft, totals, derived, usedItemKeys, patchLine } = workflow;
  const line = costDraft[idx]!;
  const patch = (partial: LinePatch) => patchLine(idx, partial);
  const nameOptions = COST_ITEM_OPTIONS.filter(
    (o) =>
      o.key === line.itemKey ||
      o.key === "custom" ||
      (!usedItemKeys.has(o.key) &&
        (group === "area"
          ? COST_GROUP1_KEYS.has(o.key)
          : !COST_GROUP1_KEYS.has(o.key))),
  );
  const applyItem = (value: string) => {
    if (!value) return;
    if (value === "custom" || value === "__write") {
      patch({
        itemKey: "custom",
        label: line.itemKey === "custom" ? line.label : "",
      });
      return;
    }
    const opt = COST_ITEM_OPTIONS.find((o) => o.key === value);
    patch({
      itemKey: value,
      unit: opt?.unit ?? line.unit,
      areaSqm: (opt?.unit ?? line.unit) === "lump" ? 1 : line.areaSqm,
      repeatedFloorCount: repeatedFloorCountForItem(value, line.repeatedFloorCount),
      label: opt?.label ?? line.label,
    });
  };
  return {
    line,
    comp: totals.computedLines[idx]!,
    idBase: `${idPrefix}-${idx}`,
    nameOptions,
    applyItem,
    patch,
    lineError: (field) => fieldErrors[`lines[${idx}].${field}`],
    indirectSumLocal: derived.indirectSumLocal,
    touch,
  };
}

export function CostLineNameField({ line, idBase, nameOptions, applyItem, patch, lineError, touch }: CostLineEditor) {
  if (line.itemKey === "custom") {
    return (
      <>
        <input
          id={`${idBase}-label`}
          value={line.label}
          placeholder="اكتب اسم البند…"
          onChange={(e) => patch({ label: e.target.value })}
          className={cn(
            "w-full rounded-[7px] border border-border-md bg-surface px-2.5 py-2 font-bold text-heading",
            touch ? touchControl : "text-[12.5px]",
            lineError("label") && invalidControlClass,
          )}
        />
        {!line.label.trim() ? (
          <select
            value=""
            onChange={(e) => applyItem(e.target.value)}
            className={cn(
              "mt-1 w-full cursor-pointer rounded-[7px] border border-dashed border-border bg-surface-2 px-[9px] py-1.5 font-medium text-gold-d",
              touch ? touchControl : "text-[11px]",
            )}
          >
            <option value="">أو اختر من القائمة…</option>
            {nameOptions
              .filter((o) => o.key !== "custom")
              .map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
          </select>
        ) : null}
      </>
    );
  }
  return (
    <select
      value={line.itemKey || "custom"}
      onChange={(e) => applyItem(e.target.value)}
      className={cn(
        "w-full cursor-pointer rounded-[7px] border border-border-md bg-surface px-2.5 py-2 font-bold text-heading",
        touch ? touchControl : "text-[12.5px]",
      )}
    >
      {nameOptions.map((o) => (
        <option key={o.key} value={o.key}>
          {o.key === "custom" ? "✎ كتابة اسم آخر…" : o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * A decimal field over a numeric value: the typed text is kept while the field is edited.
 * How it works: each keystroke is cleaned (`costNumericInput`) and kept as text, and its number is sent
 * on; the text gives way to the saved number when the field is left.
 * Edge cases: the field used to show `String(value)` straight back, so «220.» became «220» on the next
 * render and no fraction could be typed (the appraiser's areas and unit costs, 2026-10-29).
 */
function useDecimalDraft(value: number, onNumber: (n: number) => void) {
  const [text, setText] = useState<string | null>(null);
  return {
    value: text ?? String(value),
    onChange: (raw: string) => {
      const clean = costNumericInput(raw);
      setText(clean);
      onNumber(parseLocaleNumber(clean) || 0);
    },
    onBlur: () => setText(null),
  };
}

export function CostLineQtyInput(props: CostLineEditor) {
  const { line, patch } = props;
  const area = useDecimalDraft(line.areaSqm, (n) => patch({ areaSqm: n }));
  return <CostLineQtyField {...props} area={area} />;
}

function CostLineQtyField({
  line,
  comp,
  idBase,
  patch,
  lineError,
  touch,
  area,
}: CostLineEditor & { area: ReturnType<typeof useDecimalDraft> }) {
  if (comp.isLump) {
    return <span className="text-[13px] font-bold text-text-3">مبلغ مقطوع</span>;
  }
  return (
    <input
      id={`${idBase}-${comp.isRepeated ? "repeatedFloorCount" : "areaSqm"}`}
      dir="ltr"
      inputMode="decimal"
      title={comp.isRepeated ? "عدد الأدوار المتكررة" : undefined}
      // A missing count shows empty (not a phantom «2» the save never sent) — the alert asks for it.
      placeholder={comp.isRepeated ? "العدد" : undefined}
      value={
        comp.isRepeated
          ? line.repeatedFloorCount == null ? "" : String(line.repeatedFloorCount)
          : area.value
      }
      onBlur={comp.isRepeated ? undefined : area.onBlur}
      onChange={(e) => {
        const raw = e.target.value;
        if (comp.isRepeated) {
          const digits = costNumericInput(raw, true);
          patch({
            repeatedFloorCount: digits ? Number.parseInt(digits, 10) : null,
          });
          return;
        }
        area.onChange(raw);
      }}
      className={cn(
        "rounded-[7px] border border-border-md px-1 py-2 text-center font-bold",
        touch ? touchControl : "inline-block w-[66px] text-[12.5px]",
        comp.isRepeated ? "bg-surface-2 text-gold-d" : "bg-surface text-heading",
        (lineError("areaSqm") || lineError("repeatedFloorCount")) &&
          invalidControlClass,
      )}
    />
  );
}

export function CostLineBuildRatioInput({ line, idBase, patch, lineError, touch }: CostLineEditor) {
  return (
    <input
      id={`${idBase}-buildRatioPct`}
      dir="ltr"
      inputMode="decimal"
      title="نسبة البناء"
      value={line.buildRatioPct == null ? "" : String(line.buildRatioPct)}
      placeholder="100"
      onChange={(e) => {
        const raw = costNumericInput(e.target.value);
        patch({ buildRatioPct: raw ? costNum(raw) : null });
      }}
      className={cn(
        "rounded-[7px] border border-dashed border-border-md bg-surface-2 px-0.5 py-2 text-center font-bold text-gold-d",
        touch ? touchControl : "ms-[5px] inline-block w-[54px] text-[11.5px]",
        lineError("buildRatioPct") && invalidControlClass,
      )}
    />
  );
}

/** «المسطح …» / «الكمية …» note under the quantity. */
export function CostLineQtyNote({ line, comp }: CostLineEditor) {
  if (comp.usesPct && line.buildRatioPct != null && line.buildRatioPct !== 100) {
    return (
      <div className="mt-[3px] text-[10px] text-gold-d">
        المسطح <span dir="ltr">{fmt(comp.qty, 1)}</span> م²
      </div>
    );
  }
  if (comp.isRepeated) {
    return (
      <div className="mt-[3px] text-[10px] text-text-3">
        الكمية <span dir="ltr">{fmt(comp.qty, 1)}</span> م²
      </div>
    );
  }
  return null;
}

export function CostLineUnitSelect({ line, idBase, patch, lineError, touch }: CostLineEditor) {
  return (
    <select
      id={`${idBase}-unit`}
      value={line.unit || "sqm"}
      onChange={(e) =>
        patch({
          unit: e.target.value,
          areaSqm: e.target.value === "lump" ? 1 : line.areaSqm,
        })
      }
      className={cn(
        "cursor-pointer rounded-[7px] border border-border-md bg-surface px-2.5 py-2 text-text",
        touch ? touchControl : "text-[12.5px]",
        lineError("unit") && invalidControlClass,
      )}
    >
      {COST_UNIT_OPTIONS.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CostLineUnitCostInput({ line, comp, idBase, patch, lineError, touch }: CostLineEditor) {
  const cost = useDecimalDraft(line.unitCostSar, (n) => patch({ unitCostSar: n }));
  return (
    <>
      <input
        id={`${idBase}-unitCostSar`}
        dir="ltr"
        inputMode="decimal"
        value={comp.inherited ? "" : cost.value}
        placeholder={comp.inherited ? String(comp.uc) : undefined}
        onChange={(e) => cost.onChange(e.target.value)}
        onBlur={cost.onBlur}
        className={cn(
          "rounded-[7px] border p-2 text-center font-bold",
          touch ? touchControl : "w-[110px] text-[13px]",
          comp.inherited
            ? "border-border bg-surface-2 text-gold-d"
            : "border-border-md bg-surface text-heading",
          lineError("unitCostSar") && invalidControlClass,
        )}
      />
      {comp.inherited ? (
        <div className="mt-[3px] text-[10px] text-text-3">موروثة من الدور الأول</div>
      ) : null}
    </>
  );
}

/** Line total + the per-sqm rate after indirect costs. */
export function CostLineTotal({ comp, indirectSumLocal }: CostLineEditor) {
  return (
    <>
      <span dir="ltr" className="text-sm font-extrabold text-heading">
        {fmt(comp.rawTotal)}
      </span>
      {comp.rawTotal > 0 && comp.qty > 0 ? (
        <div className="mt-[3px] text-[10px] text-text-3">
          <span dir="ltr">
            {fmt((comp.rawTotal * (1 + indirectSumLocal / 100)) / comp.qty)}
          </span>
        </div>
      ) : null}
    </>
  );
}

export function CostLineRationaleInput({ line, idBase, patch, lineError, touch }: CostLineEditor) {
  return (
    <input
      id={`${idBase}-rationale`}
      value={line.rationale}
      onChange={(e) => patch({ rationale: e.target.value })}
      placeholder="أساس التقدير…"
      className={cn(
        "w-full rounded-[7px] border border-border bg-surface px-2.5 py-2 font-medium text-text",
        touch ? touchControl : "text-xs",
        lineError("rationale") && invalidControlClass,
      )}
    />
  );
}

/** «اختر البند» ghost select — adds a line to the group. */
export function AddCostLineSelect({
  group,
  workflow,
  touch,
}: {
  group: CostGroup;
  workflow: CostApproachWorkflow;
  touch?: boolean;
}) {
  const { addCostLine, ghostOptionsFor } = workflow;
  return (
    <select
      value=""
      aria-label="إضافة بند"
      onChange={(e) => {
        if (!e.target.value) return;
        if (e.target.value === "__custom") {
          addCostLine({ structureKind: group === "area" ? "floor" : "other" });
          return;
        }
        const opt = COST_ITEM_OPTIONS.find((o) => o.key === e.target.value);
        if (!opt) return;
        addCostLine({
          itemKey: opt.key,
          label: opt.label,
          unit: opt.unit,
          areaSqm: opt.unit === "lump" ? 1 : 0,
          repeatedFloorCount: repeatedFloorCountForItem(opt.key, null),
        });
      }}
      className={cn(
        "w-full cursor-pointer rounded-[7px] border border-dashed border-border-md bg-surface px-2.5 py-2 font-bold text-gold-d",
        touch ? touchControl : "text-[12.5px]",
      )}
    >
      <option value="">{touch ? "+ إضافة بند…" : "اختر البند"}</option>
      <option value="__custom">+ بند مخصص…</option>
      {ghostOptionsFor(group).map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** The «مجموع البنود» footer — under the table and under the phone cards. */
export function DirectTotalFooter({ directTotal }: { directTotal: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border bg-surface-2 px-4 py-3">
      <span className="text-xs font-medium text-text-2">مجموع البنود = التكلفة المباشرة</span>
      <span dir="ltr" className="text-base font-extrabold text-heading">
        {fmt(directTotal)}
      </span>
    </div>
  );
}
