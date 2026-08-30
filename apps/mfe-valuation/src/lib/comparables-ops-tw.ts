/**
 * Pixel-matched ops letter/form classes — same tokens as
 * `mfe-case-study/.../ops-tasks-tw.ts` (FailureTypesView look).
 * Local copy avoids pulling the case-study package graph into this MFE.
 */

export const opsBtnGhost =
  "inline-flex min-h-11 items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-[18px] py-2.5 font-[inherit] text-[13px] font-semibold text-text-2 transition-colors enabled:hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-50";

export const opsBtnPrimary =
  "inline-flex min-h-11 items-center gap-2 rounded-[9px] border-none bg-ink px-[18px] py-2.5 font-[inherit] text-[13px] font-bold text-white transition-colors enabled:hover:bg-navy-3 disabled:cursor-not-allowed disabled:opacity-55";

export const opsTfActions =
  "mt-5 flex flex-wrap gap-2.5 max-lg:sticky max-lg:bottom-0 max-lg:z-20 max-lg:-mx-4 max-lg:mt-6 max-lg:border-t max-lg:border-border max-lg:bg-surface/95 max-lg:px-4 max-lg:py-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:backdrop-blur-sm max-lg:[&>button]:min-w-[calc(50%-0.35rem)] max-lg:[&>button]:flex-1 max-lg:[&>button]:justify-center sm:mx-0";

export const opsTfLbl = "mb-[7px] block text-xs font-semibold text-text-2";

export const opsFormGrid =
  "grid grid-cols-1 gap-3.5 min-[561px]:grid-cols-2";

export const opsFld = "flex min-w-0 flex-col gap-1.5";

export const opsFldFull = "col-span-full flex min-w-0 flex-col gap-1.5";

export const opsFldControl =
  "w-full rounded-[9px] border border-border-md bg-surface-2 px-3 py-[9px] font-[inherit] text-[13px] text-text outline-none transition-[border-color,box-shadow] focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_20%,transparent)]";

export const opsToolbar =
  "mb-3.5 flex flex-wrap items-center justify-between gap-4 max-lg:mb-3 max-lg:flex-col max-lg:items-stretch max-lg:gap-2.5";

export const opsListCount =
  "inline-flex shrink-0 items-center gap-1 rounded-[6px] bg-gold-soft px-2.5 py-[3px] text-[12px] font-bold text-gold-d max-lg:ms-0 lg:ms-auto";

export const opsPpBadge =
  "inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-gold-soft px-1.5 text-[11px] font-bold text-gold-d";

export const opsIconBoxGold =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-gold-soft text-gold-d";

export const opsEmptyHint =
  "py-6 text-center text-[12.5px] text-text-3";

export const opsLetterCard =
  "overflow-hidden rounded-[14px] border border-border bg-surface shadow-[0_1px_2px_rgba(18,40,76,0.04)]";

export const opsLetterHead =
  "flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2 px-4 py-3.5 sm:px-[18px]";

export const opsLetterTitle =
  "text-[14px] font-bold leading-snug text-heading";

export const opsLetterSub =
  "mt-0.5 text-[11.5px] leading-relaxed text-text-3";
