/**
 * Pixel-matched Tailwind for operations tasks (Case Study.html look).
 * Shared chrome (buttons, letter card, fields, toolbar) lives in `@platform/ui-kit`.
 * Residual motion: Tailwind animate-[ops-pulse-*] on the live countdown dot,
 * and show-all eye blink via ShowAllEye.
 */

import {
  opsAccentBtn as _opsAccentBtn,
  opsBtnPrimary as _opsBtnPrimary,
  opsFldTextarea,
  opsPanelCard,
  opsPpHeadCard,
} from "@platform/ui-kit";

export {
  opsAccentBtn,
  opsBtnGhost,
  opsBtnPrimary,
  opsCheckInput,
  opsTfActions,
  opsTfLbl,
  opsTfNote,
  opsFormGrid,
  opsFld,
  opsFldFull,
  opsFldControl,
  opsFldTextarea,
  opsTfSegRow,
  opsTfSeg,
  opsTfSegActive,
  opsToolbar,
  opsFilters,
  opsListCount,
  opsPpBadge,
  opsIconBoxGold,
  opsLetterCard,
  opsLetterHead,
  opsLetterTitle,
  opsLetterSub,
  opsLetterMeta,
  opsModalClose,
  opsModalFooter,
} from "@platform/ui-kit";

export const opsTfLblInFld = "mb-0 block text-xs font-semibold text-text-2";

const opsTfChipBase =
  "cursor-pointer rounded-full border px-[15px] py-2 font-[inherit] text-[12.5px] font-semibold transition-[background,color,border-color] duration-[130ms]";

export const opsTfChip = `${opsTfChipBase} border-border-md bg-surface text-text-2`;

export const opsTfChipActive = `${opsTfChipBase} border-gold-2 bg-gold-soft text-gold-d`;

export const opsTfDeeds =
  "flex max-h-[200px] flex-col gap-0.5 overflow-y-auto rounded-[10px] border border-border-md bg-surface-2 p-1.5";

export const opsTfDeed =
  "flex cursor-pointer items-center gap-[11px] rounded-lg px-2.5 py-2 text-[12.5px] text-text hover:bg-row-hover";

export const opsTfDeedCheck = "h-4 w-4 shrink-0 accent-gold-d";

export const opsPpHead = opsPpHeadCard;

export const opsPpTitle =
  "m-0 flex flex-wrap items-center gap-2.5 text-[16px] font-extrabold text-heading sm:text-[18px]";

export const opsPpMeta =
  "mt-2 flex flex-wrap items-center gap-2.5 text-[12.5px] text-text-2";

export const opsPpSummary =
  "mt-4 flex flex-wrap gap-0 border-t border-border pt-3.5 max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-2 max-lg:gap-y-2.5 max-lg:pt-3";

export const opsPpCell =
  "mb-2.5 min-w-0 border-s border-border px-3 first:border-s-0 first:ps-0 max-lg:mb-0 max-lg:border-s-0 max-lg:px-0 sm:min-w-[140px] sm:px-[18px]";

export const opsPpCellK = "mb-[3px] text-[11px] text-text-3";

export const opsPpCellV =
  "break-words text-[13px] font-semibold text-heading sm:text-[13.5px]";

/** Confirm receipt control in task summary — desktop far-left, mobile full-width touch target. */
export const opsReceiptConfirmWrap =
  "flex shrink-0 items-center justify-end max-lg:col-span-2 max-lg:mt-1 max-lg:w-full lg:ms-auto lg:border-s-0 lg:pe-0 lg:ps-3";

export const opsReceiptConfirmBtn = `${_opsBtnPrimary} max-lg:w-full max-lg:min-h-12 sm:min-h-9 sm:px-3.5 sm:py-1.5 sm:text-[12.5px]`;

export const opsStepFlow =
  "my-1.5 flex flex-wrap items-center gap-x-0 gap-y-1.5 max-lg:gap-y-2";

export const opsStep = "flex items-center gap-[9px]";

export const opsStepDot =
  "grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border-2 text-xs font-bold";

export const opsStepDotIdle = "border-border-md bg-surface text-text-3";

export const opsStepDotDone = "border-ink bg-ink text-white";

export const opsStepDotActive = "border-gold bg-gold text-white";

export const opsStepDotCancel = "border-[#d9694f] bg-[#d9694f] text-white";

export const opsStepLbl = "text-[12.5px] font-semibold text-text-3";

export const opsStepLblOn = "text-[12.5px] font-semibold text-heading";

export const opsStepLine = "mx-1.5 h-0.5 w-5 bg-border-md sm:mx-2 sm:w-[34px]";

export const opsStepLineOn = "mx-1.5 h-0.5 w-5 bg-ink sm:mx-2 sm:w-[34px]";

export const opsMutedHint = "m-0 text-[11.5px] text-text-3";

export const opsLetterBodyPad = "px-[18px] pb-[18px] pt-1";

export const opsDueCd = "text-[12.5px] font-bold text-heading";

export const opsDueCdOver = "text-[12.5px] font-bold text-[#d9694f]";

export const opsEventAv =
  "grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-[color-mix(in_srgb,var(--gold)_20%,transparent)] text-gold-d";

export const opsCmtEvent =
  "flex items-center gap-[11px] border-t border-border px-0.5 py-[11px] first:border-t-0";

export const opsHeadRow = "flex items-center gap-[11px]";

export const opsRemindCard = `mt-4 flex flex-wrap items-center justify-between gap-3.5 ${opsPanelCard} px-3.5 py-3.5 max-lg:flex-col max-lg:items-stretch sm:px-[18px]`;

/** Remind CTA — accent + full-width on mobile task panels. */
export const opsRemindBtn = `${_opsAccentBtn} max-lg:w-full max-lg:min-h-11`;

export const opsCmtThread = "flex flex-col";

export const opsCmt =
  "flex gap-[11px] border-t border-border px-0.5 py-3.5 first:border-t-0";

export const opsCmtAv =
  "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white";

export const opsCmtBody = "min-w-0 flex-1";

export const opsCmtH = "mb-[5px] flex flex-wrap items-center gap-2";

export const opsCmtName = "text-[13px] font-bold text-heading";

export const opsCmtRole = "rounded-full px-2 py-0.5 text-[10.5px] font-bold";

export const opsCmtTime = "ms-auto text-[11px] text-text-3";

export const opsCmtText =
  "whitespace-pre-wrap text-[13px] leading-[1.75] text-text";

export const opsCmtFiles = "mt-[9px] flex flex-wrap gap-[7px]";

export const opsFileChip = "inline-flex items-center gap-[7px] rounded-lg border border-border-md bg-surface-2 px-[11px] py-1.5 text-xs font-semibold text-text-2";

export const opsFileChipFx = "grid cursor-pointer place-items-center border-none bg-transparent p-0 font-[inherit] text-text-3 hover:text-[#d9694f]";

export const opsCmtComposer = "mt-1 border-t border-border pt-[15px]";

export const opsCmtTextarea = opsFldTextarea;

export const opsCmtBar = "mt-[11px] flex items-center gap-2.5";

export const opsAttachBtn =
  "inline-flex cursor-pointer items-center gap-[7px] rounded-lg border border-border-md bg-surface px-3.5 py-[9px] font-[inherit] text-[12.5px] font-semibold text-text-2 transition-colors duration-[130ms] hover:bg-row-hover hover:text-heading";

export const opsCdWrap = "group/cd relative inline-flex items-center gap-2";

export const opsCdDot =
  "relative inline-block h-[9px] w-[9px] shrink-0 self-center rounded-full";

export const opsCdTip =
  "pointer-events-none invisible absolute bottom-[calc(100%+8px)] start-0 z-[25] whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[11.5px] font-semibold text-white opacity-0 shadow-[0_8px_22px_-8px_rgba(18,40,76,0.42)] transition-[opacity,transform,visibility] duration-150 -translate-y-1 group-hover/cd:visible group-hover/cd:translate-y-0 group-hover/cd:opacity-100";

export const opsRemindMini =
  "grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-transparent bg-transparent text-gold-d transition-[background,border-color] hover:border-gold-2 hover:bg-[color-mix(in_srgb,var(--gold)_14%,transparent)]";

export const opsTkCheck = "grid cursor-pointer place-items-center";

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

export const opsFileSize = "font-medium text-text-3";

export const opsBulkCount = "text-[13px] font-bold";
