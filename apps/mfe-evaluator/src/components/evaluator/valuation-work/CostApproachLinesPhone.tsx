"use client";

import { MobileRecordCard, MobileRecordList, cn } from "@platform/ui-kit";

import { costGroupOf } from "./lib/cost-line-math";
import { fmt } from "./lib/shell-utils";
import type { CostApproachWorkflow } from "./useCostApproachWorkflow";
import { useValuationWorkErrors } from "./ValuationWorkErrors";
import {
  AddCostLineSelect,
  COST_GROUPS,
  CostLineBuildRatioInput,
  CostLineNameField,
  CostLineQtyInput,
  CostLineQtyNote,
  CostLineRationaleInput,
  CostLineTotal,
  CostLineUnitCostInput,
  CostLineUnitSelect,
  DirectTotalFooter,
  costLineEditor,
} from "./CostApproachLineEditors";

/** Phone field label (above a full-width input). */
const phoneLabelClass = "mb-1 block text-[11px] font-medium text-text-3";

/**
 * Phone layout — per group: a header with its subtotal, one card per line
 * (every column as a labelled full-width field; ↑/↓ replace drag-to-reorder,
 * «إضافة بند بعده» replaces hover-insert), then the add-line select.
 */
export function CostApproachLinesPhone({
  workflow,
  saving,
  idPrefix,
  className,
}: {
  workflow: CostApproachWorkflow;
  saving: boolean;
  idPrefix: string;
  className?: string;
}) {
  const { costDraft, totals, removeCostLine, insertCostLineAfter, moveCostLine } = workflow;
  const { areaSubtotal, extraSubtotal, directTotal } = totals;
  const { fieldErrors } = useValuationWorkErrors();
  const subtotalOf = { area: areaSubtotal, extra: extraSubtotal };
  const btn =
    "inline-flex min-h-11 items-center justify-center rounded-[9px] border border-border-md bg-surface px-3 text-[13px] font-bold text-text-2 disabled:opacity-45";

  return (
    <div id={idPrefix === "cost-line" ? "cost-lines" : undefined} className={cn("mb-6 flex flex-col gap-3", className)}>
      {COST_GROUPS.map(([group, groupTitle]) => {
        const indexes = costDraft
          .map((line, idx) => (costGroupOf(line) === group ? idx : -1))
          .filter((idx) => idx >= 0);
        return (
          <section key={group} className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3 rounded-[10px] bg-[#f6f3ea] px-3.5 py-2.5">
              <span className="text-xs font-extrabold text-heading">{groupTitle}</span>
              <bdi dir="ltr" className="text-[13px] font-extrabold text-gold-d tabular-nums">
                {fmt(subtotalOf[group])}
              </bdi>
            </div>
            <MobileRecordList isEmpty={indexes.length === 0} empty="لا بنود بعد — اختر بنداً أدناه.">
              {indexes.map((idx, pos) => {
                const ed = costLineEditor(workflow, fieldErrors, idx, group, idPrefix, true);
                const { line, comp } = ed;
                const prevIdx = indexes[pos - 1];
                const nextIdx = indexes[pos + 1];
                return (
                  <MobileRecordCard
                    key={line.id}
                    title={line.label.trim() || "بند بلا اسم"}
                    status={
                      <button
                        type="button"
                        disabled={saving}
                        title="حذف البند"
                        aria-label="حذف البند"
                        onClick={() => removeCostLine(idx)}
                        className="grid size-11 place-items-center rounded-[9px] border border-border bg-surface text-[17px] font-bold leading-none text-text-3 active:border-[#c0553d] active:text-[#c0553d]"
                      >
                        ×
                      </button>
                    }
                    actions={
                      <>
                        <button
                          type="button"
                          className={btn}
                          disabled={prevIdx === undefined}
                          aria-label="نقل البند لأعلى"
                          onClick={() => prevIdx !== undefined && moveCostLine(line.id, prevIdx)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={btn}
                          disabled={nextIdx === undefined}
                          aria-label="نقل البند لأسفل"
                          onClick={() => nextIdx !== undefined && moveCostLine(line.id, nextIdx)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className={cn(btn, "!flex-[2] border-gold text-gold-d")}
                          disabled={saving}
                          onClick={() => insertCostLineAfter(idx)}
                        >
                          + بند بعده
                        </button>
                      </>
                    }
                  >
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                      <div className="col-span-2">
                        <span className={phoneLabelClass}>البند</span>
                        <CostLineNameField {...ed} />
                      </div>
                      <label className={cn("min-w-0", !comp.usesPct && "col-span-2")}>
                        <span className={phoneLabelClass}>
                          {comp.isRepeated ? "عدد الأدوار المتكررة" : "المساحة / العدد"}
                        </span>
                        <CostLineQtyInput {...ed} />
                      </label>
                      {comp.usesPct ? (
                        <label className="min-w-0">
                          <span className={phoneLabelClass}>نسبة البناء (٪)</span>
                          <CostLineBuildRatioInput {...ed} />
                        </label>
                      ) : null}
                      <div className="col-span-2 -mt-1.5">
                        <CostLineQtyNote {...ed} />
                      </div>
                      <label className="min-w-0">
                        <span className={phoneLabelClass}>الوحدة</span>
                        <CostLineUnitSelect {...ed} />
                      </label>
                      <label className="min-w-0">
                        <span className={phoneLabelClass}>سعر المتر / تكلفة الوحدة</span>
                        <CostLineUnitCostInput {...ed} />
                      </label>
                      <div className="col-span-2 flex items-start justify-between gap-3 rounded-[9px] bg-surface-2 px-3 py-2">
                        <span className="text-[11.5px] font-semibold text-text-2">
                          الإجمالي
                          <span className="block text-[10px] font-normal text-text-3">
                            سعر المتر بعد غير المباشرة
                          </span>
                        </span>
                        <div className="text-end">
                          <CostLineTotal {...ed} />
                        </div>
                      </div>
                      <label className="col-span-2">
                        <span className={phoneLabelClass}>مبرر التقدير</span>
                        <CostLineRationaleInput {...ed} />
                      </label>
                    </div>
                  </MobileRecordCard>
                );
              })}
            </MobileRecordList>
            <AddCostLineSelect group={group} workflow={workflow} touch />
          </section>
        );
      })}
      <div className="overflow-hidden rounded-[12px] border border-border">
        <DirectTotalFooter directTotal={directTotal} />
      </div>
    </div>
  );
}
