// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Income  New file — pure rules of the income approach: drafts from the DTO, the live chain with
//            the server's formulas and rounding (EGI, NOI, value = NOI ÷ cap), warnings mirroring alerts
//            26/27, the save payload (blank cap rate stays null), incomeApproachAvailable.
// Round 2 (1b19bedc)
//  • New incomeScreenClosedReason — asks for the settings save when income is on only in the draft.
//  • New incomeCapRateError: cap rate must be above 0 and at most 30٪.
//  • B    New incomeSaveErrors: when the cap rate is outside 4–12٪ (alert 26) a written rationale is at
//         least 10 characters.
//  • New incomeFieldsDiffer — drafts vs the saved row, for the unsaved-edits warning.
// ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Pure rules behind `IncomeApproachSection` (direct capitalisation): draft hydration from
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
import { rationaleMinimumError } from "./rationale-minimum";

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

/** The income screen exists only once the settings are saved with income on. */
export function incomeApproachAvailable(settings: ValuationApproachSettingsDto | null): boolean {
  return Boolean(settings?.isSaved && settings.incomeApproachEnabled);
}

/**
 * Why the income screen is closed, or null when it opens. The tab may already show from the
 * settings draft (the toggle was switched on but not saved): the server refuses an income save
 * until the settings are saved with it on, so the screen asks for that save first.
 */
export function incomeScreenClosedReason(input: {
  settingsSaved: boolean;
  /** The tab's state — follows the settings draft. */
  incomeEnabled: boolean;
  /** The saved settings have the income approach on. */
  incomeSaved: boolean;
}): string | null {
  if (!input.settingsSaved) return "ابدأ التقييم أولاً.";
  if (!input.incomeEnabled) return "أسلوب الدخل غير مفعّل في إعدادات التقييم.";
  if (!input.incomeSaved) return "احفظ إعدادات التقييم أولاً — فُعِّل أسلوب الدخل ولم تُحفظ الإعدادات بعد.";
  return null;
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

/**
 * The server's refusal of a typed cap rate (ValuationIncomeApproachRequestRules): above 0 and at
 * most 30٪. Shown on the screen in place of a value the save would never accept.
 */
export function incomeCapRateError(fields: IncomeApproachFields): string | null {
  const raw = fields.capRatePct.trim();
  if (!raw) return null;
  const cap = incomeNum(raw);
  return cap > 0 && cap <= INCOME_MAX_CAP_RATE_PCT
    ? null
    : `معدل الرسملة يجب أن يكون أكبر من 0 ولا يتجاوز ${INCOME_MAX_CAP_RATE_PCT}٪`;
}

/**
 * What the save would refuse, keyed like the server's errors (checked before the round trip):
 * the cap-rate bounds, and — when alert 26 fires (rate outside 4–12٪) — a written rationale of at
 * least 10 characters.
 */
export function incomeSaveErrors(fields: IncomeApproachFields): Record<string, string> | null {
  const capError = incomeCapRateError(fields);
  if (capError) return { capitalisationRatePct: capError };
  const raw = fields.capRatePct.trim();
  const cap = raw ? incomeNum(raw) : null;
  const outside =
    cap != null && (cap < INCOME_TYPICAL_CAP_RATE.min || cap > INCOME_TYPICAL_CAP_RATE.max);
  const short = outside ? rationaleMinimumError("مبرر معدل الرسملة", fields.capRateRationale) : null;
  return short ? { capRateRationale: short } : null;
}

/** The drafts differ from what the server holds (a never-saved row compares with empty drafts). */
export function incomeFieldsDiffer(
  fields: IncomeApproachFields,
  saved: ValuationIncomeApproachDto | null,
): boolean {
  const base = incomeFieldsFromDto(saved);
  return (Object.keys(base) as (keyof IncomeApproachFields)[]).some(
    (key) => String(fields[key]).trim() !== String(base[key]).trim(),
  );
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
