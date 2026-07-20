/**
 * Pixel-matched Tailwind for operations tasks (Case Study.html look).
 * Residual CSS: apps/mfe-case-study/src/views/operations-tasks-look.css
 * (pulse tip arrow, show-all eye motion only).
 */

export const opsBtnGhost =
  "inline-flex items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-[18px] py-2.5 font-[inherit] text-[13px] font-semibold text-text-2 transition-colors enabled:hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-50";

export const opsBtnPrimary =
  "inline-flex items-center gap-2 rounded-[9px] border-none bg-ink px-[18px] py-2.5 font-[inherit] text-[13px] font-bold text-white transition-colors enabled:hover:bg-navy-3 disabled:cursor-not-allowed disabled:opacity-55";

export const opsTfActions = "mt-5 flex flex-wrap gap-2.5";

export const opsTfLbl =
  "mb-[7px] block text-xs font-semibold text-text-2";

export const opsTfLblInFld = "mb-0 block text-xs font-semibold text-text-2";

export const opsTfNote =
  "rounded-[10px] border border-dashed border-border-md bg-surface-2 px-3.5 py-3 text-[12.5px] text-text-3";

export const opsFormGrid =
  "grid grid-cols-1 gap-3.5 min-[561px]:grid-cols-2";

export const opsFld = "flex min-w-0 flex-col gap-1.5";

export const opsFldFull = "col-span-full flex min-w-0 flex-col gap-1.5";

export const opsFldControl =
  "w-full rounded-[9px] border border-border-md bg-surface-2 px-3 py-[9px] font-[inherit] text-[13px] text-text outline-none transition-[border-color,box-shadow] focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_20%,transparent)]";

export const opsFldTextarea = `${opsFldControl} min-h-[62px] resize-y`;

export const opsTfSegRow = "inline-flex flex-wrap";

const opsTfSegBase =
  "cursor-pointer border px-[15px] py-[9px] font-[inherit] text-[12.5px] font-semibold transition-[background,color,border-color] duration-[130ms] first:rounded-s-[9px] last:rounded-e-[9px] not-first:border-s-0";

export const opsTfSeg = `${opsTfSegBase} border-border-md bg-surface-2 text-text-2`;

/** Use instead of combining with opsTfSeg — avoids bg/text utility clashes (no twMerge). */
export const opsTfSegActive = `${opsTfSegBase} border-ink bg-ink text-white`;

const opsTfChipBase =
  "cursor-pointer rounded-full border px-[15px] py-2 font-[inherit] text-[12.5px] font-semibold transition-[background,color,border-color] duration-[130ms]";

export const opsTfChip = `${opsTfChipBase} border-border-md bg-surface text-text-2`;

export const opsTfChipActive = `${opsTfChipBase} border-gold-2 bg-gold-soft text-gold-d`;


export const opsTfDeeds =
  "flex max-h-[200px] flex-col gap-0.5 overflow-y-auto rounded-[10px] border border-border-md bg-surface-2 p-1.5";

export const opsTfDeed =
  "flex cursor-pointer items-center gap-[11px] rounded-lg px-2.5 py-2 text-[12.5px] text-text hover:bg-row-hover";

export const opsTfDeedCheck =
  "h-4 w-4 shrink-0 accent-gold-d";

export const opsModalClose =
  "grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-[9px] border-none bg-surface-2 p-0 font-[inherit] text-[15px] leading-none text-text-2 transition-[background,color] hover:bg-row-hover hover:text-heading";

export const opsModalFooter =
  "flex shrink-0 flex-wrap justify-end gap-2.5 border-t border-border bg-surface-2 px-[22px] py-3.5";

/* —— list / detail —— */

export const opsToolbar =
  "mb-3.5 flex flex-wrap items-center justify-between gap-4";

export const opsFilters = "flex flex-wrap items-center gap-2.5";

export const opsBackLink =
  "mb-2 inline-flex cursor-pointer items-center gap-[7px] border-none bg-transparent py-1.5 font-[inherit] text-[12.5px] font-semibold text-text-2 transition-colors hover:text-gold-d [&_svg]:-scale-x-100";

export const opsPpHead =
  "mb-[18px] rounded-[14px] border border-border bg-surface px-[22px] py-[18px] shadow-card";

export const opsPpTitle =
  "m-0 flex flex-wrap items-center gap-2.5 text-[18px] font-extrabold text-heading";

export const opsPpMeta =
  "mt-2 flex flex-wrap items-center gap-2.5 text-[12.5px] text-text-2";

export const opsPpBadge =
  "inline-flex items-center rounded-md bg-gold-soft px-[11px] py-[3px] text-xs font-bold text-gold-d";

export const opsPpSummary =
  "mt-4 flex flex-wrap gap-0 border-t border-border pt-3.5";

export const opsPpCell =
  "mb-2.5 min-w-[140px] border-s border-border px-[18px] first:border-s-0 first:ps-0";

export const opsPpCellK = "mb-[3px] text-[11px] text-text-3";

export const opsPpCellV = "text-[13.5px] font-semibold text-heading";

export const opsStepFlow =
  "my-1.5 flex flex-wrap items-center gap-x-0 gap-y-1.5";

export const opsStep = "flex items-center gap-[9px]";

export const opsStepDot =
  "grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border-2 text-xs font-bold";

export const opsStepDotIdle = "border-border-md bg-surface text-text-3";

export const opsStepDotDone = "border-ink bg-ink text-white";

export const opsStepDotActive = "border-gold bg-gold text-white";

export const opsStepDotCancel = "border-[#d9694f] bg-[#d9694f] text-white";

export const opsStepLbl = "text-[12.5px] font-semibold text-text-3";

export const opsStepLblOn = "text-[12.5px] font-semibold text-heading";

export const opsStepLine = "mx-2 h-0.5 w-[34px] bg-border-md";

export const opsStepLineOn = "mx-2 h-0.5 w-[34px] bg-ink";

export const opsMutedHint = "m-0 text-[11.5px] text-text-3";

export const opsLetterTitle = "text-[13.5px] font-extrabold text-heading";

export const opsLetterSub = "text-[11.5px] text-text-3";

export const opsLetterMeta = "text-[11.5px] font-semibold text-text-3";

export const opsIconBoxGold =
  "grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-gold-soft text-gold-d";

export const opsLetterBodyPad = "px-[18px] pb-[18px] pt-1";

export const opsEmptyHint =
  "px-0.5 py-5 text-center text-[12.5px] text-text-3";

export const opsDueCd = "text-[12.5px] font-bold text-heading";

export const opsDueCdOver = "text-[12.5px] font-bold text-[#d9694f]";

export const opsEventAv =
  "grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-[color-mix(in_srgb,var(--gold)_20%,transparent)] text-gold-d";

export const opsCmtEvent = "flex items-center gap-[11px] border-t border-border px-0.5 py-[11px] first:border-t-0";

export const opsHeadRow =
  "flex items-center gap-[11px]";

export const opsCellMuted = "text-[12.5px] text-text-2";

export const opsTaskDesc =
  "mt-4 rounded-xl border border-border bg-surface-2 px-4 py-3.5 text-[13px] leading-[1.7] text-text";

export const opsRemindCard =
  "mt-4 flex flex-wrap items-center justify-between gap-3.5 rounded-xl border border-border bg-surface px-[18px] py-3.5 shadow-card";

export const opsRemindBtn =
  "inline-flex items-center gap-2 rounded-[9px] border-none bg-gold-d px-[18px] py-2.5 font-[inherit] text-[13px] font-bold text-white shadow-[0_6px_16px_-6px_color-mix(in_srgb,var(--gold-d)_60%,transparent)] transition-[background,transform] duration-150 enabled:hover:-translate-y-px enabled:hover:bg-gold disabled:cursor-not-allowed disabled:opacity-55";

export const opsLetterCard =
  "overflow-hidden rounded-[14px] border border-border bg-surface";

export const opsLetterHead =
  "flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2 px-[18px] py-[15px]";

export const opsCmtThread = "flex flex-col";

export const opsCmt =
  "flex gap-[11px] border-t border-border px-0.5 py-3.5 first:border-t-0";

export const opsCmtAv =
  "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white";

export const opsCmtBody = "min-w-0 flex-1";

export const opsCmtH =
  "mb-[5px] flex flex-wrap items-center gap-2";

export const opsCmtName = "text-[13px] font-bold text-heading";

export const opsCmtRole =
  "rounded-full px-2 py-0.5 text-[10.5px] font-bold";

export const opsCmtTime = "ms-auto text-[11px] text-text-3";

export const opsCmtText = "whitespace-pre-wrap text-[13px] leading-[1.75] text-text";

export const opsCmtFiles = "mt-[9px] flex flex-wrap gap-[7px]";

export const opsFileChip = "inline-flex items-center gap-[7px] rounded-lg border border-border-md bg-surface-2 px-[11px] py-1.5 text-xs font-semibold text-text-2";

export const opsFileChipFx = "grid cursor-pointer place-items-center border-none bg-transparent p-0 font-[inherit] text-text-3 hover:text-[#d9694f]";

export const opsCmtComposer = "mt-1 border-t border-border pt-[15px]";

export const opsCmtTextarea = "min-h-[62px] w-full resize-y rounded-[10px] border border-border-md bg-surface-2 px-[13px] py-[11px] font-[inherit] text-[13px] text-text outline-none focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_20%,transparent)]";

export const opsCmtBar = "mt-[11px] flex items-center gap-2.5";

export const opsAttachBtn = "inline-flex cursor-pointer items-center gap-[7px] rounded-lg border border-border-md bg-surface px-3.5 py-[9px] font-[inherit] text-[12.5px] font-semibold text-text-2 transition-colors duration-[130ms] hover:bg-row-hover hover:text-heading";

export const opsCdWrap = "group/cd relative inline-flex items-center";

export const opsCdDot = "relative me-2 inline-block h-[9px] w-[9px] shrink-0 rounded-full";

/** Pair with residual CSS class `ops-cd-dot-live` for pulse + ::after ring */
export const opsCdTip = "ops-cd-tip pointer-events-none invisible absolute bottom-[calc(100%+8px)] start-0 z-[25] whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[11.5px] font-semibold text-white opacity-0 shadow-[0_8px_22px_-8px_rgba(18,40,76,0.42)] transition-[opacity,transform,visibility] duration-150 -translate-y-1 group-hover/cd:visible group-hover/cd:translate-y-0 group-hover/cd:opacity-100";

export const opsRemindMini = "grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-transparent bg-transparent text-gold-d transition-[background,border-color] hover:border-gold-2 hover:bg-[color-mix(in_srgb,var(--gold)_14%,transparent)]";

export const opsTkCheck = "grid cursor-pointer place-items-center";

export const opsTkCheckInput = "m-0 h-[17px] w-[17px] shrink-0 cursor-pointer accent-gold-d";

export const opsGridRow = "grid min-h-[58px] cursor-pointer items-center border-b border-border transition-colors duration-[120ms] hover:bg-row-hover";

export const opsGridRowOn = "bg-[color-mix(in_srgb,var(--gold)_10%,transparent)]";

export const opsTd =
  "flex min-w-0 items-center overflow-visible px-4 py-3.5";

export const opsTdC = "justify-center";

export const opsTh =
  "flex items-center justify-center whitespace-nowrap px-4 py-3.5 text-center text-xs font-bold text-heading";

export const opsThead =
  "grid border-b-2 border-gold bg-surface-2";

const opsShowAllBtnBase =
  "inline-flex cursor-pointer items-center gap-[7px] rounded-lg border px-[13px] py-2 font-[inherit] text-[12.5px] font-bold transition-[background,color,border-color] duration-[220ms] ease-in-out";

export const opsShowAllBtn = `${opsShowAllBtnBase} border-border-md bg-surface text-text-2`;

export const opsShowAllBtnOn = `${opsShowAllBtnBase} border-ink bg-ink text-white`;

export const opsBulk =
  "mb-3.5 flex flex-wrap items-center gap-3 rounded-[11px] bg-ink px-4 py-[11px] text-white";

export const opsBulkClear =
  "cursor-pointer rounded-lg border border-white/35 bg-transparent px-3.5 py-[9px] font-[inherit] text-[12.5px] font-semibold text-white";

export const opsDotSep = "text-text-3";

export const opsTypeIconSm =
  "grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-gold-soft text-gold-d";

export const opsRowTitle = "text-[13.5px] font-bold text-heading";

export const opsRowMeta =
  "inline-flex flex-wrap items-center gap-1.5 text-[11.5px] text-text-3";

export const opsLetterRow =
  "grid min-h-12 cursor-default items-center border-b border-border text-[13px]";

export const opsTdPo = "flex min-w-0 items-center overflow-visible px-4 py-3.5 text-[13px] font-semibold text-text-2";

export const opsTdDeed =
  "flex min-w-0 items-center overflow-visible px-4 py-3.5 text-[13px] font-bold text-gold-d";

export const opsTdPlain =
  "flex min-w-0 items-center overflow-visible px-4 py-3.5 text-[13px]";

export const opsTdCourt =
  "flex min-w-0 items-center overflow-visible px-4 py-3.5 text-[12.5px]";

export const opsThStart =
  "flex items-center justify-start whitespace-nowrap px-4 py-3.5 text-start text-xs font-bold text-heading";

export const opsFileSize = "font-medium text-text-3";

export const opsBulkCount = "text-[13px] font-bold";

export const opsListCount = "ms-auto text-[12.5px] font-semibold text-text-3";
