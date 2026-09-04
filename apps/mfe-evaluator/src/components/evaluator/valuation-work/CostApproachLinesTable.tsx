"use client";

import { Fragment } from "react";
import { TBody, THead, Table, Td, Th, Tr, cn, opsFldControl } from "@platform/ui-kit";

import { Card } from "./atoms";
import {
  COST_GROUP1_KEYS,
  COST_ITEM_OPTIONS,
  COST_UNIT_OPTIONS,
  costGroupOf,
} from "./lib/cost-line-math";
import { fmt } from "./lib/shell-utils";
import type { CostApproachWorkflow } from "./useCostApproachWorkflow";

/**
 * Direct cost lines table — two groups (building areas, extras) with
 * drag-to-reorder, hover-insert and a ghost “choose item” row per group.
 * All state lives in the cost-approach workflow; this only renders it.
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
    <Card className="mb-6">
      <Table className="min-w-[900px]">
        <THead>
          <Tr hoverable={false}>
            <Th>البند</Th>
            <Th className="text-center">
              المساحة / العدد
              <div className="text-[10px] font-normal text-text-3">· نسبة البناء</div>
            </Th>
            <Th className="text-center">الوحدة</Th>
            <Th className="text-center">سعر المتر / تكلفة الوحدة</Th>
            <Th className="text-center">
              الإجمالي
              <div className="text-[10px] font-normal text-text-3">
                سعر المتر بعد غير المباشرة
              </div>
            </Th>
            <Th>مبرر التقدير</Th>
            <Th className="w-12" />
          </Tr>
        </THead>
        <TBody>
          {(
            [
              ["area", "مسطحات المبنى والأدوار", areaSubtotal],
              ["extra", "تكاليف وتجهيزات إضافية", extraSubtotal],
            ] as const
          ).map(([group, groupTitle, subtotal]) => (
            <Fragment key={group}>
              <Tr hoverable={false}>
                <Td
                  colSpan={5}
                  className="border-b border-border-md bg-gold-soft py-[9px] text-[12.5px] font-extrabold text-heading"
                >
                  {groupTitle}
                </Td>
                <Td
                  colSpan={2}
                  className="border-b border-border-md bg-gold-soft py-[9px] text-end text-[13px] font-extrabold text-gold-d"
                >
                  <span dir="ltr">{fmt(subtotal)}</span>
                </Td>
              </Tr>
              {costDraft.map((line, idx) => {
                if (costGroupOf(line) !== group) return null;
                const comp = computedLines[idx]!;
                const patch = (partial: Parameters<typeof patchLine>[1]) =>
                  patchLine(idx, partial);
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
                      className={dragCostId === line.id ? "opacity-45" : undefined}
                    >
                      <Td>
                        <div className="flex items-start gap-1.5">
                          <span
                            draggable
                            title="اسحب لإعادة الترتيب داخل المجموعة"
                            onDragStart={(e) => {
                              setDragCostId(line.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => setDragCostId(null)}
                            className="shrink-0 cursor-grab select-none pt-[11px] text-[13px] leading-none text-text-3"
                          >
                            ⋮⋮
                          </span>
                          <div className="min-w-0 flex-1">
                            <select
                              value={line.itemKey || "custom"}
                              onChange={(e) => {
                                const opt = COST_ITEM_OPTIONS.find(
                                  (o) => o.key === e.target.value,
                                );
                                patch({
                                  itemKey: e.target.value,
                                  unit: opt?.unit ?? line.unit,
                                  areaSqm:
                                    (opt?.unit ?? line.unit) === "lump"
                                      ? 1
                                      : line.areaSqm,
                                  repeatedFloorCount:
                                    e.target.value === "repeated_floors"
                                      ? (line.repeatedFloorCount ?? 2)
                                      : null,
                                  label:
                                    e.target.value === "custom"
                                      ? line.label
                                      : (opt?.label ?? line.label),
                                });
                              }}
                              className={cn(
                                opsFldControl,
                                "px-2.5 py-2 text-[12.5px] font-bold",
                              )}
                            >
                              {COST_ITEM_OPTIONS.filter(
                                (o) =>
                                  o.key === line.itemKey ||
                                  o.key === "custom" ||
                                  (!usedItemKeys.has(o.key) &&
                                    (group === "area"
                                      ? COST_GROUP1_KEYS.has(o.key)
                                      : !COST_GROUP1_KEYS.has(o.key))),
                              ).map((o) => (
                                <option key={o.key} value={o.key}>
                                  {o.key === "custom" ? "✎ كتابة اسم آخر…" : o.label}
                                </option>
                              ))}
                            </select>
                            {line.itemKey === "custom" ? (
                              <input
                                value={line.label}
                                placeholder="اكتب اسم البند…"
                                onChange={(e) => patch({ label: e.target.value })}
                                className={cn(
                                  opsFldControl,
                                  "mt-1 px-[9px] py-1.5 text-xs font-medium",
                                )}
                              />
                            ) : null}
                          </div>
                        </div>
                      </Td>
                      <Td className="text-center">
                        {comp.isLump ? (
                          <span className="text-xs font-bold text-gold-d">
                            مبلغ مقطوع
                          </span>
                        ) : comp.isRepeated ? (
                          <label
                            title="عدد الأدوار المتكررة — الكمية تُشتق من مسطح الدور الأول × العدد"
                            className="inline-flex items-center gap-1.5"
                          >
                            <span className="text-[10.5px] text-text-3">عدد</span>
                            <input
                              dir="ltr"
                              value={String(line.repeatedFloorCount ?? 2)}
                              onChange={(e) =>
                                patch({
                                  repeatedFloorCount:
                                    Number.parseInt(
                                      e.target.value.replace(/[^\d]/g, ""),
                                      10,
                                    ) || 0,
                                })
                              }
                              className="w-[46px] rounded-[7px] border border-border-md px-1 py-2 text-center text-[12.5px] font-bold"
                            />
                          </label>
                        ) : (
                          <input
                            dir="ltr"
                            value={String(line.areaSqm)}
                            onChange={(e) =>
                              patch({
                                areaSqm: Number(e.target.value.replace(",", ".")) || 0,
                              })
                            }
                            className="w-[66px] rounded-[7px] border border-border-md px-1 py-2 text-center text-[12.5px] font-bold"
                          />
                        )}
                        {comp.usesPct ? (
                          <label
                            title="نسبة البناء (٪) — فارغة = ١٠٠٪"
                            className="mt-1 flex items-center justify-center gap-1"
                          >
                            <input
                              dir="ltr"
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
                              className="w-[46px] rounded-md border border-dashed border-border bg-surface-2 px-[3px] py-1 text-center text-[11px] font-bold text-gold-d"
                            />
                            <span className="text-[10px] text-text-3">٪</span>
                          </label>
                        ) : null}
                        {comp.usesPct &&
                        line.buildRatioPct != null &&
                        line.buildRatioPct !== 100 ? (
                          <div className="mt-0.5 text-[10px] text-gold-d">
                            المسطح <span dir="ltr">{fmt(comp.qty, 1)}</span> م²
                          </div>
                        ) : comp.isRepeated ? (
                          <div className="mt-0.5 text-[10px] text-text-3">
                            الكمية <span dir="ltr">{fmt(comp.qty, 1)}</span> م²
                          </div>
                        ) : null}
                      </Td>
                      <Td className="text-center">
                        <select
                          value={line.unit || "sqm"}
                          onChange={(e) =>
                            patch({
                              unit: e.target.value,
                              areaSqm: e.target.value === "lump" ? 1 : line.areaSqm,
                            })
                          }
                          className="rounded-[7px] border border-border-md px-2.5 py-2 text-[12.5px]"
                        >
                          {COST_UNIT_OPTIONS.map((o) => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </Td>
                      <Td className="text-center">
                        <input
                          dir="ltr"
                          value={comp.inherited ? "" : String(line.unitCostSar)}
                          placeholder={comp.inherited ? String(comp.uc) : undefined}
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
                          <div className="mt-0.5 text-[10px] text-gold-d">
                            موروثة من الدور الأول
                          </div>
                        ) : null}
                      </Td>
                      <Td className="text-center font-extrabold text-heading">
                        <span dir="ltr">{fmt(comp.rawTotal)}</span>
                        {comp.rawTotal > 0 && comp.qty > 0 ? (
                          <div className="mt-0.5 text-[10px] text-text-3">
                            <span dir="ltr">
                              {fmt(
                                (comp.rawTotal * (1 + indirectSumLocal / 100)) /
                                  comp.qty,
                              )}
                            </span>{" "}
                            بعد غير المباشرة
                          </div>
                        ) : null}
                      </Td>
                      <Td>
                        <input
                          value={line.rationale}
                          onChange={(e) => patch({ rationale: e.target.value })}
                          placeholder="أساس التقدير…"
                          className="w-full rounded-[7px] border border-border px-2.5 py-2 text-xs"
                        />
                      </Td>
                      <Td className="text-center">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => removeCostLine(idx)}
                          className="size-6 cursor-pointer rounded-md border border-border bg-surface text-text-3"
                        >
                          ×
                        </button>
                      </Td>
                    </Tr>
                    {/* Between-row insert bar (hover-insert) — custom line inherits the group */}
                    <Tr hoverable={false}>
                      <Td colSpan={7} className="!border-b-0 p-0">
                        <div className="flex h-2.5 items-center justify-center">
                          <button
                            type="button"
                            disabled={saving}
                            title="إدراج بند مخصص هنا"
                            onClick={() => insertCostLineAfter(idx)}
                            className="grid size-[18px] place-items-center rounded-full border border-gold bg-gold-soft text-xs font-bold leading-none text-gold-d opacity-[0.12] transition-opacity duration-[120ms] hover:opacity-100"
                          >
                            +
                          </button>
                        </div>
                      </Td>
                    </Tr>
                  </Fragment>
                );
              })}
              <Tr hoverable={false} className="bg-surface-2">
                <Td colSpan={7} className="py-2">
                  <div className="flex items-center gap-2.5">
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
                          repeatedFloorCount: opt.key === "repeated_floors" ? 2 : null,
                        });
                      }}
                      className="min-w-[170px] rounded-[7px] border border-dashed border-border-md bg-surface px-2.5 py-[7px] text-xs text-gold-d"
                    >
                      <option value="">اختر البند</option>
                      <option value="__custom">+ بند مخصص…</option>
                      {ghostOptionsFor(group).map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] text-text-3">
                      تُفتح بقية الحقول بعد اختيار البند
                    </span>
                  </div>
                </Td>
              </Tr>
            </Fragment>
          ))}
        </TBody>
      </Table>
      <div className="flex justify-between border-t border-border bg-surface-2 px-4 py-3">
        <span className="text-xs text-text-2">مجموع البنود = التكلفة المباشرة</span>
        <span dir="ltr" className="text-base font-extrabold text-heading">
          {fmt(directTotal)}
        </span>
      </div>
    </Card>
  );
}
