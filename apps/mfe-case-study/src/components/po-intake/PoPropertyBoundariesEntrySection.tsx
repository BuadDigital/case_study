"use client";

import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import { Input, Label } from "@platform/ui-kit";
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-xs">
          <thead>
            <tr className="bg-surface">
              <th className="border border-border px-2 py-2 text-start font-semibold text-text-2">
                الاتجاه
              </th>
              <th className="border border-border px-2 py-2 text-start font-semibold text-text-2">
                النوع
              </th>
              <th className="border border-border px-2 py-2 text-start font-semibold text-text-2">
                الوصف
              </th>
              <th className="w-28 border border-border px-2 py-2 text-start font-semibold text-text-2">
                الطول (م)
              </th>
              <th className="border border-border px-2 py-2 text-start font-semibold text-text-2">
                تشطيب الواجهة
              </th>
            </tr>
          </thead>
          <tbody>
            {PROPERTY_BOUNDARY_ROWS.map((row) => {
              const descError = fieldErrors[row.descKey];
              const lenError = fieldErrors[row.lenKey];
              return (
                <tr key={row.descKey} className="bg-surface">
                  <td className="border border-border px-2 py-2 align-top font-semibold text-text-2">
                    {row.label}
                  </td>
                  <td className="border border-border px-2 py-2 align-top">
                    <select
                      id={`bnd_type_${row.typeKey}`}
                      className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text"
                      value={property[row.typeKey]}
                      onChange={(e) => onPatch(row.typeKey, e.target.value)}
                    >
                      {PROPERTY_BOUNDARY_TYPE_OPTIONS.map((o) => (
                        <option key={o.value || "empty"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-border px-2 py-2 align-top">
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
                  </td>
                  <td className="border border-border px-2 py-2 align-top">
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
                  </td>
                  <td className="border border-border px-2 py-2 align-top">
                    <Input
                      id={`bnd_facade_${row.facadeKey}`}
                      className="text-xs"
                      value={property[row.facadeKey]}
                      placeholder="مثال: حجر / دهان"
                      onChange={(e) => onPatch(row.facadeKey, e.target.value)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
