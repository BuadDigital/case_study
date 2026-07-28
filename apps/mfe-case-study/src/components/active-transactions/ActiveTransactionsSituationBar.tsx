"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { KpiBand, KpiCell, cn } from "@platform/design-system";
import type { PageId } from "@platform/types";
import { useActiveTransactionPageSituation } from "@case-study/mfe/query/use-active-transaction-page-situation";
import type { PageSituationCardDef, SituationIconKind, SituationTone } from "@case-study/mfe/lib/prototype/active-transaction-page-situation";

const toneIconClass: Record<SituationTone, string> = {
  blue: "bg-navy-soft text-ink",
  warn: "bg-gold-soft text-gold-d",
  green: "bg-navy-soft text-ink",
  red: "bg-[color-mix(in_srgb,var(--red)_12%,transparent)] text-red",
};

/** Case Study.html first appraisal / eng KPI uses gold soft icon. */
const goldSoftIconClass = "bg-gold-soft text-gold-d";

/** Case Study.html navy/ink KPI icon (جاهزة للفوترة / غير مفوترة). */
const inkIconClass = "bg-navy-soft text-ink";

const toneValueClass: Partial<Record<SituationTone, string>> = {
  green: "!text-ink",
  red: "!text-red",
  warn: "!text-gold-d",
};

/** Mobile accent — brand ink / gold (not HTML blue–teal palette). */
const mobileToneRail: Record<SituationTone, string> = {
  blue: "border-s-ink",
  warn: "border-s-gold",
  green: "border-s-gold",
  red: "border-s-red",
};

const mobileToneWash: Record<SituationTone, string> = {
  blue: "bg-[radial-gradient(120%_90%_at_100%_0%,color-mix(in_srgb,var(--ink)_8%,transparent),transparent_60%)]",
  warn: "bg-[radial-gradient(120%_90%_at_100%_0%,color-mix(in_srgb,var(--gold)_16%,transparent),transparent_60%)]",
  green:
    "bg-[radial-gradient(120%_90%_at_100%_0%,color-mix(in_srgb,var(--gold)_12%,transparent),transparent_60%)]",
  red: "bg-[radial-gradient(120%_90%_at_100%_0%,color-mix(in_srgb,var(--red)_10%,transparent),transparent_60%)]",
};

function SituationIcon({
  tone,
  kind,
  size = 17,
}: {
  tone: SituationTone;
  kind?: SituationIconKind;
  size?: number;
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

  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (resolved === "play") {
    return (
      <svg {...props}>
        <polygon points="6 4 20 12 6 20 6 4" />
      </svg>
    );
  }
  if (resolved === "clock") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    );
  }
  if (resolved === "check") {
    return (
      <svg {...props}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="m9 11 3 3L22 4" />
      </svg>
    );
  }
  if (resolved === "refresh") {
    return (
      <svg {...props}>
        <path d="M3 12a9 9 0 1 0 9-9" />
        <path d="M3 3v6h6" />
      </svg>
    );
  }
  if (resolved === "alert") {
    return (
      <svg {...props}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    );
  }
  if (resolved === "currency") {
    return (
      <svg {...props}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
  if (resolved === "card") {
    return (
      <svg {...props}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <line x1="6" y1="15" x2="10" y2="15" />
      </svg>
    );
  }
  if (resolved === "building") {
    return (
      <svg {...props}>
        <path d="M3 21h18M6 21V7l6-4 6 4M12 3v18" />
      </svg>
    );
  }
  if (resolved === "key") {
    return (
      <svg {...props}>
        <circle cx="7.5" cy="15.5" r="5.5" />
        <path d="m11.5 11.5 9.5-9.5M15.5 7.5l3 3" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

function resolveIconClass(
  card: PageSituationCardDef,
  isFirst: boolean,
): string {
  if (
    card.icon === "play" ||
    card.icon === "building" ||
    (card.icon === "currency" && isFirst)
  ) {
    return goldSoftIconClass;
  }
  if (card.icon === "card") return inkIconClass;
  if (card.icon === "currency" && card.tone === "green") {
    return toneIconClass.green;
  }
  if (card.icon === "key") return toneIconClass.green;
  return toneIconClass[card.tone];
}

function formatSituationValue(
  card: { valueFormat?: "count" | "sar" },
  value: number | undefined,
  compact = false,
): ReactNode {
  if (value === undefined) return "—";
  if (card.valueFormat === "sar") {
    return (
      <span
        className={cn(
          "font-bold tabular-nums tracking-tight",
          compact ? "text-[18px]" : "text-[20px]",
        )}
      >
        {value.toLocaleString("en-US", { maximumFractionDigits: 0 })}{" "}
        <span className="text-[11px] font-bold text-text-3">ر.س</span>
      </span>
    );
  }
  return value;
}

/** Mobile HTML-style stat card — `docs/المعاين/inspector_screen 1.html` `.stat-card`. */
function MobileSituationStatCard({
  card,
  value,
  iconClass,
  index,
}: {
  card: PageSituationCardDef;
  value: ReactNode;
  iconClass: string;
  index: number;
}) {
  const inner = (
    <div
      className={cn(
        "relative flex min-h-[88px] items-center gap-3 overflow-hidden rounded-[14px] border border-border border-s-[3px] bg-surface px-3.5 py-3.5",
        "shadow-[0_2px_8px_rgba(15,52,96,0.06)]",
        "transition-[box-shadow,border-color,transform] duration-150",
        "active:scale-[0.985]",
        mobileToneRail[card.tone],
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-0 opacity-90",
          mobileToneWash[card.tone],
        )}
        aria-hidden
      />
      <span
        className={cn(
          "relative z-[1] grid size-10 shrink-0 place-items-center rounded-[10px]",
          iconClass,
        )}
      >
        <SituationIcon tone={card.tone} kind={card.icon} size={18} />
      </span>
      <div className="relative z-[1] min-w-0 flex-1">
        <div
          className={cn(
            "text-[22px] font-extrabold leading-none tracking-tight text-heading tabular-nums",
            toneValueClass[card.tone],
          )}
        >
          <bdi>{value}</bdi>
        </div>
        <div className="mt-1.5 text-[12px] font-semibold leading-snug text-text">
          {card.label}
        </div>
        <div className="mt-0.5 truncate text-[10.5px] text-text-3">
          {card.sub}
        </div>
      </div>
    </div>
  );

  const wrapClass = cn(
    "ui-animate-fade-in min-w-0",
    card.href && "block text-inherit no-underline",
  );
  const style = { animationDelay: `${Math.min(index, 6) * 45}ms` };

  if (card.href) {
    return (
      <Link href={card.href} className={wrapClass} style={style}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={wrapClass} style={style}>
      {inner}
    </div>
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

  const desktopCells: ReactNode[] = cards.map((card, index) => {
    const isFirst = index === 0;
    const isLast = index === cards.length - 1;
    const displayValue = formatSituationValue(card, values[card.key]);
    const iconClass = resolveIconClass(card, isFirst);
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

  return (
    <>
      {/* Desktop / tablet: keep connected KPI band (web squares). */}
      <KpiBand className="mb-3 hidden lg:flex">{desktopCells}</KpiBand>

      {/* Mobile: HTML inspector separate stat cards (2×2). */}
      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:hidden">
        {cards.map((card, index) => (
          <MobileSituationStatCard
            key={card.key}
            card={card}
            value={formatSituationValue(card, values[card.key], true)}
            iconClass={resolveIconClass(card, index === 0)}
            index={index}
          />
        ))}
      </div>
    </>
  );
}
