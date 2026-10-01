"use client";

/**
 * «جدول المكونات» rows — same items, units and quantity columns as the appraiser's
 * «بنود التكلفة المباشرة» (no prices: those are the appraiser's). Lines drop into the
 * appraiser's cost table as they are.
 */
import { Button, Input, Select, TBody, THead, Table, Td, Th, Tr, cn } from "@platform/ui-kit";
import type { BuildingInventoryLineDto } from "@platform/api-client";
import { COST_ITEM_OPTIONS, COST_UNIT_OPTIONS } from "@platform/app-shared/domain/cost-items";
import { partyProvenanceLines } from "../../lib/app-data/property-party-fields";
import {
  componentLineAcceptsBuildRatio,
  componentLineForTypedName,
} from "../../lib/app-data/specialist-components";

function LineProvenance({ line }: { line: BuildingInventoryLineDto }) {
  const { written, edited } = partyProvenanceLines(line.provenance ?? undefined);
  if (!written && !edited) return null;
  return (
    <div className="mt-1 flex flex-col text-[10px] leading-4 text-text-3">
      {written ? <span>{written}</span> : null}
      {edited ? <span className="font-semibold text-text-2">{edited}</span> : null}
    </div>
  );
}

function lineItemLabel(line: BuildingInventoryLineDto): string {
  if (line.itemKey && line.itemKey !== "custom") {
    return COST_ITEM_OPTIONS.find((o) => o.key === line.itemKey)?.label ?? line.label;
  }
  return line.label;
}

/** View-only rendering: plain text cells, no controls. */
function SpecialistComponentsReadTable({ lines }: { lines: BuildingInventoryLineDto[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table className="min-w-[640px]">
        <THead>
          <Tr hoverable={false}>
            <Th className="text-start">البند</Th>
            <Th className="w-[130px] text-center">المساحة / العدد</Th>
            <Th className="w-[110px] text-center">نسبة البناء ٪</Th>
            <Th className="w-[110px] text-center">الوحدة</Th>
            <Th className="text-start">ملاحظات</Th>
          </Tr>
        </THead>
        <TBody>
          {lines.map((line, index) => {
            const isRepeated = line.itemKey === "repeated_floors";
            const qty = isRepeated ? line.repeatedFloorCount : line.areaSqm;
            return (
              <Tr key={line.id ?? `new-${index}`} hoverable={false}>
                <Td className="align-top text-[12.5px] font-semibold text-heading">
                  {lineItemLabel(line) || "—"}
                  <LineProvenance line={line} />
                </Td>
                <Td className="text-center align-top tabular-nums">{qty ?? "—"}</Td>
                <Td className="text-center align-top tabular-nums">
                  {componentLineAcceptsBuildRatio(line) && line.buildRatioPct != null
                    ? line.buildRatioPct
                    : "—"}
                </Td>
                <Td className="text-center align-top">
                  {COST_UNIT_OPTIONS.find((u) => u.key === (line.unit || "sqm"))?.label ?? "—"}
                </Td>
                <Td className="align-top text-[12.5px]">{line.notes?.trim() || "—"}</Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}

export function SpecialistComponentsTable({
  lines,
  disabled,
  readView = false,
  onPatch,
  onRemove,
}: {
  lines: BuildingInventoryLineDto[];
  disabled: boolean;
  /** Page is view-only (not merely busy saving): render text instead of locked inputs. */
  readView?: boolean;
  onPatch: (index: number, next: BuildingInventoryLineDto) => void;
  onRemove: (index: number) => void;
}) {
  if (readView) return <SpecialistComponentsReadTable lines={lines} />;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <datalist id="specialist-component-items">
        {COST_ITEM_OPTIONS.filter((o) => o.key !== "custom").map((o) => (
          <option key={o.key} value={o.label} />
        ))}
      </datalist>
      <Table className="min-w-[760px]">
        <THead>
          <Tr hoverable={false}>
            <Th className="w-[210px] text-start">البند</Th>
            <Th className="w-[130px] text-center">المساحة / العدد</Th>
            <Th className="w-[110px] text-center">نسبة البناء ٪</Th>
            <Th className="w-[110px] text-center">الوحدة</Th>
            <Th className="text-start">ملاحظات</Th>
            {!disabled ? <Th className="w-12" /> : null}
          </Tr>
        </THead>
        <TBody>
          {lines.map((line, index) => {
            const isRepeated = line.itemKey === "repeated_floors";
            return (
              <Tr key={line.id ?? `new-${index}`} hoverable={false}>
                <Td className="align-top">
                  <Input
                    aria-label={`البند — السطر ${index + 1}`}
                    list="specialist-component-items"
                    disabled={disabled}
                    value={line.label}
                    placeholder="اكتب اسم البند"
                    onChange={(e) => onPatch(index, componentLineForTypedName(line, e.target.value))}
                    className="text-xs"
                  />
                  <LineProvenance line={line} />
                </Td>
                <Td className="align-top">
                  {isRepeated ? (
                    <Input
                      aria-label={`عدد الأدوار المتكررة — السطر ${index + 1}`}
                      type="number"
                      disabled={disabled}
                      value={line.repeatedFloorCount ?? ""}
                      placeholder="عدد الأدوار"
                      onChange={(e) =>
                        onPatch(index, {
                          ...line,
                          repeatedFloorCount:
                            e.target.value === "" ? null : Math.max(0, Math.trunc(Number(e.target.value))),
                        })
                      }
                      className="text-center text-xs"
                    />
                  ) : (
                    <Input
                      aria-label={`المساحة أو العدد — السطر ${index + 1}`}
                      type="number"
                      disabled={disabled}
                      value={line.areaSqm ?? ""}
                      onChange={(e) => onPatch(index, { ...line, areaSqm: e.target.value })}
                      className="text-center text-xs"
                    />
                  )}
                </Td>
                <Td className="align-top">
                  {componentLineAcceptsBuildRatio(line) ? (
                    <Input
                      aria-label={`نسبة البناء — السطر ${index + 1}`}
                      type="number"
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
                      className="text-center text-xs"
                    />
                  ) : (
                    <span className="block text-center text-text-3">—</span>
                  )}
                </Td>
                <Td className="align-top">
                  <Select
                    aria-label={`الوحدة — السطر ${index + 1}`}
                    disabled={disabled}
                    value={line.unit || "sqm"}
                    onChange={(e) => onPatch(index, { ...line, unit: e.target.value })}
                    className="text-xs"
                  >
                    {COST_UNIT_OPTIONS.map((u) => (
                      <option key={u.key} value={u.key}>
                        {u.label}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td className="align-top">
                  <Input
                    aria-label={`ملاحظات — السطر ${index + 1}`}
                    disabled={disabled}
                    value={line.notes ?? ""}
                    placeholder="الوصف والاستخدام"
                    onChange={(e) => onPatch(index, { ...line, notes: e.target.value })}
                    className="text-xs"
                  />
                </Td>
                {!disabled ? (
                  <Td className="align-top">
                    <Button type="button" size="sm" onClick={() => onRemove(index)} aria-label="حذف البند">
                      ×
                    </Button>
                  </Td>
                ) : null}
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
