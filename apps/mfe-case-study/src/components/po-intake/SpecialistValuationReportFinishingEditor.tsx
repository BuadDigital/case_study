"use client";

import { useEffect, useState } from "react";
import { cn, FormRow, formControlClassName, useWorkDensity } from "@platform/ui-kit";
import { rememberPropertyPoNumber } from "@platform/app-shared/storage/specialist-report-extras-sync";
import { INSPECTOR_LOCKED_CONTROL_CLASS } from "../field-inspection/FieldInspectionWorkParts";
import { InsReadField } from "./PropertyDetailInspectionParts";
import {
  SPECIALIST_FINISHING_REQUIRED_MESSAGE,
  loadSpecialistFinishingLevel,
  saveSpecialistFinishingLevel,
  type SpecialistFinishingLevel,
} from "@platform/app-shared/app-data/valuation-report-specialist-finishing";
import {
  VALUATION_SPECIALIST_FINISHING_REQUIRED_EVENT,
} from "@platform/app-shared/events/app-events";

const OPTIONS: { value: SpecialistFinishingLevel; label: string }[] = [
  { value: "", label: "— اختر المستوى —" },
  { value: "luxury", label: "تشطيب فاخر" },
  { value: "medium", label: "تشطيب متوسط" },
  { value: "ordinary", label: "تشطيب عادي" },
  { value: "none", label: "بدون تشطيب" },
];

/** Editable finishing level for case specialist — printed/highlighted in the report. */
export function SpecialistValuationReportFinishingEditor({
  propertyId,
  poNumber,
  readOnly = false,
}: {
  propertyId: string;
  poNumber?: string;
  readOnly?: boolean;
}) {
  const [level, setLevel] = useState(() =>
    loadSpecialistFinishingLevel(propertyId),
  );
  const [invalid, setInvalid] = useState(false);
  // The work page's layout (`work` density) (Omar 2026-11-09): one field in the four-column row, the ui-kit control
  // when editable and the page's read-only style when locked — not a full-width hand-made select.
  const work = useWorkDensity();

  // Another property means another saved level — read it before this paint.
  const [levelForProperty, setLevelForProperty] = useState(propertyId);
  if (levelForProperty !== propertyId) {
    setLevelForProperty(propertyId);
    setLevel(loadSpecialistFinishingLevel(propertyId));
    setInvalid(false);
  }

  useEffect(() => {
    const id = propertyId.trim();
    const po = (poNumber ?? "").trim();
    if (id && po) rememberPropertyPoNumber(id, po);
  }, [propertyId, poNumber]);

  useEffect(() => {
    const onRequired = (event: Event) => {
      const detail = (event as CustomEvent<{ propertyId?: string }>).detail;
      if (detail?.propertyId?.trim() !== propertyId.trim()) return;
      setInvalid(true);
      window.requestAnimationFrame(() => {
        document
          .getElementById("specialist-valuation-finishing")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    };
    window.addEventListener(
      VALUATION_SPECIALIST_FINISHING_REQUIRED_EVENT,
      onRequired,
    );
    return () =>
      window.removeEventListener(
        VALUATION_SPECIALIST_FINISHING_REQUIRED_EVENT,
        onRequired,
      );
  }, [propertyId]);

  return (
    <section
      id="specialist-valuation-finishing"
      className="mb-4 rounded-[var(--radius-lg)] border border-border bg-surface px-3.5 py-3.5"
    >
      <div className="mb-2 text-[13px] font-extrabold text-heading">
        مستوى تشطيبات البناء
        {!readOnly ? (
          <span className="ms-1 text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-text-3">
        المستوى المختار يُظلَّل في التقرير. أوصاف الفاخر/المتوسط/العادي من إعدادات
        المنشأة.
      </p>
      {work ? (
        <FormRow>
          {readOnly ? (
            <InsReadField
              id="specialist-finishing-level"
              label="المستوى"
              value={OPTIONS.find((o) => o.value === level && o.value)?.label ?? ""}
            />
          ) : (
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] font-semibold text-text-2">المستوى</span>
              <select
                id="specialist-finishing-level"
                className={cn(
                  formControlClassName,
                  invalid &&
                    "border-danger shadow-[0_0_0_3px_color-mix(in_srgb,var(--red)_14%,transparent)]",
                )}
                value={level}
                aria-invalid={invalid || undefined}
                aria-required
                onChange={(e) => {
                  const next = e.target.value as SpecialistFinishingLevel;
                  setLevel(next);
                  setInvalid(false);
                  saveSpecialistFinishingLevel(propertyId, next);
                }}
              >
                {OPTIONS.map((opt) => (
                  <option key={opt.value || "empty"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </FormRow>
      ) : (
      <select
        className={cn(
          readOnly
            ? INSPECTOR_LOCKED_CONTROL_CLASS
            : "w-full rounded-[var(--radius)] border border-border-md bg-surface px-2.5 py-2 text-[12.5px] font-semibold text-text outline-none focus:border-ink",
          invalid &&
            !readOnly &&
            "border-danger shadow-[0_0_0_3px_color-mix(in_srgb,var(--red)_14%,transparent)]",
        )}
        value={level}
        disabled={readOnly}
        aria-invalid={invalid || undefined}
        aria-required={!readOnly || undefined}
        onChange={(e) => {
          if (readOnly) return;
          const next = e.target.value as SpecialistFinishingLevel;
          setLevel(next);
          setInvalid(false);
          saveSpecialistFinishingLevel(propertyId, next);
        }}
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value || "empty"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      )}
      {invalid && !readOnly ? (
        <p className="m-0 mt-2 text-[11.5px] font-semibold text-danger" role="alert">
          {SPECIALIST_FINISHING_REQUIRED_MESSAGE}
        </p>
      ) : null}
    </section>
  );
}
