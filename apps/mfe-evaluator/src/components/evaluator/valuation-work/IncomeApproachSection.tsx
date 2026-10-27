// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Income  New file — «أسلوب الدخل (رسملة مباشرة)» (D17): gross potential income, vacancy and collection
//            loss, other income, operating expenses (amount or % of EGI), cap rate and its rationale,
//            with the EGI → NOI → value chain. Text inputs so Arabic digits are converted, not dropped.
// Round 2 (1b19bedc)
//  • R2-4  Inputs and save stay disabled until the saved row loads («جاري تحميل أسلوب الدخل…»); a load
//          error shows «إعادة المحاولة».
//  • R2-18  A cap rate the server refuses (≤ 0 or > 30٪) shows its refusal instead of a value
//           (incomeCapRateError).
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { memo, type ReactNode } from "react";
import type { ValuationIncomeApproachDto } from "@platform/api-client";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import { cn } from "@platform/ui-kit";

import { ApproachSummaryStrip } from "./ApproachSummaryStrip";
import { Card, FieldLabel, PrimaryBtn, ToggleChip } from "./atoms";
import { useValuationWorkErrors } from "./ValuationWorkErrors";
import { costNumericInput } from "./lib/cost-approach-state";
import {
  INCOME_APPROACH_LABEL,
  incomeCapRateError,
  type IncomeApproachDerived,
  type IncomeApproachFields,
} from "./lib/income-approach-state";
import { INCOME_FIELD_ERROR_KEYS } from "./lib/valuation-work-error-targets";
import { fmt } from "./lib/shell-utils";
import { useIncomeApproachWorkflow, type IncomeApproachWorkflow } from "./useIncomeApproachWorkflow";

const numInput =
  "w-full rounded-[7px] border border-border-md bg-surface px-2.5 py-[7px] text-[13px] font-bold text-heading max-lg:min-h-11 max-lg:text-[16px]";

type NumericKey = Exclude<keyof IncomeApproachFields, "opexMode" | "capRateRationale">;

function pct2(n: number | null): string {
  return n == null ? "—" : `${(Math.round(n * 100) / 100).toFixed(2)}٪`;
}

/** One labelled number box — text input so Arabic-Indic digits are converted, not dropped. */
function NumberField({
  workflow,
  field,
  label,
  suffix,
  disabled,
}: {
  workflow: IncomeApproachWorkflow;
  field: NumericKey;
  label: string;
  suffix: string;
  disabled: boolean;
}) {
  const { fieldErrors } = useValuationWorkErrors();
  const invalid = Boolean(fieldErrors[INCOME_FIELD_ERROR_KEYS[field]]);
  return (
    <label className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <span className="flex items-center gap-1.5">
        <input
          id={`income-${field}`}
          dir="ltr"
          inputMode="decimal"
          aria-label={label}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={workflow.fields[field]}
          onChange={(e) => workflow.setField(field, costNumericInput(e.target.value))}
          className={cn(numInput, invalid && invalidControlClass)}
        />
        <span className="shrink-0 text-[11.5px] text-text-3">{suffix}</span>
      </span>
    </label>
  );
}

function ResultRow({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        strong && "rounded-[9px] border border-border bg-surface-2 px-[13px] py-[11px]",
      )}
    >
      <span className={cn("text-[12.5px]", strong ? "font-bold text-heading" : "font-medium text-text-2")}>
        {label}
      </span>
      <span dir="ltr" className={cn("text-[13px] font-bold text-heading", strong && "text-[15px] font-extrabold")}>
        {value}
      </span>
    </div>
  );
}

/** EGI → expenses → NOI → value, as the server computes them on save. */
function IncomeResultsCard({
  derived,
  capRateError,
}: {
  derived: IncomeApproachDerived;
  /** A cap rate the server refuses (> 30٪): its refusal shows instead of a value. */
  capRateError: string | null;
}) {
  return (
    <Card id="income-results" className="mb-0">
      <div className="flex flex-col gap-2.5 px-[22px] pb-5 pt-[18px]">
        <div className="mb-1 text-[14.5px] font-extrabold text-heading">الناتج</div>
        <ResultRow label="خسائر الشغور والتحصيل" value={fmt(derived.vacancyLoss)} />
        <ResultRow label="الدخل الإجمالي الفعلي (EGI)" value={fmt(derived.effectiveGrossIncome)} />
        <ResultRow
          label="مصروفات التشغيل"
          value={`${fmt(derived.operatingExpenses)} (${pct2(derived.opexPctOfEgi)})`}
        />
        <ResultRow label="صافي الدخل التشغيلي (NOI)" value={fmt(derived.netOperatingIncome)} />
        <ResultRow label="معدل الرسملة" value={pct2(derived.capRatePct)} />
        <ResultRow
          label="القيمة = صافي الدخل ÷ معدل الرسملة"
          value={capRateError ? "—" : derived.complete ? fmt(derived.value) : "غير مكتمل"}
          strong
        />
        {capRateError ? (
          <p role="alert" className="m-0 text-[12px] font-bold text-danger-text">
            {capRateError}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * D17 — «أسلوب الدخل (رسملة مباشرة)»: gross potential income, vacancy and collection loss, other
 * income, operating expenses (amount or % of EGI), the capitalisation rate and its rationale.
 * Two columns on a desktop, one stacked column on a phone (44px inputs, 16px text).
 */
export const IncomeApproachSection = memo(function IncomeApproachSection({
  valuationRequestId,
  saving,
  locked = false,
  onSavingChange,
  onIncomeSaved,
}: {
  valuationRequestId: string | null;
  saving: boolean;
  locked?: boolean;
  onSavingChange: (saving: boolean) => void;
  onIncomeSaved: (dto: ValuationIncomeApproachDto) => void;
}) {
  const workflow = useIncomeApproachWorkflow({ valuationRequestId, locked, onSavingChange, onIncomeSaved });
  const { fields, setField, derived, warnings, loaded, loadError, retryLoad, saveIncome } = workflow;
  const { fieldErrors } = useValuationWorkErrors();
  // Closed until the saved row is in: a save before it would overwrite the row with empty drafts.
  const disabled = saving || locked || !loaded;
  const capRateError = incomeCapRateError(fields);
  const pctMode = fields.opexMode === "pct_of_egi";

  return (
    <>
      <ApproachSummaryStrip
        title={INCOME_APPROACH_LABEL}
        items={[
          { label: "صافي الدخل التشغيلي", value: fmt(derived.netOperatingIncome) },
          { label: "معدل الرسملة", value: pct2(derived.capRatePct) },
        ]}
        resultLabel="صافي الدخل ÷ معدل الرسملة ="
        result={
          capRateError
            ? capRateError
            : derived.complete
              ? fmt(derived.value)
              : "غير مكتمل — يلزم الدخل ومعدل الرسملة"
        }
        resultTone={derived.complete && !capRateError ? "heading" : "danger"}
      />
      {loadError ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[12.5px] text-red-text">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={retryLoad}
            className="rounded-[7px] border border-border-md bg-surface px-3 py-1.5 font-bold text-heading"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : !loaded ? (
        <p className="mb-3 text-[12.5px] text-text-3">جاري تحميل أسلوب الدخل…</p>
      ) : null}

      <div className="mb-6 grid grid-cols-[1.2fr_1fr] gap-[18px] max-lg:grid-cols-1">
        <Card id="income-inputs" className="mb-0">
          <div className="flex flex-col gap-3.5 px-[22px] pb-5 pt-[18px]">
            <div className="text-[14.5px] font-extrabold text-heading">مدخلات الدخل والمصروفات</div>
            <div className="grid grid-cols-2 gap-3 max-lg:grid-cols-1">
              <NumberField workflow={workflow} field="grossPotentialIncome" label="الدخل الإجمالي المحتمل (سنويًا)" suffix="ر.س" disabled={disabled} />
              <NumberField workflow={workflow} field="vacancyPct" label="نسبة الشغور وخسائر التحصيل" suffix="٪" disabled={disabled} />
              <NumberField workflow={workflow} field="otherIncome" label="دخل آخر (سنويًا)" suffix="ر.س" disabled={disabled} />
            </div>
            <div className="flex flex-col gap-2">
              <FieldLabel>مصروفات التشغيل</FieldLabel>
              <div className="flex flex-wrap gap-2">
                <ToggleChip active={pctMode} disabled={disabled} onClick={() => setField("opexMode", "pct_of_egi")}>
                  نسبة من الدخل الفعلي
                </ToggleChip>
                <ToggleChip active={!pctMode} disabled={disabled} onClick={() => setField("opexMode", "amount")}>
                  مبلغ سنوي
                </ToggleChip>
              </div>
              {pctMode ? (
                <NumberField workflow={workflow} field="opexPct" label="نسبة المصروفات من الدخل الإجمالي الفعلي" suffix="٪" disabled={disabled} />
              ) : (
                <NumberField workflow={workflow} field="opexAmount" label="المصروفات السنوية" suffix="ر.س" disabled={disabled} />
              )}
            </div>
            <NumberField workflow={workflow} field="capRatePct" label="معدل الرسملة" suffix="٪" disabled={disabled} />
            <label className="flex flex-col gap-1">
              <FieldLabel>مبرر معدل الرسملة (أدلة السوق)</FieldLabel>
              <textarea
                id="income-capRateRationale"
                rows={3}
                disabled={disabled}
                value={fields.capRateRationale}
                onChange={(e) => setField("capRateRationale", e.target.value)}
                placeholder="مثال: عوائد صفقات أصول مماثلة في الحي خلال آخر 12 شهرًا…"
                className={cn(
                  "w-full rounded-[7px] border border-dashed border-border bg-surface-2 px-[9px] py-1.5 text-[12px] text-text-2 max-lg:text-[16px]",
                  fieldErrors[INCOME_FIELD_ERROR_KEYS.capRateRationale] && invalidControlClass,
                )}
              />
            </label>
          </div>
        </Card>
        <IncomeResultsCard derived={derived} capRateError={capRateError} />
      </div>

      {warnings.length > 0 ? (
        <div className="mb-4 flex flex-col gap-1 rounded-[10px] border border-border-md bg-gold-soft px-4 py-3 text-[12px] text-gold-d">
          {warnings.map((w) => (
            <span key={w}>⚠ {w}</span>
          ))}
        </div>
      ) : null}

      <PrimaryBtn disabled={disabled} onClick={() => void saveIncome()}>
        حفظ أسلوب الدخل
      </PrimaryBtn>
    </>
  );
});
