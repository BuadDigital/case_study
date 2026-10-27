// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Split  New file — the «تاريخ التقييم» block (issue date or retrospective date / period) moved here
//           out of ApproachSettingsSection (ValuationDateFields).
//  • The retrospective block adds «مبرر التقييم بأثر رجعي» (required, at least 10 characters,
//         printed in the report scope).
//  • New OwnershipInterestFields: «نوع الملكية المقيَّمة» (ملكية تامة / حق منفعة / أرض مستأجرة) and,
//         for a leasehold, «المدة المتبقية (سنة)».
// Round 2 (1b19bedc)
//  • Date inputs take max = today (the server refuses a future retrospective date) and are
//           disabled while the settings save.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { invalidControlClass } from "@platform/app-shared/form-ux";
import { todayIso } from "@platform/app-shared/format/date";
import { cn, opsFldControl, Select, Textarea } from "@platform/ui-kit";
import { FieldLabel, ToggleChip } from "./atoms";
import {
  isLeaseholdInterest,
  OWNERSHIP_INTEREST_OPTIONS,
  RETROSPECTIVE_RATIONALE_MIN_LENGTH,
} from "./lib/approach-settings-form";

type FieldErrors = Record<string, string>;

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mb-0 mt-1.5 text-[11px] text-danger-text">{message}</p>
  ) : null;
}

function ModeButton({
  active,
  disabled,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-[var(--radius)] border px-3.5 py-3 text-start transition-[background,border-color] duration-150",
        active ? "border-gold bg-gold-soft" : "border-border-md bg-surface",
        disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
      )}
    >
      <div className="text-[12.5px] font-bold text-heading">{title}</div>
      <div className="mt-1 text-[10.5px] leading-relaxed text-text-3">{hint}</div>
    </button>
  );
}

function DateInput({
  id,
  label,
  value,
  min,
  invalid,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min?: string;
  invalid: boolean;
  /** While the settings save — the date cannot change under the request. */
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-semibold text-text-2">
        {label}
      </label>
      <input
        id={id}
        type="date"
        dir="ltr"
        value={value}
        min={min}
        // A retrospective date lies in the past (the server refuses a future one).
        max={todayIso()}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(opsFldControl, "font-semibold", invalid && invalidControlClass)}
      />
    </div>
  );
}

/** «تاريخ التقييم»: issue date or retrospective (a date or a period) with its rationale. */
export function ValuationDateFields({
  saving,
  fieldErrors,
  dateMode,
  onDateModeChange,
  retroKind,
  onRetroKindChange,
  retroDate,
  onRetroDateChange,
  retroDateEnd,
  onRetroDateEndChange,
  retroRationale,
  onRetroRationaleChange,
}: {
  saving: boolean;
  fieldErrors: FieldErrors;
  dateMode: string;
  onDateModeChange: (mode: string) => void;
  retroKind: "single" | "range";
  onRetroKindChange: (kind: "single" | "range") => void;
  retroDate: string;
  onRetroDateChange: (value: string) => void;
  retroDateEnd: string;
  onRetroDateEndChange: (value: string) => void;
  retroRationale: string;
  onRetroRationaleChange: (value: string) => void;
}) {
  const retrospective = dateMode === "retrospective";
  const rationaleError = fieldErrors.retrospectiveRationale;
  return (
    <div className="mb-4 border-t border-border pt-4">
      <FieldLabel>تاريخ التقييم</FieldLabel>
      <div
        id="as-valuation-date"
        className={cn(
          "my-2 mb-1.5 grid grid-cols-2 gap-2.5 max-sm:grid-cols-1 rounded-[10px]",
          fieldErrors.valuationDateMode && invalidControlClass,
        )}
      >
        <ModeButton
          active={!retrospective}
          disabled={saving}
          onClick={() => onDateModeChange("issue")}
          title="تاريخ إصدار القيمة"
          hint="القيمة كما في تاريخ إصدار التقرير"
        />
        <ModeButton
          active={retrospective}
          disabled={saving}
          onClick={() => onDateModeChange("retrospective")}
          title="أثر رجعي"
          hint="قيمة في تاريخ أو فترة سابقة"
        />
      </div>

      {retrospective ? (
        <div className="mt-3 rounded-[var(--radius)] border border-border bg-surface-2 px-3.5 py-3.5">
          <FieldLabel>صيغة الأثر الرجعي</FieldLabel>
          <div className="my-2 mb-1.5 flex flex-wrap gap-2">
            <ToggleChip
              active={retroKind === "single"}
              disabled={saving}
              onClick={() => {
                onRetroKindChange("single");
                onRetroDateEndChange("");
              }}
            >
              تاريخ محدد
            </ToggleChip>
            <ToggleChip
              active={retroKind === "range"}
              disabled={saving}
              onClick={() => onRetroKindChange("range")}
            >
              فترة بين تاريخين
            </ToggleChip>
          </div>

          {retroKind === "single" ? (
            <div className="mt-2.5 max-w-[14rem]">
              <DateInput
                id="as-retro-date"
                label="تاريخ الأثر الرجعي"
                value={retroDate}
                invalid={Boolean(fieldErrors.retrospective_date || fieldErrors.retrospectiveDate)}
                disabled={saving}
                onChange={onRetroDateChange}
              />
            </div>
          ) : (
            <div className="mt-2.5 grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
              <DateInput
                id="as-retro-date-from"
                label="من تاريخ"
                value={retroDate}
                invalid={Boolean(
                  fieldErrors.retrospective_date_from || fieldErrors.retrospectiveDate,
                )}
                disabled={saving}
                onChange={onRetroDateChange}
              />
              <DateInput
                id="as-retro-date-to"
                label="إلى تاريخ"
                value={retroDateEnd}
                min={retroDate || undefined}
                invalid={Boolean(
                  fieldErrors.retrospective_date_to || fieldErrors.retrospectiveDateEnd,
                )}
                disabled={saving}
                onChange={onRetroDateEndChange}
              />
            </div>
          )}

          <div className="mt-3">
            <label
              htmlFor="as-retro-rationale"
              className="mb-1.5 block text-[11px] font-semibold text-text-2"
            >
              مبرر التقييم بأثر رجعي
            </label>
            <Textarea
              id="as-retro-rationale"
              value={retroRationale}
              disabled={saving}
              rows={2}
              hasError={Boolean(rationaleError)}
              aria-invalid={rationaleError ? true : undefined}
              placeholder="سبب تقدير القيمة في تاريخ سابق (يُطبع في نطاق التقرير)"
              onChange={(e) => onRetroRationaleChange(e.target.value)}
            />
            {rationaleError ? (
              <FieldError message={rationaleError} />
            ) : (
              <p className="mb-0 mt-1 text-[10.5px] text-text-3">
                إلزامي — {RETROSPECTIVE_RATIONALE_MIN_LENGTH} أحرف على الأقل.
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="mb-0 mt-2 text-[10.5px] text-text-3">
          لا يلزم إدخال تاريخ إضافي — يُعتمد تاريخ إصدار القيمة.
        </p>
      )}
    </div>
  );
}

/** «نوع الملكية المقيَّمة»: freehold, usufruct or leased land with the remaining lease years. */
export function OwnershipInterestFields({
  saving,
  fieldErrors,
  ownershipKey,
  onOwnershipKeyChange,
  leaseYearsText,
  onLeaseYearsTextChange,
}: {
  saving: boolean;
  fieldErrors: FieldErrors;
  ownershipKey: string;
  onOwnershipKeyChange: (key: string) => void;
  leaseYearsText: string;
  onLeaseYearsTextChange: (value: string) => void;
}) {
  const leasehold = isLeaseholdInterest(ownershipKey);
  const leaseError = fieldErrors.remainingLeaseYears;
  return (
    <div className="mb-4 grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
      <div>
        <label
          htmlFor="as-ownership-interest"
          className="mb-1.5 block text-[11px] font-semibold text-text-2"
        >
          نوع الملكية المقيَّمة
        </label>
        <Select
          id="as-ownership-interest"
          value={ownershipKey}
          disabled={saving}
          hasError={Boolean(fieldErrors.ownershipInterestKey)}
          onChange={(e) => onOwnershipKeyChange(e.target.value)}
        >
          {OWNERSHIP_INTEREST_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.labelAr}
            </option>
          ))}
        </Select>
        <FieldError message={fieldErrors.ownershipInterestKey} />
      </div>
      {leasehold ? (
        <div>
          <label
            htmlFor="as-remaining-lease-years"
            className="mb-1.5 block text-[11px] font-semibold text-text-2"
          >
            المدة المتبقية (سنة)
          </label>
          <input
            id="as-remaining-lease-years"
            type="text"
            inputMode="decimal"
            dir="ltr"
            value={leaseYearsText}
            disabled={saving}
            aria-invalid={leaseError ? true : undefined}
            onChange={(e) => onLeaseYearsTextChange(e.target.value)}
            className={cn(opsFldControl, "font-semibold", leaseError && invalidControlClass)}
          />
          <FieldError message={leaseError} />
        </div>
      ) : null}
    </div>
  );
}
