"use client";

import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import {
  Input,
  Label,
  MobileRecordCard,
  MobileRecordList,
  PhoneField,
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
import { useViewportDesktop } from "@platform/app-shared/hooks/use-viewport-desktop";
import {
  PROPERTY_BOUNDARY_ROWS,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import { useFacadeOptions } from "../../query/use-facade-options";
import { FALLBACK_FACADE_OPTIONS } from "../field-inspection/inspector-wizard-state";

type BoundaryRow = (typeof PROPERTY_BOUNDARY_ROWS)[number];

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
  const isDesktop = useViewportDesktop();

  /**
   * One side's three editors — shared by the desktop row and the phone card.
   * `withIds`: only the tree on screen carries the error-scroll ids.
   */
  const controls = (row: BoundaryRow, withIds: boolean, sizeClass: string) => {
    const descError = fieldErrors[row.descKey];
    const lenError = fieldErrors[row.lenKey];
    return {
      desc: (
        <>
          <Input
            id={withIds ? `bnd_desc_${row.descKey}` : undefined}
            aria-label={`الحد — ${row.label}`}
            className={cn(sizeClass, descError && invalidControlClass)}
            hasError={Boolean(descError)}
            value={property[row.descKey]}
            placeholder="مثال: شارع عرض 15م"
            onChange={(e) => onPatch(row.descKey, e.target.value)}
          />
          {descError ? (
            <p className="mt-1 text-[10px] text-danger-text">{descError}</p>
          ) : null}
        </>
      ),
      len: (
        <>
          <Input
            id={withIds ? `bnd_len_${row.lenKey}` : undefined}
            aria-label={`الطول (م) — ${row.label}`}
            className={cn(sizeClass, lenError && invalidControlClass)}
            hasError={Boolean(lenError)}
            inputMode="decimal"
            value={property[row.lenKey]}
            placeholder="25.00"
            onChange={(e) => onPatch(row.lenKey, e.target.value)}
          />
          {lenError ? (
            <p className="mt-1 text-[10px] text-danger-text">{lenError}</p>
          ) : null}
        </>
      ),
      facade: (
        <Select
          id={withIds ? `bnd_facade_${row.facadeKey}` : undefined}
          aria-label={`نوع الواجهة — ${row.label}`}
          className={sizeClass}
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
      ),
    };
  };

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
      {/* Phones: one card per side with full-width editors — not a 720px table. */}
      {isDesktop === true ? null : (
        <MobileRecordList className="lg:hidden">
          {PROPERTY_BOUNDARY_ROWS.map((row) => {
            const c = controls(row, isDesktop === false, "h-11 text-[14px]");
            return (
              <MobileRecordCard key={row.descKey} title={row.label}>
                <div className="flex flex-col gap-2.5">
                  <PhoneField label="الحد">{c.desc}</PhoneField>
                  <div className="grid grid-cols-2 gap-2.5">
                    <PhoneField label="الطول (م)">{c.len}</PhoneField>
                    <PhoneField label="نوع الواجهة">{c.facade}</PhoneField>
                  </div>
                </div>
              </MobileRecordCard>
            );
          })}
        </MobileRecordList>
      )}
      {isDesktop === false ? null : (
        <Table className="min-w-[720px]" wrapClassName="max-lg:hidden">
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
              const c = controls(row, true, "text-xs");
              return (
                <Tr key={row.descKey} hoverable={false}>
                  <Td className="align-top font-semibold text-text-2">
                    {row.label}
                  </Td>
                  <Td className="align-top">{c.desc}</Td>
                  <Td className="align-top">{c.len}</Td>
                  <Td className="align-top">{c.facade}</Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}
