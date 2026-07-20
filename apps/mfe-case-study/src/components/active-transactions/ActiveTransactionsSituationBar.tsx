"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { KpiBand, KpiCell, cn } from "@platform/design-system";
import type { PageId } from "@platform/types";
import { useActiveTransactionPageSituation } from "@case-study/mfe/query/use-active-transaction-page-situation";
import type { SituationTone } from "@case-study/mfe/lib/prototype/active-transaction-page-situation";

const toneIconClass: Record<SituationTone, string> = {
  blue: "bg-[color-mix(in_srgb,var(--info)_16%,transparent)] text-info-text",
  warn: "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#b8791a]",
  green: "bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success-text",
  red: "bg-[color-mix(in_srgb,var(--red)_15%,transparent)] text-red",
};

const toneValueClass: Partial<Record<SituationTone, string>> = {
  green: "!text-success-text",
  red: "!text-red",
};

function SituationIcon({ tone }: { tone: SituationTone }) {
  if (tone === "red") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    );
  }
  if (tone === "warn") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    );
  }
  if (tone === "green") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="m9 11 3 3L22 4" />
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
    const cell = (
      <KpiCell
        first={isFirst}
        last={isLast}
        icon={<SituationIcon tone={card.tone} />}
        iconClass={toneIconClass[card.tone]}
        label={card.label}
        value={values[card.key] ?? "—"}
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
          icon={<SituationIcon tone={card.tone} />}
          iconClass={toneIconClass[card.tone]}
          label={card.label}
          value={values[card.key] ?? "—"}
          valueClass={toneValueClass[card.tone]}
          sub={card.sub}
          dot={isFirst}
        />
      </Link>
    );
  });

  return <KpiBand className="mb-3">{rendered}</KpiBand>;
}
