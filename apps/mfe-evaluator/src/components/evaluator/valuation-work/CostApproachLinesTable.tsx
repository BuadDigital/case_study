// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • Layout  The 1160px lines table scrolls inside its card (COST_LINES_TABLE_WRAP_CLASS with
//            contain: inline-size, card min-w-0) — at 1440px it stretched the card and the page column
//            clipped the right-hand columns.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { Fragment, type DragEvent } from "react";
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import {
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  cn,
} from "@platform/ui-kit";

import { Card } from "./atoms";
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
import { CostApproachLinesPhone } from "./CostApproachLinesPhone";

const COLS = 8;
const cell = "px-3 py-2 align-middle";
const cellCenter = `${cell} text-center`;

/** Hover-insert control — sits on the border between two rows, like the HTML form. */
function InsertBetweenRows({
  disabled,
  onInsert,
}: {
  disabled: boolean;
  onInsert: () => void;
}) {
  return (
    <Tr hoverable={false} style={{ height: 0 }}>
      <Td
        colSpan={COLS}
        style={{
          position: "relative",
          height: 0,
          padding: 0,
          border: 0,
          fontSize: 0,
          lineHeight: 0,
        }}
      >
        <div
          className="absolute inset-x-0 z-20 flex h-[18px] items-center justify-center opacity-[0.12] transition-opacity hover:opacity-100"
          style={{ top: -9 }}
        >
          <button
            type="button"
            disabled={disabled}
            title="إضافة بند بعد هذا الصف"
            onClick={onInsert}
            className="grid size-5 place-items-center rounded-full border border-gold bg-surface text-[13px] font-bold leading-none text-gold-d"
          >
            +
          </button>
        </div>
      </Td>
    </Tr>
  );
}

function DragHandle({
  onDragStart,
  onDragEnd,
}: {
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <span
      draggable
      title="اسحب لإعادة الترتيب"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="mx-auto grid h-[26px] w-[18px] cursor-grab place-items-center text-[#c9c4b6]"
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
        <circle cx="2" cy="2" r="1.4" />
        <circle cx="8" cy="2" r="1.4" />
        <circle cx="2" cy="8" r="1.4" />
        <circle cx="8" cy="8" r="1.4" />
        <circle cx="2" cy="14" r="1.4" />
        <circle cx="8" cy="14" r="1.4" />
      </svg>
    </span>
  );
}

/**
 * Round 2: the 1160px table scrolls INSIDE its card. Without `contain: inline-size` the table's
 * min-content width stretched the card past the overflow-hidden page column at 1440px, which then
 * clipped the right-hand columns instead of scrolling.
 */
export const COST_LINES_TABLE_WRAP_CLASS = "!overflow-y-visible [contain:inline-size]";

/**
 * Direct cost lines table — two groups (building areas, extras) with
 * drag-to-reorder, hover-insert and a ghost “choose item” row per group.
 * Column widths and colspans match the interactive-form HTML. Phones get
 * `CostApproachLinesPhone` instead of the 1160px table.
 */
export function CostApproachLinesTable({
  workflow,
  saving,
}: {
  workflow: CostApproachWorkflow;
  saving: boolean;
}) {
  const desktop = useViewportDesktop();
  const {
    costDraft,
    dragCostId,
    setDragCostId,
    totals,
    removeCostLine,
    insertCostLineAfter,
    moveCostLine,
  } = workflow;
  const { areaSubtotal, extraSubtotal, directTotal } = totals;

  const { fieldErrors } = useValuationWorkErrors();
  return (
    <>
    {desktop !== true ? (
      <CostApproachLinesPhone
        className="lg:hidden"
        workflow={workflow}
        saving={saving}
        // Both trees mount only before the viewport is known — keep ids unique then.
        idPrefix={desktop === false ? "cost-line" : "m-cost-line"}
      />
    ) : null}
    {desktop !== false ? (
    <Card id="cost-lines" className="mb-6 min-w-0 !overflow-visible max-lg:hidden">
      <Table
        className="min-w-[1160px] table-fixed"
        wrapClassName={COST_LINES_TABLE_WRAP_CLASS}
      >
        <colgroup>
          <col style={{ width: 34 }} />
          <col style={{ width: 230 }} />
          <col style={{ width: 190 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 150 }} />
          <col style={{ width: 150 }} />
          <col />
          <col style={{ width: 48 }} />
        </colgroup>
        <THead>
          <Tr hoverable={false}>
            <Th className="w-[34px] px-1 py-[13px]" />
            <Th className="w-[230px] px-4 py-[13px] text-start">البند</Th>
            <Th className="w-[190px] px-3 py-[13px] text-center">
              المساحة / العدد · نسبة البناء
            </Th>
            <Th className="w-[110px] px-3 py-[13px] text-center">الوحدة</Th>
            <Th className="w-[150px] px-3 py-[13px] text-center">
              سعر المتر / تكلفة الوحدة
            </Th>
            <Th className="w-[150px] px-3 py-[13px] text-center">
              <div>الإجمالي</div>
              <div className="mt-0.5 text-[10px] font-normal text-text-3">
                سعر المتر بعد غير المباشرة
              </div>
            </Th>
            <Th className="min-w-[240px] px-3 py-[13px] text-start">مبرر التقدير</Th>
            <Th className="w-12 px-2 py-[13px]" />
          </Tr>
        </THead>
        <TBody>
          {COST_GROUPS.map(([group, groupTitle, borderedTop]) => {
            const subtotal = group === "area" ? areaSubtotal : extraSubtotal;
            return (
            <Fragment key={group}>
              <Tr hoverable={false}>
                <Td
                  colSpan={5}
                  className={cn(
                    "bg-[#f6f3ea] px-4 py-[9px] text-xs font-extrabold text-heading",
                    borderedTop ? "border-t border-border-md" : null,
                  )}
                >
                  {groupTitle}
                </Td>
                <Td
                  className={cn(
                    "bg-[#f6f3ea] px-3 py-[9px] text-center text-[12.5px] font-extrabold text-gold-d",
                    borderedTop ? "border-t border-border-md" : null,
                  )}
                >
                  <span dir="ltr">{fmt(subtotal)}</span>
                </Td>
                <Td
                  colSpan={2}
                  className={cn(
                    "bg-[#f6f3ea]",
                    borderedTop ? "border-t border-border-md" : null,
                  )}
                />
              </Tr>
              {costDraft.map((line, idx) => {
                if (costGroupOf(line) !== group) return null;
                const ed = costLineEditor(workflow, fieldErrors, idx, group, "cost-line");
                return (
                  <Fragment key={line.id}>
                    <Tr
                      hoverable={false}
                      onDragOver={(e) => {
                        if (dragCostId) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragCostId) moveCostLine(dragCostId, idx);
                        setDragCostId(null);
                      }}
                      className={cn(
                        "h-16",
                        dragCostId === line.id ? "opacity-45" : null,
                      )}
                    >
                      <Td className="w-[34px] px-1 py-2 text-center">
                        <DragHandle
                          onDragStart={(e) => {
                            setDragCostId(line.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDragCostId(null)}
                        />
                      </Td>
                      <Td className="px-4 py-2">
                        <CostLineNameField {...ed} />
                      </Td>
                      <Td className="whitespace-nowrap px-2 py-2 text-center">
                        <CostLineQtyInput {...ed} />
                        {ed.comp.usesPct ? <CostLineBuildRatioInput {...ed} /> : null}
                        <CostLineQtyNote {...ed} />
                      </Td>
                      <Td className={cellCenter}>
                        <CostLineUnitSelect {...ed} />
                      </Td>
                      <Td className={cellCenter}>
                        <CostLineUnitCostInput {...ed} />
                      </Td>
                      <Td className={cellCenter}>
                        <CostLineTotal {...ed} />
                      </Td>
                      <Td className="px-3 py-2">
                        <CostLineRationaleInput {...ed} />
                      </Td>
                      <Td className="w-12 px-2 py-2 text-center">
                        <button
                          type="button"
                          disabled={saving}
                          title="حذف البند"
                          onClick={() => removeCostLine(idx)}
                          className="mx-auto grid size-6 cursor-pointer place-items-center rounded-md border border-border bg-surface text-[13px] font-bold leading-none text-text-3 hover:border-[#c0553d] hover:text-[#c0553d]"
                        >
                          ×
                        </button>
                      </Td>
                    </Tr>
                    <InsertBetweenRows
                      disabled={saving}
                      onInsert={() => insertCostLineAfter(idx)}
                    />
                  </Fragment>
                );
              })}
              <Tr hoverable={false} className="h-14 bg-[#fcfbf8]">
                <Td className="w-[34px] px-1 py-2" />
                <Td className="px-4 py-2">
                  <AddCostLineSelect group={group} workflow={workflow} />
                </Td>
                <Td colSpan={6} className="px-3 py-2 text-[11px] text-text-3">
                  تُفتح بقية الحقول بعد اختيار البند
                </Td>
              </Tr>
            </Fragment>
            );
          })}
        </TBody>
      </Table>
      <DirectTotalFooter directTotal={directTotal} />
    </Card>
    ) : null}
    </>
  );
}
