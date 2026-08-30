import { opsWorkCard } from "@platform/ui-kit";

/**
 * Finance-specific layout / stage / table tokens.
 * Shared chrome (buttons, fields, cards, notes) comes from `@platform/ui-kit`.
 */

/** Label without opsTfLbl bottom margin (finance stacks label via gap). */
export const finFldLbl = "text-[12px] font-semibold text-text-2";

export const finShell =
  "flex min-h-0 flex-1 flex-col bg-bg font-sans text-text";

/** .content { padding: 26px 30px 44px } */
export const finContent =
  "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-[30px] py-[26px] pb-11";

/* —— stage pills — pixel-match HTML data-rvtab —— */
export const finStagePills = "mb-3.5 flex flex-wrap gap-[7px]";

const finStagePillBase =
  "inline-flex h-auto shrink-0 cursor-pointer items-center gap-[7px] rounded-full border border-solid px-[15px] py-[8px] text-[12.5px] font-bold leading-none transition-[background,color,border-color] duration-150";

export const finStagePill = `${finStagePillBase} border-[#ddd8cc] bg-surface text-text-2 hover:border-gold hover:text-heading`;

export const finStagePillOn = `${finStagePillBase} border-[#102B4E] bg-[#102B4E] text-white`;

export const finStageCount =
  "inline-grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-surface-2 px-[5px] text-[10.5px] font-bold leading-none tabular-nums text-text-3";

export const finStageCountOn =
  "inline-grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-white/[0.22] px-[5px] text-[10.5px] font-bold leading-none tabular-nums text-white";

export const finSel = "relative flex shrink-0 items-center";

export const finSelCtrl =
  "min-h-[38px] min-w-[130px] cursor-pointer appearance-none rounded-[9px] border border-[#ddd8cc] bg-surface px-3 py-[9px] pe-8 text-[12.5px] font-medium leading-none text-text outline-none focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)]";

export const finCaret =
  "pointer-events-none absolute end-[11px] text-[10px] leading-none text-text-3";

export const finSearch =
  "relative flex min-w-[240px] flex-1 items-center";

export const finSearchIcon =
  "pointer-events-none absolute start-3 text-text-3";

export const finScrollY = "max-h-[220px] overflow-auto rounded-[12px]";

export const finRowActive =
  "bg-[color-mix(in_srgb,var(--gold)_12%,transparent)]";

export const finGroupRow =
  "cursor-pointer border-b border-border bg-surface-2 !py-[11px] transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_4%,var(--surface-2))]";

export const finTotRow =
  "border-b border-border bg-[color-mix(in_srgb,var(--gold)_7%,transparent)] !py-2.5 last:border-b-0";

export const finPo =
  "text-[13.5px] font-bold text-gold-d [direction:ltr] [unicode-bidi:isolate]";

export const finMuted = "truncate text-[13px] text-text-2";

export const finNum =
  "text-[14px] font-extrabold tabular-nums text-heading [direction:ltr] [unicode-bidi:isolate]";

export const finWork = `mb-4 ${opsWorkCard}`;

export const finWorkFlush = opsWorkCard;

export const finWorkHead =
  "mb-3 flex flex-wrap items-center justify-between gap-3";

export const finWorkTitle = "m-0 text-sm font-extrabold text-heading";

export const finGroupHead =
  "my-2.5 mt-4 flex flex-wrap items-center justify-between gap-2.5 first:mt-0";

export const finGroupTitle = "m-0 text-[13.5px] font-bold text-heading";

export const finSectionTitle = "m-0 text-[14.5px] font-extrabold text-heading";
