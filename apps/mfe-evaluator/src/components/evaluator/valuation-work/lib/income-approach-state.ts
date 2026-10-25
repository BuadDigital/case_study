/**
 * D17 — pure rules behind `IncomeApproachSection` (direct capitalisation): draft hydration from
 * the server DTO, the live chain the screen previews, and the save payload. Same formulas and
 * rounding as the server (`IncomeApproachRules`: decimal, half away from zero, 2 places):
 *   EGI = GPI × (1 − vacancy%) + other income; NOI = EGI − expenses; value = NOI ÷ (cap ÷ 100).
 * No React, no I/O.
 */
import type {
  OperatingExpensesMode,
  SaveValuationIncomeApproachRequest,
  ValuationApproachSettingsDto,
  ValuationIncomeApproachDto,
} from "@platform/api-client";
import { roundSar } from "@platform/app-shared/format/money";
import { parseLocaleNumber } from "@platform/app-shared/format/number";

/** Every input of the income screen, as typed strings (lossless while typing). */
export type IncomeApproachFields = {
  grossPotentialIncome: string;
  vacancyPct: string;
  otherIncome: string;
  opexMode: OperatingExpensesMode;
  opexAmount: string;
  opexPct: string;
  capRatePct: string;
  capRateRationale: string;
};

export type IncomeApproachDerived = {
  grossPotentialIncome: number;
  vacancyLoss: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  /** Expenses as % of EGI; null while EGI is zero. */
  opexPctOfEgi: number | null;
  netOperatingIncome: number;
  capRatePct: number | null;
  value: number;
  complete: boolean;
};

/** Alert bands mirrored from the server (alerts 26 / 27). */
export const INCOME_TYPICAL_CAP_RATE = { min: 4, max: 12 } as const;
export const INCOME_HIGH_OPEX_PCT_OF_EGI = 50;
export const INCOME_MAX_CAP_RATE_PCT = 30;

/** Printed name of the approach (screen tab, report section and reconciliation row). */
export const INCOME_APPROACH_LABEL = "أسلوب الدخل (رسملة مباشرة)";

/** Rule Q-2: the income screen exists only once the settings are saved with income on. */
export function incomeApproachAvailable(settings: ValuationApproachSettingsDto | null): boolean {
  return Boolean(settings?.isSaved && settings.incomeApproachEnabled);
}

/** Typed number via the shared locale rule (Arabic digits, «٫», thousands); blank or junk → 0. */
export function incomeNum(raw: string): number {
  return parseLocaleNumber(raw) || 0;
}

function text(n: number | null | undefined): string {
  return n == null ? "" : String(n);
}

export function emptyIncomeFields(): IncomeApproachFields {
  return {
    grossPotentialIncome: "",
    vacancyPct: "",
    otherIncome: "",
    opexMode: "pct_of_egi",
    opexAmount: "",
    opexPct: "",
    capRatePct: "",
    capRateRationale: "",
  };
}

/** Drafts from the saved row; a never-saved approach starts empty (not zeros). */
export function incomeFieldsFromDto(dto: ValuationIncomeApproachDto | null): IncomeApproachFields {
  if (!dto?.isSaved) return emptyIncomeFields();
  return {
    grossPotentialIncome: text(dto.grossPotentialIncome),
    vacancyPct: text(dto.vacancyCollectionLossPct),
    otherIncome: text(dto.otherIncome),
    opexMode: dto.operatingExpensesMode === "amount" ? "amount" : "pct_of_egi",
    opexAmount: text(dto.operatingExpensesAmount),
    opexPct: text(dto.operatingExpensesPct),
    capRatePct: text(dto.capitalisationRatePct),
    capRateRationale: dto.capRateRationale ?? "",
  };
}

/** The live chain — what the server will compute from these drafts. */
export function incomeDerived(fields: IncomeApproachFields): IncomeApproachDerived {
  const gpi = Math.max(0, incomeNum(fields.grossPotentialIncome));
  const vacancy = Math.min(100, Math.max(0, incomeNum(fields.vacancyPct)));
  const other = Math.max(0, incomeNum(fields.otherIncome));
  const vacancyLoss = roundSar((gpi * vacancy) / 100);
  const egi = roundSar(gpi - vacancyLoss + other);
  const opex =
    fields.opexMode === "amount"
      ? roundSar(Math.max(0, incomeNum(fields.opexAmount)))
      : roundSar((egi * Math.min(100, Math.max(0, incomeNum(fields.opexPct)))) / 100);
  const noi = roundSar(egi - opex);
  const capRaw = fields.capRatePct.trim() === "" ? null : incomeNum(fields.capRatePct);
  const cap = capRaw != null && capRaw > 0 ? capRaw : null;
  const value = noi > 0 && cap != null ? roundSar(noi / (cap / 100)) : 0;
  return {
    grossPotentialIncome: gpi,
    vacancyLoss,
    effectiveGrossIncome: egi,
    operatingExpenses: opex,
    opexPctOfEgi: egi > 0 ? roundSar((opex / egi) * 100) : null,
    netOperatingIncome: noi,
    capRatePct: cap,
    value,
    complete: gpi > 0 && cap != null && noi > 0,
  };
}

/** Soft warnings the screen shows before the save (the server alerts 26–28 decide issuance). */
export function incomeWarnings(derived: IncomeApproachDerived): string[] {
  const out: string[] = [];
  const cap = derived.capRatePct;
  if (cap != null && (cap < INCOME_TYPICAL_CAP_RATE.min || cap > INCOME_TYPICAL_CAP_RATE.max)) {
    out.push("معدل الرسملة خارج النطاق المعتاد 4٪–12٪ — اكتب مبرر المعدل بأدلة السوق");
  }
  if (derived.opexPctOfEgi != null && derived.opexPctOfEgi > INCOME_HIGH_OPEX_PCT_OF_EGI) {
    out.push("مصروفات التشغيل تتجاوز 50٪ من الدخل الفعلي — تحقّق منها");
  }
  if (derived.grossPotentialIncome > 0 && derived.netOperatingIncome <= 0) {
    out.push("صافي الدخل التشغيلي صفر أو سالب — لا ينتج أسلوب الدخل قيمة");
  }
  return out;
}

/** Save body — Latin numbers; a blank cap rate stays a draft (null), never 0. */
export function incomeSaveRequest(fields: IncomeApproachFields): SaveValuationIncomeApproachRequest {
  const cap = fields.capRatePct.trim();
  const rationale = fields.capRateRationale.trim();
  return {
    grossPotentialIncome: incomeNum(fields.grossPotentialIncome),
    vacancyCollectionLossPct: incomeNum(fields.vacancyPct),
    otherIncome: incomeNum(fields.otherIncome),
    operatingExpensesMode: fields.opexMode,
    operatingExpensesAmount: incomeNum(fields.opexAmount),
    operatingExpensesPct: incomeNum(fields.opexPct),
    capitalisationRatePct: cap === "" ? null : incomeNum(cap),
    capRateRationale: rationale === "" ? null : rationale,
  };
}
