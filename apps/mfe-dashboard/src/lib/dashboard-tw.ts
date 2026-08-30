import { opsPanelCard, opsTapElevated } from "@platform/ui-kit";

/** Tailwind class tokens for HTML renderDashboard layout. */

export const dashGrid =
  "mt-1 grid grid-cols-1 gap-4 lg:grid-cols-2";

export const dashKpi = `w-full cursor-pointer ${opsPanelCard} ${opsTapElevated} px-[18px] py-[15px] text-start font-[inherit] text-inherit`;

export const dashLine =
  "flex items-center gap-[11px] border-b border-border px-1 py-[9px] last:border-b-0 hover:rounded-lg hover:bg-surface-2";

export const dashLineNew =
  "shadow-[inset_-3px_0_0_var(--gold)] ltr:shadow-[inset_3px_0_0_var(--gold)]";

export const dashIco =
  "grid size-[30px] shrink-0 place-items-center rounded-lg";
