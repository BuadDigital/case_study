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
  componentLineForItem,
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

export function SpecialistComponentsTable({
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
    <div className="overflow-x-auto rounded-lg border border-border">
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
            const legacy = !line.itemKey;
            return (
              <Tr key={line.id ?? `new-${index}`} hoverable={false}>
                <Td className="align-top">
                  <Select
                    aria-label={`البند — السطر ${index + 1}`}
                    disabled={disabled}
                    value={line.itemKey ?? ""}
                    onChange={(e) => onPatch(index, componentLineForItem(line, e.target.value))}
                    className={cn("text-xs", legacy && !disabled && "border-danger")}
                  >
                    <option value="">{legacy && line.label ? `— ${line.label} (اختر البند) —` : "— اختر البند —"}</option>
                    {COST_ITEM_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                  {line.itemKey === "custom" ? (
                    <Input
                      aria-label={`اسم البند المخصص — السطر ${index + 1}`}
                      disabled={disabled}
                      value={line.label}
                      placeholder="اسم البند"
                      onChange={(e) => onPatch(index, { ...line, label: e.target.value })}
                      className="mt-1.5 text-xs"
                    />
                  ) : null}
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
