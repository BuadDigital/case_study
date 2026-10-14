"use client";

/**
 * The inspector's «جدول الحصر» on a phone: one card per line instead of the 760px-wide
 * table (same fields, same catalog behaviour as `SpecialistComponentsTable` — typing a
 * catalog name keeps its unit, kind and built-up ratio). Prices are the appraiser's, so none here.
 */
import { Button, Input, Select, cn } from "@platform/ui-kit";
import type { BuildingInventoryLineDto } from "@platform/api-client";
import { COST_ITEM_OPTIONS, COST_UNIT_OPTIONS } from "@platform/app-shared/domain/cost-items";
import {
  componentLineAcceptsBuildRatio,
  componentLineForTypedName,
} from "../../lib/app-data/specialist-components";
import { MobileFieldLabel, mobileControlClassName } from "./InspectMobileControls";

const ITEMS_LIST_ID = "inspector-inventory-items";

export function InspectorInventoryLineCards({
  lines,
  disabled,
  onPatch,
  onRemove,
}: {
  lines: BuildingInventoryLineDto[];
  disabled: boolean;
  onPatch: (index: number, next: BuildingInventoryLineDto) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="grid gap-3" data-testid="inspector-inventory-cards">
      <datalist id={ITEMS_LIST_ID}>
        {COST_ITEM_OPTIONS.filter((o) => o.key !== "custom").map((o) => (
          <option key={o.key} value={o.label} />
        ))}
      </datalist>
      {lines.map((line, index) => {
        const isRepeated = line.itemKey === "repeated_floors";
        return (
          <div
            key={line.id ?? `new-${index}`}
            className="grid gap-3 rounded-xl border border-border bg-surface p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold text-text-2">البند {index + 1}</span>
              {!disabled ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onRemove(index)}
                  aria-label={`حذف البند ${index + 1}`}
                >
                  حذف
                </Button>
              ) : null}
            </div>
            <div>
              <MobileFieldLabel>البند</MobileFieldLabel>
              <Input
                aria-label={`البند — السطر ${index + 1}`}
                list={ITEMS_LIST_ID}
                disabled={disabled}
                value={line.label}
                placeholder="اكتب اسم البند (دور، ملحق، سور، غرفة حارس…)"
                onChange={(e) => onPatch(index, componentLineForTypedName(line, e.target.value))}
                className={cn(mobileControlClassName)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <MobileFieldLabel>{isRepeated ? "عدد الأدوار" : "المساحة / العدد"}</MobileFieldLabel>
                {isRepeated ? (
                  <Input
                    aria-label={`عدد الأدوار المتكررة — السطر ${index + 1}`}
                    type="number"
                    inputMode="numeric"
                    disabled={disabled}
                    value={line.repeatedFloorCount ?? ""}
                    onChange={(e) =>
                      onPatch(index, {
                        ...line,
                        repeatedFloorCount:
                          e.target.value === "" ? null : Math.max(0, Math.trunc(Number(e.target.value))),
                      })
                    }
                    className={cn(mobileControlClassName)}
                  />
                ) : (
                  <Input
                    aria-label={`المساحة أو العدد — السطر ${index + 1}`}
                    type="number"
                    inputMode="decimal"
                    disabled={disabled}
                    value={line.areaSqm ?? ""}
                    onChange={(e) => onPatch(index, { ...line, areaSqm: e.target.value })}
                    className={cn(mobileControlClassName)}
                  />
                )}
              </div>
              <div>
                <MobileFieldLabel>الوحدة</MobileFieldLabel>
                <Select
                  aria-label={`الوحدة — السطر ${index + 1}`}
                  disabled={disabled}
                  value={line.unit || "sqm"}
                  onChange={(e) => onPatch(index, { ...line, unit: e.target.value })}
                  className={cn(mobileControlClassName)}
                >
                  {COST_UNIT_OPTIONS.map((u) => (
                    <option key={u.key} value={u.key}>
                      {u.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {componentLineAcceptsBuildRatio(line) ? (
              <div>
                <MobileFieldLabel>نسبة البناء ٪</MobileFieldLabel>
                <Input
                  aria-label={`نسبة البناء — السطر ${index + 1}`}
                  type="number"
                  inputMode="decimal"
                  disabled={disabled}
                  value={line.buildRatioPct ?? ""}
                  placeholder="100"
                  onChange={(e) =>
                    onPatch(index, {
                      ...line,
                      buildRatioPct:
                        e.target.value === "" ? null : Math.min(100, Math.max(0, Number(e.target.value))),
                    })
                  }
                  className={cn(mobileControlClassName)}
                />
              </div>
            ) : null}
            <div>
              <MobileFieldLabel>ملاحظات</MobileFieldLabel>
              <Input
                aria-label={`ملاحظات — السطر ${index + 1}`}
                disabled={disabled}
                value={line.notes ?? ""}
                placeholder="الوصف والاستخدام"
                onChange={(e) => onPatch(index, { ...line, notes: e.target.value })}
                className={cn(mobileControlClassName)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
