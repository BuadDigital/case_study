/**
 * Type scale from /active-inspection primary queue table
 * (ActiveTransactionQueueView default branch).
 */
export const INSPECTION_TABLE_TYPE = {
  /** Deed / primary identifier cell */
  deed: "text-[12.5px] !font-bold",
  /** Work order — inspection uses muted PO, not gold-primary hero */
  po: "!text-[12.5px] !font-semibold text-text-2",
  /** Body cells (city, district, type…) */
  body: "text-text-2",
  /** Party assignee names */
  name: "text-[12.5px] font-semibold text-text-2",
  /** Progress % under party */
  meta: "text-[12px] font-semibold text-text-3",
  empty: "text-[12.5px] font-normal text-text-3",
  ordinal: "text-[11px] font-semibold text-text-3",
} as const;
