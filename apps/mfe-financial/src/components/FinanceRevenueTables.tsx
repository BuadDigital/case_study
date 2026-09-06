"use client";

/**
 * Revenue screen tables by stage — the entry `FinanceRevenueView` imports.
 * Each stage table is its own file, the shared cells live in
 * `FinanceRevenueTableParts`, and the pure decisions (filter, group, sums,
 * labels) in `lib/finance-revenue-state.ts`.
 */

export {
  EMPTY_TRACKING_ROWS,
  Chevron,
  DeedCell,
  FeeFlags,
  PoCell,
  RevenueStageEmpty,
  SearchIcon,
} from "./FinanceRevenueTableParts";
export { filterRows, fmtSar } from "../lib/finance-revenue-state";
export { StudyTable } from "./FinanceRevenueStudyTable";
export { EligibleTable } from "./FinanceRevenueEligibleTable";
export { BillingAssistantTable } from "./FinanceRevenueBillingAssistantTable";
export { CollectionTable } from "./FinanceRevenueCollectionTable";
export { CollectedTable } from "./FinanceRevenueCollectedTable";
export { StoppedTable } from "./FinanceRevenueStoppedTable";
