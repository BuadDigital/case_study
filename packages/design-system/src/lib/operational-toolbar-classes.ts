/** Toolbar fields — aligned with docs/new look أوامر العمل (.search / .sel / .primary). */
export const operationalToolbarSearchWrapClassName =
  "relative flex min-w-[min(100%,220px)] flex-1 basis-[240px] items-center max-w-[320px]";

export const operationalToolbarSearchInputClassName =
  "h-[38px] w-full rounded-lg border border-border-md bg-surface py-0 pe-3.5 ps-9 text-[13px] leading-[38px] text-text shadow-none outline-none transition-[border-color,box-shadow] placeholder:text-text-3 focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)] focus:ring-0";

export const operationalToolbarSelectWrapClassName = "relative flex items-center";

export const operationalToolbarSelectClassName =
  "h-[38px] cursor-pointer appearance-none rounded-lg border border-border-md bg-surface py-0 pe-8 ps-3.5 text-[13px] leading-[38px] text-text shadow-none outline-none transition-[border-color,box-shadow] focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)] focus:ring-0";

export const operationalToolbarSelectCaretClassName =
  "pointer-events-none absolute end-[11px] top-1/2 grid -translate-y-1/2 place-items-center text-text-3";

export const operationalToolbarPrimaryButtonClassName =
  "inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-lg border-0 bg-ink px-4 text-[13px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,.6)] transition-[transform,background] hover:-translate-y-px hover:bg-navy-3 disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-y-0";
