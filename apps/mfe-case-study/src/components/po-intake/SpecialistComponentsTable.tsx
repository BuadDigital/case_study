"use client";

/**
 * «جدول المكونات» rows — same items, units and quantity columns as the appraiser's
 * «بنود التكلفة المباشرة» (no prices: those are the appraiser's). Lines drop into the
 * appraiser's cost table as they are.
 */
import {
  Button,
  Input,
  MobileRecordCard,
  MobileRecordList,
  Select,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  cn,
} from "@platform/ui-kit";
import type { BuildingInventoryLineDto } from "@platform/api-client";
import { COST_ITEM_OPTIONS, COST_UNIT_OPTIONS } from "@platform/app-shared/domain/cost-items";
import { partyProvenanceLines } from "../../lib/app-data/property-party-fields";
import {
  componentLineAcceptsBuildRatio,
  componentLineForTypedName,
} from "../../lib/app-data/specialist-components";
import { PhoneField } from "./PhoneField";

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

/** Read-only display values for one line — shared by the table row and the phone card. */
function readLineView(line: BuildingInventoryLineDto) {
  const isRepeated = line.itemKey === "repeated_floors";
  const qty = isRepeated ? line.repeatedFloorCount : line.areaSqm;
  return {
    label: lineItemLabel(line) || "—",
    qty: qty ?? "—",
    ratio:
      componentLineAcceptsBuildRatio(line) && line.buildRatioPct != null
        ? line.buildRatioPct
        : "—",
    unit: COST_UNIT_OPTIONS.find((u) => u.key === (line.unit || "sqm"))?.label ?? "—",
    notes: line.notes?.trim() || "—",
  };
}

/** View-only rendering: plain text cells, no controls. */
function SpecialistComponentsReadTable({ lines }: { lines: BuildingInventoryLineDto[] }) {
  return (
    <>
      {/* Phones: one card per line — the 640px table scrolled sideways. */}
      <MobileRecordList className="lg:hidden" isEmpty={lines.length === 0} empty="لا بنود.">
        {lines.map((line, index) => {
          const v = readLineView(line);
          return (
            <MobileRecordCard
              key={line.id ?? `new-${index}`}
              title={v.label}
              subtitle={<LineProvenance line={line} />}
              fields={[
                { label: "المساحة / العدد", value: v.qty, ltr: true },
                { label: "نسبة البناء ٪", value: v.ratio, ltr: true },
                { label: "الوحدة", value: v.unit },
                { label: "ملاحظات", value: v.notes, wide: true },
              ]}
            />
          );
        })}
      </MobileRecordList>
      <div className="overflow-x-auto rounded-lg border border-border max-lg:hidden">
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
              const v = readLineView(line);
              return (
                <Tr key={line.id ?? `new-${index}`} hoverable={false}>
                  <Td className="align-top text-[12.5px] font-semibold text-heading">
                    {v.label}
                    <LineProvenance line={line} />
                  </Td>
                  <Td className="text-center align-top tabular-nums">{v.qty}</Td>
                  <Td className="text-center align-top tabular-nums">{v.ratio}</Td>
                  <Td className="text-center align-top">{v.unit}</Td>
                  <Td className="align-top text-[12.5px]">{v.notes}</Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </div>
    </>
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

  /** One line's editors — shared by the desktop row and the phone card. */
  const controls = (line: BuildingInventoryLineDto, index: number, sizeClass: string) => {
    const isRepeated = line.itemKey === "repeated_floors";
    return {
      isRepeated,
      item: (
        <Input
          aria-label={`البند — السطر ${index + 1}`}
          list="specialist-component-items"
          disabled={disabled}
          value={line.label}
          placeholder="اكتب اسم البند"
          onChange={(e) => onPatch(index, componentLineForTypedName(line, e.target.value))}
          className={sizeClass}
        />
      ),
      qty: isRepeated ? (
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
          className={cn("text-center", sizeClass)}
        />
      ) : (
        <Input
          aria-label={`المساحة أو العدد — السطر ${index + 1}`}
          type="number"
          disabled={disabled}
          value={line.areaSqm ?? ""}
          onChange={(e) => onPatch(index, { ...line, areaSqm: e.target.value })}
          className={cn("text-center", sizeClass)}
        />
      ),
      ratio: componentLineAcceptsBuildRatio(line) ? (
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
          className={cn("text-center", sizeClass)}
        />
      ) : (
        <span className="block text-center text-text-3">—</span>
      ),
      unit: (
        <Select
          aria-label={`الوحدة — السطر ${index + 1}`}
          disabled={disabled}
          value={line.unit || "sqm"}
          onChange={(e) => onPatch(index, { ...line, unit: e.target.value })}
          className={sizeClass}
        >
          {COST_UNIT_OPTIONS.map((u) => (
            <option key={u.key} value={u.key}>
              {u.label}
            </option>
          ))}
        </Select>
      ),
      notes: (
        <Input
          aria-label={`ملاحظات — السطر ${index + 1}`}
          disabled={disabled}
          value={line.notes ?? ""}
          placeholder="الوصف والاستخدام"
          onChange={(e) => onPatch(index, { ...line, notes: e.target.value })}
          className={sizeClass}
        />
      ),
    };
  };

  return (
    <>
      <datalist id="specialist-component-items">
        {COST_ITEM_OPTIONS.filter((o) => o.key !== "custom").map((o) => (
          <option key={o.key} value={o.label} />
        ))}
      </datalist>
      {/* Phones: one editable card per line, every field full width under its label. */}
      <MobileRecordList className="lg:hidden" isEmpty={lines.length === 0} empty="لا بنود بعد.">
        {lines.map((line, index) => {
          const c = controls(line, index, "h-11 text-[14px]");
          return (
            <MobileRecordCard
              key={line.id ?? `new-${index}`}
              title={`البند ${index + 1}`}
              subtitle={<LineProvenance line={line} />}
              actions={
                !disabled ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onRemove(index)}
                    aria-label={`حذف البند ${index + 1}`}
                  >
                    حذف البند
                  </Button>
                ) : undefined
              }
            >
              <div className="flex flex-col gap-2.5">
                <PhoneField label="البند">{c.item}</PhoneField>
                <div className="grid grid-cols-2 gap-2.5">
                  <PhoneField label={c.isRepeated ? "عدد الأدوار" : "المساحة / العدد"}>
                    {c.qty}
                  </PhoneField>
                  <PhoneField label="نسبة البناء ٪">{c.ratio}</PhoneField>
                </div>
                <PhoneField label="الوحدة">{c.unit}</PhoneField>
                <PhoneField label="ملاحظات">{c.notes}</PhoneField>
              </div>
            </MobileRecordCard>
          );
        })}
      </MobileRecordList>
      <div className="overflow-x-auto rounded-lg border border-border max-lg:hidden">
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
              const c = controls(line, index, "text-xs");
              return (
                <Tr key={line.id ?? `new-${index}`} hoverable={false}>
                  <Td className="align-top">
                    {c.item}
                    <LineProvenance line={line} />
                  </Td>
                  <Td className="align-top">{c.qty}</Td>
                  <Td className="align-top">{c.ratio}</Td>
                  <Td className="align-top">{c.unit}</Td>
                  <Td className="align-top">{c.notes}</Td>
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
    </>
  );
}
