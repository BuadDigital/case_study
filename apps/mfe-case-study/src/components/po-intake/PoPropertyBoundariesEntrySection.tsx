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
  cn,
} from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import {
  PROPERTY_BOUNDARY_ROWS,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import { useFacadeOptions } from "../../query/use-facade-options";
import { FALLBACK_FACADE_OPTIONS } from "../field-inspection/inspector-wizard-state";

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
  // Same admin list («أنواع الواجهات») the inspector picks from.
  const facadeOptions = useFacadeOptions() ?? FALLBACK_FACADE_OPTIONS;

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
        أدخل كل حد وطوله ونوع واجهته — قيمة المعاين الميداني تتقدّم عليها في التقرير.
      </p>
      <Table className="min-w-[720px]">
        <THead>
          <Tr hoverable={false}>
            <Th>الجهة</Th>
            <Th>الحد</Th>
            <Th className="w-28">الطول (م)</Th>
            <Th>نوع الواجهة</Th>
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
                  <Input
                    id={`bnd_desc_${row.descKey}`}
                    className={cn("text-xs", descError && invalidControlClass)}
                    hasError={Boolean(descError)}
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
                    className={cn("text-xs", lenError && invalidControlClass)}
                    hasError={Boolean(lenError)}
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
                  <Select
                    id={`bnd_facade_${row.facadeKey}`}
                    className="text-xs"
                    value={property[row.facadeKey]}
                    onChange={(e) => onPatch(row.facadeKey, e.target.value)}
                  >
                    <option value="">—</option>
                    {/* Keep a saved value that is no longer in the list selectable. */}
                    {property[row.facadeKey] && !facadeOptions.includes(property[row.facadeKey]) ? (
                      <option value={property[row.facadeKey]}>{property[row.facadeKey]}</option>
                    ) : null}
                    {facadeOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
