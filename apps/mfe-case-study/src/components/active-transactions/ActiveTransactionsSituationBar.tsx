"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { KpiBand, KpiCell, cn } from "@platform/design-system";
import type { PageId } from "@platform/types";
import { useActiveTransactionPageSituation } from "@case-study/mfe/query/use-active-transaction-page-situation";
import type {
  SituationIconKind,
  SituationTone,
} from "@case-study/mfe/lib/prototype/active-transaction-page-situation";

const toneIconClass: Record<SituationTone, string> = {
  blue: "bg-[color-mix(in_srgb,var(--info)_16%,transparent)] text-info-text",
  warn: "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]",
  green: "bg-[color-mix(in_srgb,#3f8f5f_16%,transparent)] text-[#2f7a4d]",
  red: "bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red",
};

/** Case Study.html first appraisal / eng KPI uses gold soft icon. */
const goldSoftIconClass =
  "bg-[color-mix(in_srgb,var(--gold)_14%,transparent)] text-gold-d";

/** Case Study.html navy/ink KPI icon (جاهزة للفوترة / غير مفوترة). */
const inkIconClass =
  "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink";

const toneValueClass: Partial<Record<SituationTone, string>> = {
  green: "!text-[#2f7a4d]",
  red: "!text-red",
};

function SituationIcon({
  tone,
  kind,
}: {
  tone: SituationTone;
  kind?: SituationIconKind;
}) {
  const resolved =
    kind ??
    (tone === "red"
      ? "alert"
      : tone === "warn"
        ? "clock"
        : tone === "green"
          ? "check"
          : "clipboard");

  if (resolved === "play") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polygon points="6 4 20 12 6 20 6 4" />
      </svg>
    );
  }
  if (resolved === "clock") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    );
  }
  if (resolved === "check") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="m9 11 3 3L22 4" />
      </svg>
    );
  }
  if (resolved === "refresh") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 12a9 9 0 1 0 9-9" />
        <path d="M3 3v6h6" />
      </svg>
    );
  }
  if (resolved === "alert") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    );
  }
  if (resolved === "currency") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
  if (resolved === "card") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <line x1="6" y1="15" x2="10" y2="15" />
      </svg>
    );
  }
  if (resolved === "building") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 21h18M6 21V7l6-4 6 4M12 3v18" />
      </svg>
    );
  }
  if (resolved === "key") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="7.5" cy="15.5" r="5.5" />
        <path d="m11.5 11.5 9.5-9.5M15.5 7.5l3 3" />
      </svg>
    );
  }
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

function formatSituationValue(
  card: { valueFormat?: "count" | "sar" },
  value: number | undefined,
): ReactNode {
  if (value === undefined) return "—";
  if (card.valueFormat === "sar") {
    return (
      <span className="text-[20px] font-bold tabular-nums tracking-tight">
        {value.toLocaleString("en-US", { maximumFractionDigits: 0 })}{" "}
        <span className="text-[12px] font-bold text-text-3">ر.س</span>
      </span>
    );
  }
  return value;
}

export function ActiveTransactionsSituationBar({
  pageId,
}: {
  pageId: PageId;
}) {
  const situation = useActiveTransactionPageSituation(pageId);
  if (!situation) return null;

  const { cards, values } = situation;

  const rendered: ReactNode[] = cards.map((card, index) => {
    const isFirst = index === 0;
    const isLast = index === cards.length - 1;
    const displayValue = formatSituationValue(card, values[card.key]);
    const iconClass =
      card.icon === "play" ||
      card.icon === "building" ||
      (card.icon === "currency" && isFirst)
        ? goldSoftIconClass
        : card.icon === "card"
          ? inkIconClass
          : card.icon === "currency" && card.tone === "green"
            ? toneIconClass.green
            : card.icon === "key"
              ? toneIconClass.green
              : toneIconClass[card.tone];
    const cell = (
      <KpiCell
        first={isFirst}
        last={isLast}
        icon={<SituationIcon tone={card.tone} kind={card.icon} />}
        iconClass={iconClass}
        label={card.label}
        value={displayValue}
        valueClass={toneValueClass[card.tone]}
        sub={card.sub}
        dot={isFirst}
      />
    );

    if (!card.href) return <div key={card.key} className="contents">{cell}</div>;

    return (
      <Link
        key={card.key}
        href={card.href}
        className={cn(
          "flex min-w-0 flex-1 text-inherit no-underline transition-opacity hover:opacity-90",
          !isLast && "border-e border-border [&_.relative]:border-e-0",
        )}
      >
        <KpiCell
          first={isFirst}
          last
          icon={<SituationIcon tone={card.tone} kind={card.icon} />}
          iconClass={iconClass}
          label={card.label}
          value={displayValue}
          valueClass={toneValueClass[card.tone]}
          sub={card.sub}
          dot={isFirst}
        />
      </Link>
    );
  });

  return <KpiBand className="mb-3">{rendered}</KpiBand>;
}
