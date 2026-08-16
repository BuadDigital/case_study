/**
 * Tailwind token classes for finance screens (pixel ref: design pack sizes).
 * No CSS files — pure utilities + design tokens.
 */

export const finShell =
  "flex min-h-0 flex-1 flex-col bg-bg font-sans text-text";

/** .content { padding: 26px 30px 44px } */
export const finContent =
  "flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-[30px] py-[26px] pb-11";

export const finSub = "m-0 mb-3 text-[12.5px] leading-[1.55] text-text-2";

export const finHint = "mt-3 mb-0 text-[13px] leading-[1.55] text-text-3";

export const finNote =
  "m-0 mb-3.5 rounded-[10px] border border-dashed border-border-md bg-surface-2 px-[15px] py-[11px] text-[12.5px] leading-[1.7] text-text-3";

/* —— stage pills — pixel-match HTML data-rvtab (padding 8×15, 12.5px, count 18) —— */
export const finStagePills = "mb-3.5 flex flex-wrap gap-[7px]";

const finStagePillBase =
  "inline-flex h-auto shrink-0 cursor-pointer items-center gap-[7px] rounded-full border border-solid px-[15px] py-[8px] text-[12.5px] font-bold leading-none transition-[background,color,border-color] duration-150";

export const finStagePill = `${finStagePillBase} border-[#ddd8cc] bg-surface text-text-2 hover:border-gold hover:text-heading`;

/** ink B4E — بدون ظل (مطابق HTML) */
export const finStagePillOn = `${finStagePillBase} border-[#102B4E] bg-[#102B4E] text-white`;

export const finStageCount =
  "inline-grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-surface-2 px-[5px] text-[10.5px] font-bold leading-none tabular-nums text-text-3";

export const finStageCountOn =
  "inline-grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-white/[0.22] px-[5px] text-[10.5px] font-bold leading-none tabular-nums text-white";

/* —— toolbar / filters —— */
/** .toolbar { margin-bottom:14px; gap:16px } */
export const finToolbar =
  "mb-3.5 flex flex-wrap items-center justify-between gap-4";

/**
 * فلاتر الإيرادات HTML:
 * بحث (flex:1 min 240) · مدينة · فترة — gap 10px
 */
export const finFilters = "mb-3.5 flex w-full flex-wrap items-center gap-2.5";

export const finSel = "relative flex shrink-0 items-center";

/** FIN_SEL_STYLE: padding 9×12, 12.5px, radius 9, min-width 130 */
export const finSelCtrl =
  "min-h-[38px] min-w-[130px] cursor-pointer appearance-none rounded-[9px] border border-[#ddd8cc] bg-surface px-3 py-[9px] pe-8 text-[12.5px] font-medium leading-none text-text outline-none focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)]";

export const finCaret =
  "pointer-events-none absolute end-[11px] text-[10px] leading-none text-text-3";

/** بحث الإيرادات: flex:1; min-width:240 — أولاً في الصف (يمين RTL) */
export const finSearch =
  "relative flex min-w-[240px] flex-1 items-center";

export const finSearchIcon =
  "pointer-events-none absolute start-3 text-text-3";

/** INP_STYLE: padding 9×12, 13px, radius 9, surface-2 */
export const finSearchInput =
  "min-h-[38px] w-full rounded-[9px] border border-[#ddd8cc] bg-surface-2 py-[9px] pe-3.5 ps-9 text-[13px] leading-none text-text outline-none transition-[border-color,box-shadow] placeholder:text-text-3 focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)]";
/* —— buttons —— */
/** .primary { padding:10px 16px; font-size:13px; border-radius:8px } */
export const finPrimary =
  "inline-flex cursor-pointer items-center justify-center gap-[7px] rounded-lg border-none bg-ink px-4 py-2.5 font-[inherit] text-[13px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,0.6)] transition-[transform,background] duration-150 enabled:hover:-translate-y-px enabled:hover:bg-navy-3 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:transform-none";

/** .ghost-btn { height:38px; padding:0 13px; font-size:13px } */
export const finGhost =
  "inline-flex h-[38px] cursor-pointer items-center justify-center gap-[7px] whitespace-nowrap rounded-lg border border-border-md bg-surface px-[13px] font-[inherit] text-[13px] font-medium text-text-2 no-underline transition-[border-color,color,background] duration-150 enabled:hover:border-gold enabled:hover:bg-surface-2 enabled:hover:text-gold-d disabled:cursor-not-allowed disabled:opacity-45";

/* —— card + grid table —— */
/** .card { border-radius:12px; shadow } */
export const finCard =
  "overflow-hidden rounded-[12px] border border-border bg-surface shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)]";

export const finCardPad =
  "rounded-[12px] border border-border bg-surface p-3.5 shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)]";

export const finScroll = "overflow-x-auto rounded-[12px]";

export const finScrollY = "max-h-[220px] overflow-auto rounded-[12px]";

/** .thead { border-bottom:2px solid gold; bg surface-2 } */
export const finThead = "grid border-b-2 border-gold bg-surface-2";

/** .th { padding:14px 16px; font-size:12px; font-weight:700 } */
export const finTh =
  "flex min-w-0 items-center justify-center overflow-hidden px-4 py-3.5 text-center text-[12px] font-bold whitespace-nowrap text-heading first:justify-start first:text-start";

/** .row { min-height:58px } */
export const finRow =
  "grid min-h-[58px] items-center border-b border-border transition-colors duration-[120ms] last:border-b-0 hover:bg-row-hover";

export const finRowActive =
  "bg-[color-mix(in_srgb,var(--gold)_12%,transparent)]";

export const finRowClickable = "cursor-pointer";

/** .td { padding:14px 16px } */
export const finTd =
  "flex min-w-0 items-center justify-center overflow-hidden px-4 py-3.5 text-center text-[13px] text-text first:justify-start first:text-start";

/** إيرادات — تحت الدراسة (تجميع بأمر العمل · صك/مدينة/اكتمال/أتعاب) */
export const finGridRevStudy =
  "min-w-[780px] grid-cols-[minmax(150px,1.35fr)_minmax(90px,0.7fr)_minmax(120px,0.9fr)_minmax(160px,1.1fr)]";

/** إيرادات — مؤهلة للفوترة */
export const finGridRevEligible =
  "min-w-[820px] grid-cols-[minmax(105px,0.9fr)_minmax(142px,1fr)_minmax(70px,0.55fr)_minmax(104px,0.82fr)_minmax(146px,0.9fr)_minmax(238px,1.3fr)]";

/** إيرادات — مساعد الفوترة (مع checkbox) */
export const finGridRevBilling =
  "min-w-[1080px] grid-cols-[50px_minmax(142px,1.1fr)_minmax(132px,0.8fr)_minmax(132px,0.8fr)_minmax(110px,0.85fr)_minmax(100px,0.85fr)_minmax(90px,0.75fr)_minmax(112px,0.95fr)_minmax(162px,0.95fr)]";

/** إيرادات — بانتظار التحصيل (ضمن مجموعة فاتورة) */
export const finGridRevCollect =
  "min-w-[720px] grid-cols-[minmax(130px,1.2fr)_minmax(105px,0.9fr)_minmax(112px,0.95fr)_minmax(96px,0.8fr)_minmax(132px,1fr)]";

/** إيرادات — محصّلة */
export const finGridRevCollected =
  "min-w-[960px] grid-cols-[minmax(100px,0.85fr)_minmax(134px,1fr)_minmax(70px,0.55fr)_minmax(104px,0.82fr)_minmax(112px,0.9fr)_minmax(120px,0.95fr)_minmax(105px,0.85fr)_minmax(92px,0.7fr)]";

/** إيرادات — متوقفة / مستبعدة */
export const finGridRevStopped =
  "min-w-[820px] grid-cols-[minmax(105px,0.9fr)_minmax(125px,1fr)_minmax(72px,0.58fr)_minmax(105px,0.82fr)_minmax(210px,1.5fr)_minmax(150px,1fr)]";

/** توافق خلفي */
export const finGridRev = finGridRevEligible;

/** group head for PO / invoice — min-height ~46–48 */
export const finGroupRow =
  "grid min-h-[48px] cursor-pointer items-center border-b border-border bg-surface-2 px-4 py-[11px] transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_4%,var(--surface-2))]";

export const finTotRow =
  "grid min-h-[38px] items-center border-b border-border bg-[color-mix(in_srgb,var(--gold)_7%,transparent)] last:border-b-0";

export const finGridExcluded =
  "min-w-full grid-cols-[minmax(120px,1.3fr)_minmax(100px,1fr)_minmax(110px,1fr)_100px_minmax(140px,1.2fr)]";

export const finGridTasks =
  "min-w-full grid-cols-[minmax(150px,1.4fr)_minmax(160px,1.6fr)_88px_88px_minmax(120px,1fr)]";

export const finGridDues =
  "min-w-[720px] grid-cols-[50px_minmax(150px,1.5fr)_minmax(98px,0.75fr)_minmax(125px,1fr)_minmax(85px,0.72fr)]";

export const finGridStmts =
  "min-w-[720px] grid-cols-[minmax(150px,1.5fr)_minmax(95px,0.85fr)_minmax(92px,0.7fr)_minmax(100px,0.9fr)_minmax(190px,1fr)]";

export const finGridStmtLines =
  "min-w-[480px] grid-cols-[minmax(150px,1.5fr)_minmax(120px,1fr)_122px]";

/** .po { font-size:13.5px; font-weight:700; color gold-d } */
export const finPo =
  "text-[13.5px] font-bold text-gold-d [direction:ltr] [unicode-bidi:isolate]";

/** .muted { font-size:13px } */
export const finMuted = "truncate text-[13px] text-text-2";

/** .num { font-size:14px; font-weight:800 } */
export const finNum =
  "text-[14px] font-extrabold tabular-nums text-heading [direction:ltr] [unicode-bidi:isolate]";

/** .date { font-size:13px } */
export const finDate =
  "whitespace-nowrap text-[13px] text-text-2 [direction:ltr] [unicode-bidi:isolate]";

export const finTitle = "font-bold text-heading";

export const finEmpty = "px-5 py-[54px] text-center text-text-3";

/** .empty .t { font-size:14px } */
export const finEmptyT = "text-[14px] font-bold text-text-2";

export const finEmptyS = "mt-1 text-[13px]";

/* —— status chips .status { padding:4px 11px; font-size:12px; gap:6px } —— */
export const finStatus =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] px-[11px] py-1 text-[12px] font-bold text-ink";

export const finStatusGold =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-gold-soft px-[11px] py-1 text-[12px] font-bold text-gold-d";

export const finStatusGreen =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[color-mix(in_srgb,#3f8f5f_12%,transparent)] px-[11px] py-1 text-[12px] font-bold text-[#2f7a4d]";

export const finStatusRed =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[color-mix(in_srgb,#c0553d_12%,transparent)] px-[11px] py-1 text-[12px] font-bold text-[#a5432e]";

export const finStatusTeal =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[color-mix(in_srgb,#0f766e_12%,transparent)] px-[11px] py-1 text-[12px] font-bold text-[#0f766e]";

export function finStatusFor(status: string): string {
  switch (status) {
    case "closed":
    case "paid":
    case "ready":
    case "success":
      return finStatusGreen;
    case "cancelled":
    case "rejected":
    case "danger":
      return finStatusRed;
    case "issued":
    case "invoice_received":
    case "deferred":
    case "warning":
    case "draft":
      return finStatusGold;
    case "individual":
      return finStatusTeal;
    default:
      return finStatus;
  }
}

/* —— work panel / layout —— */
export const finWork =
  "mb-4 rounded-[14px] border border-border bg-surface px-[18px] py-4 shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)]";

export const finWorkFlush =
  "rounded-[14px] border border-border bg-surface px-[18px] py-4 shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)]";

export const finWorkHead =
  "mb-3 flex flex-wrap items-center justify-between gap-3";

export const finWorkTitle = "m-0 text-sm font-extrabold text-heading";

export const finGroupHead =
  "my-2.5 mt-4 flex flex-wrap items-center justify-between gap-2.5 first:mt-0";

export const finGroupTitle = "m-0 text-[13.5px] font-bold text-heading";

export const finSectionTitle = "m-0 text-[14.5px] font-extrabold text-heading";

export const finActionsRow = "mb-3.5 flex flex-wrap items-center gap-2.5";

export const finCheck = "m-0 h-[17px] w-[17px] cursor-pointer accent-gold-d";

export const finCheckLbl =
  "inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-text-2";

export const finFld = "flex flex-col gap-1.5";

export const finFldLbl = "text-[12px] font-semibold text-text-2";

export const finFormGrid = "grid grid-cols-1 gap-3.5 min-[561px]:grid-cols-2";

export const finPanelTitle = "mb-2 text-[12.5px] font-bold text-heading";

export const finAgeOver =
  "text-sm font-extrabold tabular-nums text-[#a5432e] [direction:ltr]";

/* —— KPI band —— */
export const finKpi =
  "mb-6 flex flex-wrap overflow-hidden rounded-[12px] border border-border bg-surface shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)]";

export const finKpiCell =
  "relative min-w-[140px] flex-1 border-e border-border px-6 py-5 last:border-e-0";

export const finKpiCellFirst =
  "relative min-w-[140px] flex-1 border-e border-border px-6 py-5 last:border-e-0 before:absolute before:inset-y-0 before:start-0 before:w-[3px] before:bg-gold before:content-['']";

export const finKpiLbl = "mb-3.5 text-[12.5px] font-medium text-text-2";

export const finKpiNum =
  "text-[32px] font-extrabold leading-none text-heading [direction:ltr] [unicode-bidi:isolate]";

/** KPI رقم أصغر — فوترة الأتعاب / HTML style font-size:20px */
export const finKpiNumSm =
  "text-[20px] font-extrabold leading-none text-heading [direction:ltr] [unicode-bidi:isolate]";

export const finKpiSub = "mt-2 flex items-center gap-1.5 text-xs text-text-3";

export const finKpiDot = "inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gold";

export const finKpiHead = "mb-3.5 flex items-center gap-2.5";

export const finKpiIco =
  "grid h-[30px] w-[30px] place-items-center rounded-[7px] bg-gold-soft text-gold-d";

export const finKpiIcoTint =
  "grid h-[30px] w-[30px] place-items-center rounded-[7px]";
