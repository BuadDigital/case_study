// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Split  New file — the «تاريخ التقييم» block (issue date or retrospective date / period) moved here
//           out of ApproachSettingsSection.
//  • The retrospective block adds «مبرر التقييم بأثر رجعي» (required, at least 10 characters,
//         printed in the report scope).
//  • New OwnershipInterestFields: «نوع الملكية المقيَّمة» (ملكية تامة / حق منفعة / أرض مستأجرة) and,
//         for a leasehold, «المدة المتبقية (سنة)».
// Round 2 (1b19bedc)
//  • Date inputs take max = today (the server refuses a future retrospective date) and are
//           disabled while the settings save.
// Layout (2026-11-11)
//  • The card reads in the order of the decision: what is valued (scope · interest · date, three
//           columns), then by which approach. So the date is two chips in that row
//           (ValuationDateModeField) and the retrospective inputs open under the row, full width
//           (RetrospectiveFields); the interest's select fills its column.
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

/** Label of one field of the «what is valued» row — the three columns line up on it. */
export const SETTINGS_FIELD_LABEL = "mb-2 block text-[11.5px] font-medium text-text-2";
/** The one-line explanation under a field of that row. */
export const SETTINGS_FIELD_HINT = "mb-0 mt-1.5 text-[10.5px] leading-relaxed text-text-3";
/**
 * Columns that follow the width of the card, not of the window: as many columns of at least `min`
 * as fit, one under the other when a single one does not. The appraiser page keeps a rail beside
 * the card, so a window breakpoint put three cramped columns in a 530px card.
 */
export const SETTINGS_ROW_3 = "grid items-start gap-x-6 gap-y-4 grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))]";
export const SETTINGS_ROW_2 = "grid items-start gap-x-6 gap-y-3 grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))]";
/** Label of an input inside a sub-block (lease years, retrospective dates and rationale). */
const SUB_FIELD_LABEL = "mb-1.5 block text-[11px] font-semibold text-text-2";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="mb-0 mt-1.5 text-[11px] text-danger-text">{message}</p>
  ) : null;
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
      <label htmlFor={id} className={SUB_FIELD_LABEL}>
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

/**
 * «تاريخ التقييم»: the value as of the report's issue date, or of an earlier date / period.
 *
 * How it works: two chips, like the scope beside it; the line under them says what the choice
 * means. Choosing «أثر رجعي» opens `RetrospectiveFields` under the row.
 */
export function ValuationDateModeField({
  saving,
  invalid,
  dateMode,
  onDateModeChange,
}: {
  saving: boolean;
  invalid: boolean;
  dateMode: string;
  onDateModeChange: (mode: string) => void;
}) {
  const retrospective = dateMode === "retrospective";
  return (
    <div>
      <span className={SETTINGS_FIELD_LABEL}>تاريخ التقييم</span>
      <div
        id="as-valuation-date"
        className={cn("flex flex-wrap gap-2 rounded-[10px]", invalid && invalidControlClass)}
      >
        <ToggleChip
          active={!retrospective}
          disabled={saving}
          onClick={() => onDateModeChange("issue")}
        >
          تاريخ إصدار القيمة
        </ToggleChip>
        <ToggleChip
          active={retrospective}
          disabled={saving}
          onClick={() => onDateModeChange("retrospective")}
        >
          أثر رجعي
        </ToggleChip>
      </div>
      <p className={SETTINGS_FIELD_HINT}>
        {retrospective
          ? "قيمة في تاريخ أو فترة سابقة — أدخل التاريخ ومبرره أدناه."
          : "القيمة كما في تاريخ إصدار التقرير — لا يلزم إدخال تاريخ إضافي."}
      </p>
    </div>
  );
}

/**
 * The retrospective valuation's inputs: one date or a period, and the rationale printed in the
 * report scope.
 *
 * How it works: a full-width block under the «what is valued» row — the date(s) on one side, the
 * rationale on the other (one under the other on a narrow screen).
 */
export function RetrospectiveFields({
  saving,
  fieldErrors,
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
  retroKind: "single" | "range";
  onRetroKindChange: (kind: "single" | "range") => void;
  retroDate: string;
  onRetroDateChange: (value: string) => void;
  retroDateEnd: string;
  onRetroDateEndChange: (value: string) => void;
  retroRationale: string;
  onRetroRationaleChange: (value: string) => void;
}) {
  const rationaleError = fieldErrors.retrospectiveRationale;
  return (
    <div
      className={cn(
        SETTINGS_ROW_2,
        "mb-4 rounded-[var(--radius)] border border-border bg-surface-2 px-3.5 py-3.5",
      )}
    >
      <div>
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
      </div>

      <div>
        <label htmlFor="as-retro-rationale" className={SUB_FIELD_LABEL}>
          مبرر التقييم بأثر رجعي
        </label>
        <Textarea
          id="as-retro-rationale"
          value={retroRationale}
          disabled={saving}
          rows={3}
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
  );
}

/**
 * «نوع الملكية المقيَّمة»: freehold, usufruct or leased land with the remaining lease years.
 *
 * How it works: the select fills its column of the «what is valued» row; for a leasehold the
 * remaining years appear under it.
 */
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
    <div>
      <label htmlFor="as-ownership-interest" className={SETTINGS_FIELD_LABEL}>
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
      {leasehold ? (
        <div className="mt-2.5">
          <label htmlFor="as-remaining-lease-years" className={SUB_FIELD_LABEL}>
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
