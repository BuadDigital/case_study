import { sendValuationResource, type ValuationResourceResult } from "./valuation-resource";
import type { ValuationSelectionsApiConfig } from "./valuation-comparable-selections";

/** How operating expenses are entered: a typed annual amount, or a % of the effective gross income. */
export type OperatingExpensesMode = "amount" | "pct_of_egi";

/** D17 — income approach (direct capitalisation): the appraiser's inputs and the derived chain. */
export type ValuationIncomeApproachDto = {
  valuationRequestId: string;
  propertyId: string;
  isSaved: boolean;
  incomeApproachEnabled: boolean;
  grossPotentialIncome: number;
  vacancyCollectionLossPct: number;
  vacancyLossAmount: number;
  otherIncome: number;
  /** EGI = GPI × (1 − vacancy%) + other income. */
  effectiveGrossIncome: number;
  operatingExpensesMode: OperatingExpensesMode;
  operatingExpensesAmount: number;
  operatingExpensesPct: number;
  /** The expenses that enter NOI. */
  operatingExpensesTotal: number;
  operatingExpensesPctOfEgi?: number | null;
  /** NOI = EGI − expenses. */
  netOperatingIncome: number;
  capitalisationRatePct?: number | null;
  capRateRationale?: string | null;
  /** NOI ÷ cap rate (0 until complete) — the reconciliation indicator. */
  incomeValue: number;
  isComplete: boolean;
  updatedAtUtc?: string | null;
};

export type SaveValuationIncomeApproachRequest = {
  grossPotentialIncome: number;
  vacancyCollectionLossPct: number;
  otherIncome: number;
  operatingExpensesMode: OperatingExpensesMode;
  operatingExpensesAmount: number;
  operatingExpensesPct: number;
  /** 0 < r ≤ 30; null keeps the draft without a rate. */
  capitalisationRatePct: number | null;
  capRateRationale: string | null;
};

export async function getValuationIncomeApproach(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
): Promise<ValuationResourceResult<ValuationIncomeApproachDto>> {
  return sendValuationResource(config, valuationRequestId, "income-approach", INVALID_MESSAGE);
}

export async function saveValuationIncomeApproach(
  config: ValuationSelectionsApiConfig,
  valuationRequestId: string,
  body: SaveValuationIncomeApproachRequest,
): Promise<ValuationResourceResult<ValuationIncomeApproachDto>> {
  return sendValuationResource(config, valuationRequestId, "income-approach", INVALID_MESSAGE, body);
}

const INVALID_MESSAGE = "بيانات أسلوب الدخل غير صالحة";
