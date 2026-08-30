export const opsBtnGhost =
  "inline-flex min-h-11 items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-[18px] py-2.5 font-[inherit] text-[13px] font-semibold text-text-2 transition-colors enabled:hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-50";

export const opsBtnPrimary =
  "inline-flex min-h-11 items-center gap-2 rounded-[9px] border-none bg-ink px-[18px] py-2.5 font-[inherit] text-[13px] font-bold text-white transition-colors enabled:hover:bg-navy-3 disabled:cursor-not-allowed disabled:opacity-55";

export const opsBtnSm =
  "inline-flex min-h-9 items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3 py-1.5 font-[inherit] text-[12.5px] font-semibold text-text-2 transition-colors enabled:hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-50";

export const opsBtnSmPrimary =
  "inline-flex min-h-9 items-center gap-1.5 rounded-[9px] border-none bg-ink px-3 py-1.5 font-[inherit] text-[12.5px] font-bold text-white transition-colors enabled:hover:bg-navy-3 disabled:cursor-not-allowed disabled:opacity-55";

export const opsTfLbl = "mb-[7px] block text-xs font-semibold text-text-2";

export const opsTfNote =
  "rounded-[10px] border border-dashed border-border-md bg-surface-2 px-3.5 py-3 text-[12.5px] text-text-3";

export const opsFormGrid =
  "grid grid-cols-1 gap-3.5 min-[561px]:grid-cols-2";

export const opsFld = "flex min-w-0 flex-col gap-1.5";

export const opsFldFull = "col-span-full flex min-w-0 flex-col gap-1.5";

export const opsFldControl =
  "w-full rounded-[9px] border border-border-md bg-surface-2 px-3 py-[9px] font-[inherit] text-[13px] text-text outline-none transition-[border-color,box-shadow] focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_20%,transparent)]";

export const opsFldTextarea = `${opsFldControl} min-h-[62px] resize-y`;

export const opsFilters =
  "flex flex-wrap items-center gap-2.5 max-lg:w-full max-lg:flex-col max-lg:items-stretch";

export const opsTfActions = "mt-[18px] flex flex-wrap items-center gap-2.5";

export const opsPpBadge =
  "inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-gold-soft px-1.5 text-[11px] font-bold text-gold-d";

export const opsIconBoxGold =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-gold-soft text-gold-d";

export const opsEmptyHint = "py-6 text-center text-[12.5px] text-text-3";

export const opsLetterCard =
  "overflow-hidden rounded-[14px] border border-border bg-surface shadow-[0_1px_2px_rgba(18,40,76,0.04)]";

export const opsLetterHead =
  "flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2 px-4 py-3.5 sm:px-[18px]";

export const opsLetterTitle = "text-[14px] font-bold leading-snug text-heading";

export const opsLetterSub = "mt-0.5 text-[11.5px] leading-relaxed text-text-3";

const opsTfSegBase =
  "cursor-pointer border px-[15px] py-[9px] font-[inherit] text-[12.5px] font-semibold transition-[background,color,border-color] duration-[130ms] first:rounded-s-[9px] last:rounded-e-[9px] not-first:border-s-0";

export const opsTfSeg = `${opsTfSegBase} border-border-md bg-surface-2 text-text-2`;

export const opsTfSegActive = `${opsTfSegBase} border-ink bg-ink text-white`;
