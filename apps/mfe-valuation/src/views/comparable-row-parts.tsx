import type { ComparablePropertyDto } from "@platform/api-client";

/**
 * Pieces of one comparable-bank row that the desktop list (`ComparablePropertiesView`) and the
 * phone cards (`ComparablePropertiesPhone`) both render — one copy, so they cannot drift apart.
 */

export const comparableDeactivateBtn =
  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-[#d9694f] transition-colors enabled:hover:border-[#d9694f]/40 enabled:hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-50";

export const comparableReactivateBtn =
  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-gold-d transition-colors enabled:hover:border-gold/40 enabled:hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50";

/** The tag / duplicate / inactive pills of a row, or null when it has none. */
export function comparableStatusPills(row: ComparablePropertyDto) {
  const pills = [
    row.reliabilityTag !== "normal" ? (
      <span
        key="rel"
        className="inline-flex items-center rounded-full bg-gold-soft px-2 py-0.5 text-[10.5px] font-bold text-gold-d"
      >
        {row.reliabilityTagLabelAr}
      </span>
    ) : null,
    row.isDuplicateTagged ? (
      <span
        key="dup"
        className="inline-flex items-center rounded-full bg-gold-soft px-2 py-0.5 text-[10.5px] font-bold text-gold-d"
      >
        مكرر
      </span>
    ) : null,
    row.duplicateSuspect && !row.isDuplicateTagged ? (
      <span
        key="sus"
        className="inline-flex items-center rounded-full border border-border-md px-2 py-0.5 text-[10.5px] font-semibold text-text-2"
      >
        اشتباه تكرار
      </span>
    ) : null,
    !row.isActive ? (
      <span
        key="off"
        className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-text-3"
      >
        معطّل
      </span>
    ) : null,
  ].filter(Boolean);
  return pills.length === 0 ? null : pills;
}

/** «القناة · الحداثة» plus the prior-deal note when the comparable came from an earlier deal. */
export function comparableSourceText(row: ComparablePropertyDto) {
  const c = row.sourceCard;
  let text = `${c.intakeChannelLabelAr} · ${c.freshnessLabelAr}`;
  if (c.fromPriorDeal) {
    text += ` · من معاملة سابقة${
      c.sourceWorkOrderNumber ? ` (${c.sourceWorkOrderNumber})` : ""
    }`;
  }
  return text;
}
