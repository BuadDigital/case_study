"use client";

import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import { Input, Label } from "@platform/design-system";
import {
  PROPERTY_BOUNDARY_ROWS,
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
        أدخل وصف كل حد وطوله التقريبي من بيانات البورصة — يُستخدم لاحقاً في
        مطابقة المعاين والمكتب الهندسي.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead>
            <tr className="bg-surface">
              <th className="border border-border px-2 py-2 text-start font-semibold text-text-2">
                الاتجاه
              </th>
              <th className="border border-border px-2 py-2 text-start font-semibold text-text-2">
                الوصف
              </th>
              <th className="w-28 border border-border px-2 py-2 text-start font-semibold text-text-2">
                الطول (م)
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
