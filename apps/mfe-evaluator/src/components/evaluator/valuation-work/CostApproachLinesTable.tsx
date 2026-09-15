"use client";

import { Fragment, type DragEvent } from "react";
import { TBody, THead, Table, Td, Th, Tr, cn } from "@platform/ui-kit";

import { Card } from "./atoms";
import {
  COST_GROUP1_KEYS,
  COST_ITEM_OPTIONS,
  COST_UNIT_OPTIONS,
  costGroupOf,
} from "./lib/cost-line-math";
import { fmt } from "./lib/shell-utils";
import type { CostApproachWorkflow } from "./useCostApproachWorkflow";

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
 * Direct cost lines table — two groups (building areas, extras) with
 * drag-to-reorder, hover-insert and a ghost “choose item” row per group.
 * Column widths and colspans match the interactive-form HTML.
 */
export function CostApproachLinesTable({
  workflow,
  saving,
}: {
  workflow: CostApproachWorkflow;
  saving: boolean;
}) {
  const {
    costDraft,
    dragCostId,
    setDragCostId,
    totals,
    derived,
    usedItemKeys,
    ghostOptionsFor,
    patchLine,
    addCostLine,
    removeCostLine,
    insertCostLineAfter,
    moveCostLine,
  } = workflow;
  const { computedLines, areaSubtotal, extraSubtotal, directTotal } = totals;
  const { indirectSumLocal } = derived;

  return (
    <Card className="mb-6 !overflow-visible">
      <Table
        className="min-w-[1160px] table-fixed"
        wrapClassName="!overflow-y-visible"
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
          {(
            [
              ["area", "مسطحات المبنى والأدوار", areaSubtotal, false],
              ["extra", "تكاليف وتجهيزات إضافية", extraSubtotal, true],
            ] as const
          ).map(([group, groupTitle, subtotal, borderedTop]) => (
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
                const comp = computedLines[idx]!;
                const patch = (partial: Parameters<typeof patchLine>[1]) =>
                  patchLine(idx, partial);
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
                    areaSqm:
                      (opt?.unit ?? line.unit) === "lump" ? 1 : line.areaSqm,
                    repeatedFloorCount:
                      value === "repeated_floors"
                        ? (line.repeatedFloorCount ?? 2)
                        : null,
                    label: opt?.label ?? line.label,
                  });
                };
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
                        {line.itemKey === "custom" ? (
                          <>
                            <input
                              value={line.label}
                              placeholder="اكتب اسم البند…"
                              onChange={(e) => patch({ label: e.target.value })}
                              className="w-full rounded-[7px] border border-border-md bg-surface px-2.5 py-2 text-[12.5px] font-bold text-heading"
                            />
                            {!line.label.trim() ? (
                              <select
                                value=""
                                onChange={(e) => applyItem(e.target.value)}
                                className="mt-1 w-full cursor-pointer rounded-[7px] border border-dashed border-border bg-surface-2 px-[9px] py-1.5 text-[11px] font-medium text-gold-d"
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
                        ) : (
                          <select
                            value={line.itemKey || "custom"}
                            onChange={(e) => applyItem(e.target.value)}
                            className="w-full cursor-pointer rounded-[7px] border border-border-md bg-surface px-2.5 py-2 text-[12.5px] font-bold text-heading"
                          >
                            {nameOptions.map((o) => (
                              <option key={o.key} value={o.key}>
                                {o.key === "custom" ? "✎ كتابة اسم آخر…" : o.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap px-2 py-2 text-center">
                        {comp.isLump ? (
                          <span className="text-[13px] font-bold text-text-3">
                            مبلغ مقطوع
                          </span>
                        ) : (
                          <input
                            dir="ltr"
                            title={
                              comp.isRepeated
                                ? "عدد الأدوار المتكررة"
                                : undefined
                            }
                            value={
                              comp.isRepeated
                                ? String(line.repeatedFloorCount ?? 2)
                                : String(line.areaSqm)
                            }
                            onChange={(e) => {
                              const raw = e.target.value.replace(",", ".");
                              if (comp.isRepeated) {
                                patch({
                                  repeatedFloorCount:
                                    Number.parseInt(raw.replace(/[^\d]/g, ""), 10) ||
                                    0,
                                });
                                return;
                              }
                              patch({ areaSqm: Number(raw) || 0 });
                            }}
                            className={cn(
                              "inline-block w-[66px] rounded-[7px] border border-border-md px-1 py-2 text-center text-[12.5px] font-bold",
                              comp.isRepeated
                                ? "bg-surface-2 text-gold-d"
                                : "bg-surface text-heading",
                            )}
                          />
                        )}
                        {comp.usesPct ? (
                          <input
                            dir="ltr"
                            title="نسبة البناء"
                            value={
                              line.buildRatioPct == null
                                ? ""
                                : String(line.buildRatioPct)
                            }
                            placeholder="100"
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^\d.]/g, "");
                              patch({ buildRatioPct: raw ? Number(raw) : null });
                            }}
                            className="ms-[5px] inline-block w-[54px] rounded-[7px] border border-dashed border-border-md bg-surface-2 px-0.5 py-2 text-center text-[11.5px] font-bold text-gold-d"
                          />
                        ) : null}
                        {comp.usesPct &&
                        line.buildRatioPct != null &&
                        line.buildRatioPct !== 100 ? (
                          <div className="mt-[3px] text-[10px] text-gold-d">
                            المسطح <span dir="ltr">{fmt(comp.qty, 1)}</span> م²
                          </div>
                        ) : comp.isRepeated ? (
                          <div className="mt-[3px] text-[10px] text-text-3">
                            الكمية <span dir="ltr">{fmt(comp.qty, 1)}</span> م²
                          </div>
                        ) : null}
                      </Td>
                      <Td className={cellCenter}>
                        <select
                          value={line.unit || "sqm"}
                          onChange={(e) =>
                            patch({
                              unit: e.target.value,
                              areaSqm: e.target.value === "lump" ? 1 : line.areaSqm,
                            })
                          }
                          className="cursor-pointer rounded-[7px] border border-border-md bg-surface px-2.5 py-2 text-[12.5px] text-text"
                        >
                          {COST_UNIT_OPTIONS.map((o) => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </Td>
                      <Td className={cellCenter}>
                        <input
                          dir="ltr"
                          value={comp.inherited ? "" : String(line.unitCostSar)}
                          placeholder={
                            comp.inherited ? String(comp.uc) : undefined
                          }
                          onChange={(e) =>
                            patch({
                              unitCostSar:
                                Number(e.target.value.replace(",", ".")) || 0,
                            })
                          }
                          className={cn(
                            "w-[110px] rounded-[7px] border p-2 text-center text-[13px] font-bold",
                            comp.inherited
                              ? "border-border bg-surface-2 text-gold-d"
                              : "border-border-md bg-surface text-heading",
                          )}
                        />
                        {comp.inherited ? (
                          <div className="mt-[3px] text-[10px] text-text-3">
                            موروثة من الدور الأول
                          </div>
                        ) : null}
                      </Td>
                      <Td className={cellCenter}>
                        <span
                          dir="ltr"
                          className="text-sm font-extrabold text-heading"
                        >
                          {fmt(comp.rawTotal)}
                        </span>
                        {comp.rawTotal > 0 && comp.qty > 0 ? (
                          <div className="mt-[3px] text-[10px] text-text-3">
                            <span dir="ltr">
                              {fmt(
                                (comp.rawTotal * (1 + indirectSumLocal / 100)) /
                                  comp.qty,
                              )}
                            </span>
                          </div>
                        ) : null}
                      </Td>
                      <Td className="px-3 py-2">
                        <input
                          value={line.rationale}
                          onChange={(e) => patch({ rationale: e.target.value })}
                          placeholder="أساس التقدير…"
                          className="w-full rounded-[7px] border border-border bg-surface px-2.5 py-2 text-xs font-medium text-text"
                        />
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
                  <select
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      if (e.target.value === "__custom") {
                        addCostLine({
                          structureKind: group === "area" ? "floor" : "other",
                        });
                        return;
                      }
                      const opt = COST_ITEM_OPTIONS.find(
                        (o) => o.key === e.target.value,
                      );
                      if (!opt) return;
                      addCostLine({
                        itemKey: opt.key,
                        label: opt.label,
                        unit: opt.unit,
                        areaSqm: opt.unit === "lump" ? 1 : 0,
                        repeatedFloorCount:
                          opt.key === "repeated_floors" ? 2 : null,
                      });
                    }}
                    className="w-full cursor-pointer rounded-[7px] border border-dashed border-border-md bg-surface px-2.5 py-2 text-[12.5px] font-bold text-gold-d"
                  >
                    <option value="">اختر البند</option>
                    <option value="__custom">+ بند مخصص…</option>
                    {ghostOptionsFor(group).map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Td>
                <Td colSpan={6} className="px-3 py-2 text-[11px] text-text-3">
                  تُفتح بقية الحقول بعد اختيار البند
                </Td>
              </Tr>
            </Fragment>
          ))}
        </TBody>
      </Table>
      <div className="flex items-center justify-between gap-4 border-t border-border bg-surface-2 px-4 py-3">
        <span className="text-xs font-medium text-text-2">
          مجموع البنود = التكلفة المباشرة
        </span>
        <span dir="ltr" className="text-base font-extrabold text-heading">
          {fmt(directTotal)}
        </span>
      </div>
    </Card>
  );
}
