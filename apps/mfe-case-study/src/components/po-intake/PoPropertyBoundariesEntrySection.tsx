"use client";

import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import {
  Input,
  Label,
  Select,
  TBody,
  Table,
  Td,
  Th,
  THead,
  Tr,
} from "@platform/ui-kit";
import {
  PROPERTY_BOUNDARY_ROWS,
  PROPERTY_BOUNDARY_TYPE_OPTIONS,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";

type Props = {
  property: PoPropertyIntake;
  fieldErrors: FieldErrors;
  onPatch: <K extends keyof PoPropertyIntake>(
    key: K,
    value: PoPropertyIntake[K],
  ) => void;
};

export function PoPropertyBoundariesEntrySection({
  property,
  fieldErrors,
  onPatch,
}: Props) {
  return (
    <div className="mt-4 w-full rounded-lg border border-border bg-surface-2 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Label className="m-0 text-[12px] font-semibold text-text">
          الحدود والأطوال
        </Label>
        <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-text-3">
          إدخال اختياري
        </span>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-text-3">
        أدخل وصف كل حد ونوعه وطوله — نوع الحد يُحسب منه عدد الشوارع في التسويات.
      </p>
      <Table className="min-w-[720px]">
        <THead>
          <Tr hoverable={false}>
            <Th>الاتجاه</Th>
            <Th>النوع</Th>
            <Th>الوصف</Th>
            <Th className="w-28">الطول (م)</Th>
            <Th>تشطيب الواجهة</Th>
          </Tr>
        </THead>
        <TBody>
          {PROPERTY_BOUNDARY_ROWS.map((row) => {
            const descError = fieldErrors[row.descKey];
            const lenError = fieldErrors[row.lenKey];
            return (
              <Tr key={row.descKey} hoverable={false}>
                <Td className="align-top font-semibold text-text-2">
                  {row.label}
                </Td>
                <Td className="align-top">
                  <Select
                    id={`bnd_type_${row.typeKey}`}
                    className="text-xs"
                    value={property[row.typeKey]}
                    onChange={(e) => onPatch(row.typeKey, e.target.value)}
                  >
                    {PROPERTY_BOUNDARY_TYPE_OPTIONS.map((o) => (
                      <option key={o.value || "empty"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td className="align-top">
                  <Input
                    id={`bnd_desc_${row.descKey}`}
                    className="text-xs"
                    value={property[row.descKey]}
                    placeholder="مثال: شارع عرض 15م"
                    onChange={(e) => onPatch(row.descKey, e.target.value)}
                  />
                  {descError ? (
                    <p className="mt-1 text-[10px] text-danger-text">{descError}</p>
                  ) : null}
                </Td>
                <Td className="align-top">
                  <Input
                    id={`bnd_len_${row.lenKey}`}
                    className="text-xs"
                    inputMode="decimal"
                    value={property[row.lenKey]}
                    placeholder="25.00"
                    onChange={(e) => onPatch(row.lenKey, e.target.value)}
                  />
                  {lenError ? (
                    <p className="mt-1 text-[10px] text-danger-text">{lenError}</p>
                  ) : null}
                </Td>
                <Td className="align-top">
                  <Input
                    id={`bnd_facade_${row.facadeKey}`}
                    className="text-xs"
                    value={property[row.facadeKey]}
                    placeholder="مثال: حجر / دهان"
                    onChange={(e) => onPatch(row.facadeKey, e.target.value)}
                  />
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
