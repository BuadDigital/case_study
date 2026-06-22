"use client";

import {
  FLOW_META,
  type RegistrationSource,
} from "../prototype/registration-data";
import { REG_BACK } from "./registration-labels";
import { FLOW_THEME } from "./registration-layout";

export function RegistrationSidePanel({
  source,
  onBack,
}: {
  source: RegistrationSource;
  onBack: () => void;
}) {
  const meta = FLOW_META[source];
  const theme = FLOW_THEME[source];
  const icons: Record<RegistrationSource, string> = {
    hr: "HR",
    proc: "PROC",
    crm: "CRM",
  };

  return (
    <aside
      className="flex w-full shrink-0 flex-col border-b border-white/[0.08] bg-sidebar px-4 py-4 text-white max-lg:flex-row max-lg:items-center max-lg:gap-3 max-lg:py-3 lg:w-[234px] lg:flex-col lg:border-b-0 lg:border-e lg:py-5"
      aria-label={meta.dept}
    >
      <button
        type="button"
        className="mb-4 inline-flex w-fit cursor-pointer items-center gap-1.5 rounded border border-white/12 bg-white/[0.07] px-2.5 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white max-lg:order-3 max-lg:mb-0 max-lg:ms-auto"
        onClick={onBack}
      >
        {REG_BACK}
      </button>
      <div
        className={`mb-3.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white max-lg:mb-0 ${theme.sideLogo}`}
      >
        {icons[source]}
      </div>
      <div className="min-w-0 max-lg:flex-1">
        <div
          className={`mb-1 text-[9px] font-semibold uppercase tracking-wider max-lg:mb-0.5 ${theme.sideDept}`}
        >
          {meta.dept}
        </div>
        <h2 className="m-0 mb-2 text-sm font-semibold leading-snug text-white max-lg:mb-0 max-lg:truncate">
          {meta.title}
        </h2>
        <p className="m-0 mb-5 text-[11px] leading-relaxed text-white/45 max-lg:hidden">
          {meta.desc}
        </p>
      </div>
      <div className="mt-auto border-t border-white/[0.08] pt-3 max-lg:hidden">
        <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/30">
          أنواع المسجّلين
        </div>
        {meta.sideTypes.map((line) => (
          <div
            key={line}
            className="mb-1 rounded border-e-[3px] border-e-transparent bg-white/[0.05] px-2 py-1.5 text-[11px] text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white/80"
          >
            {line}
          </div>
        ))}
      </div>
    </aside>
  );
}
