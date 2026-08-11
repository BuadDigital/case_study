"use client";

import type { ReactNode } from "react";
import {
  StatusPill,
  cn,
  queueLegacyStatusStyle,
  type StatusPillStyle,
} from "@platform/design-system";
import {
  RowMoreMenu,
  type RowMoreMenuItem,
} from "../ui/RowMoreMenu";
import { RowAttentionDot } from "../ui/RowAttentionDot";

export type ActiveQueueMobileCardTone = "new" | "pending" | "returned" | "done";

export type ActiveQueueMobileCardMeta = {
  text: string;
  kind?: "po" | "place" | "type" | "plain";
};

export type ActiveQueueMobileCardItem = {
  id: string;
  title: string;
  /** @deprecated prefer `meta` */
  lines?: string[];
  meta?: ActiveQueueMobileCardMeta[];
  statusLabel?: string;
  statusStyle?: StatusPillStyle;
  statusClassName?: string;
  timerLabel?: string;
  timerOverdue?: boolean;
  /** Remaining fraction 0–1 for the SLA bar (HTML timer-bar). */
  timerRatio?: number;
  tone?: ActiveQueueMobileCardTone;
  moreItems: RowMoreMenuItem[];
  onOpen: () => void;
  /** Show open-loading affordance on the title. */
  loading?: boolean;
  /** Outlook-style unread dot next to the title — new / returned / needs action. */
  unread?: boolean;
  /** Optional leading control (e.g. ops checkbox). */
  leading?: ReactNode;
  /** Extra block under the status pill (assignee / due / etc.). */
  footer?: ReactNode;
  /** Expandable panel under the card (failures actions). */
  expandedPanel?: ReactNode;
  expanded?: boolean;
  hideDot?: boolean;
  muted?: boolean;
  shellClassName?: string;
  /** Optional DOM id on the list item (e.g. failure highlight scroll). */
  anchorId?: string;
};

/** Shared visual tokens — brand ink / gold / red (reuse in Failures, Fees, Ops). */
export const queueMobileCardShellClassName = cn(
  "group relative flex w-full min-w-0 max-w-full min-h-[84px] cursor-pointer items-stretch gap-3 overflow-hidden rounded-[14px] border border-border bg-surface px-3.5 py-3.5",
  "shadow-[0_2px_8px_rgba(15,52,96,0.06)]",
  "transition-[box-shadow,border-color,transform,background-color] duration-150",
  "active:scale-[0.992] active:bg-row-hover",
  "hover:border-[color-mix(in_srgb,var(--border)_50%,var(--gold-2))] hover:shadow-[0_8px_24px_rgba(15,52,96,0.1)]",
);

export const queueMobileCardToneBorder: Record<
  ActiveQueueMobileCardTone,
  string
> = {
  new: "border-s-[3px] border-s-ink",
  pending: "border-s-[3px] border-s-gold",
  returned: "border-s-[3px] border-s-red",
  done: "border-s-[3px] border-s-ink",
};

export const queueMobileCardToneDot: Record<ActiveQueueMobileCardTone, string> =
  {
    new: "bg-ink shadow-[0_0_0_3px_color-mix(in_srgb,var(--ink)_14%,transparent)]",
    pending:
      "bg-gold shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)]",
    returned:
      "bg-red shadow-[0_0_0_3px_color-mix(in_srgb,var(--red)_18%,transparent)]",
    done: "bg-ink shadow-[0_0_0_3px_color-mix(in_srgb,var(--ink)_14%,transparent)]",
  };

export const queueMobileCardToneWash: Record<
  ActiveQueueMobileCardTone,
  string
> = {
  new: "bg-[radial-gradient(120%_80%_at_100%_0%,color-mix(in_srgb,var(--ink)_8%,transparent),transparent_55%)]",
  pending:
    "bg-[radial-gradient(120%_80%_at_100%_0%,color-mix(in_srgb,var(--gold)_14%,transparent),transparent_55%)]",
  returned:
    "bg-[radial-gradient(120%_80%_at_100%_0%,color-mix(in_srgb,var(--red)_10%,transparent),transparent_55%)]",
  done: "bg-[radial-gradient(120%_80%_at_100%_0%,color-mix(in_srgb,var(--ink)_6%,transparent),transparent_55%)]",
};

const BAR_TONE: Record<"ok" | "warn" | "late", string> = {
  ok: "bg-ink",
  warn: "bg-gold",
  late: "bg-red",
};

export function toneFromLegacyBadge(
  className: string | undefined,
): ActiveQueueMobileCardTone {
  if (className === "b-done") return "done";
  if (className === "b-prog") return "pending";
  if (className === "b-warn" || className === "b-orange") return "returned";
  return "new";
}

function MetaIcon({ kind }: { kind?: ActiveQueueMobileCardMeta["kind"] }) {
  if (kind === "po") {
    return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </svg>
    );
  }
  if (kind === "place") {
    return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    );
  }
  if (kind === "type") {
    return (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 7h16M4 12h10M4 17h14" />
      </svg>
    );
  }
  return null;
}

function barToneFromRatio(
  overdue: boolean | undefined,
  ratio: number | undefined,
): "ok" | "warn" | "late" {
  if (overdue || ratio === 0) return "late";
  if (ratio == null) return "ok";
  if (ratio < 0.28) return "warn";
  return "ok";
}

export function QueueMobileCardChevron({ expanded }: { expanded?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-7 place-items-center rounded-lg bg-surface-2 text-text-3 transition-transform group-active:bg-gold-soft group-active:text-gold-d",
        expanded && "rotate-90",
      )}
      aria-hidden
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="rtl:rotate-180"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </span>
  );
}

/**
 * Shared mobile card list — elegant language from docs/المعاين/inspector_screen 1.html
 * (accent rail, soft wash, meta icons, SLA timer bar). Brand ink/gold/red.
 */
export function ActiveQueueMobileCards({
  items,
  pending,
  emptyMessage = "لا توجد معاملات مطابقة.",
}: {
  items: ActiveQueueMobileCardItem[];
  pending?: boolean;
  emptyMessage?: string;
}) {
  if (pending && items.length === 0) {
    return (
      <div className="flex flex-col gap-3 px-0.5 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[96px] animate-pulse rounded-[14px] border border-border bg-surface-2"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="m-0 px-2 py-10 text-center text-[13px] text-text-3">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="m-0 flex w-full min-w-0 max-w-full list-none flex-col gap-3 p-0">
      {items.map((item, index) => {
        const tone = item.tone ?? "new";
        const meta: ActiveQueueMobileCardMeta[] =
          item.meta ??
          (item.lines ?? []).filter(Boolean).map((text, i) => ({
            text,
            kind: i === 0 ? "po" : i === 1 ? "place" : "type",
          }));
        const showTimer = Boolean(item.timerLabel);
        const barTone = barToneFromRatio(item.timerOverdue, item.timerRatio);
        const ratio =
          item.timerOverdue || item.timerRatio === 0
            ? 0
            : Math.min(1, Math.max(0, item.timerRatio ?? 0.55));

        return (
          <li
            key={item.id}
            id={item.anchorId}
            className={cn(
              "ui-animate-fade-in w-full min-w-0 max-w-full",
              Boolean(item.expandedPanel) && "overflow-hidden rounded-[14px]",
              item.muted && "opacity-70",
              item.shellClassName,
            )}
            style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
          >
            <div
              role="button"
              tabIndex={0}
              aria-busy={item.loading || undefined}
              className={cn(
                queueMobileCardShellClassName,
                queueMobileCardToneBorder[tone],
                Boolean(item.expandedPanel) &&
                  item.expanded &&
                  "rounded-b-none border-b-0",
                item.loading && "ui-queue-card-opening pointer-events-none",
              )}
              onClick={item.onOpen}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  item.onOpen();
                }
              }}
            >
              <span
                className={cn(
                  "pointer-events-none absolute inset-0 opacity-90",
                  queueMobileCardToneWash[tone],
                )}
                aria-hidden
              />

              {item.leading ? (
                <div
                  className="relative z-[1] flex shrink-0 items-start pt-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {item.leading}
                </div>
              ) : !item.hideDot ? (
                <span
                  className={cn(
                    "relative z-[1] mt-1.5 size-2.5 shrink-0 rounded-full",
                    queueMobileCardToneDot[tone],
                  )}
                  aria-hidden
                />
              ) : null}

              <div className="relative z-[1] min-w-0 flex-1 overflow-hidden">
                <div className="flex items-center gap-1.5 truncate text-[13.5px] font-semibold leading-snug tracking-tight text-heading">
                  {item.unread ? <RowAttentionDot /> : null}
                  <span className="truncate">{item.title}</span>
                </div>
                {item.loading ? (
                  <span className="sr-only" role="status">
                    جاري الفتح
                  </span>
                ) : null}
                {meta.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-text-3">
                    {meta.map((m, i) => (
                      <span
                        key={`${item.id}-m-${i}`}
                        className="inline-flex items-center gap-1"
                        dir={
                          m.kind === "po" || /^\d|PO|WO|صك/i.test(m.text)
                            ? "ltr"
                            : undefined
                        }
                      >
                        <span className="opacity-70">
                          <MetaIcon kind={m.kind} />
                        </span>
                        {m.text}
                      </span>
                    ))}
                  </div>
                ) : null}
                {item.statusLabel ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <StatusPill
                      label={item.statusLabel}
                      style={
                        item.statusStyle ??
                        queueLegacyStatusStyle(item.statusClassName ?? "")
                      }
                    />
                  </div>
                ) : null}
                {item.footer ? (
                  <div className="relative z-[1] mt-2.5">{item.footer}</div>
                ) : null}
              </div>

              {showTimer ? (
                <div className="relative z-[1] flex w-[76px] shrink-0 flex-col items-end justify-center gap-1.5 self-center">
                  {!item.timerOverdue ? (
                    <div className="h-[4px] w-full overflow-hidden rounded-full bg-surface-3">
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-300",
                          BAR_TONE[barTone],
                        )}
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </div>
                  ) : (
                    <div className="h-[4px] w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--red)_18%,transparent)]">
                      <div className="h-full w-full rounded-full bg-red" />
                    </div>
                  )}
                  <span
                    className={cn(
                      "max-w-full truncate text-end text-[10px] font-semibold tabular-nums leading-tight",
                      item.timerOverdue ? "text-danger-text" : "text-text-3",
                    )}
                  >
                    {item.timerLabel}
                  </span>
                </div>
              ) : null}

              <div className="relative z-[1] flex shrink-0 flex-col items-center justify-between gap-2 self-stretch py-0.5">
                {item.moreItems.length > 0 ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <RowMoreMenu items={item.moreItems} />
                  </div>
                ) : (
                  <span className="size-7" aria-hidden />
                )}
                <QueueMobileCardChevron expanded={item.expanded} />
              </div>
            </div>
            {item.expanded && item.expandedPanel ? (
              <div className="border border-t-0 border-border bg-surface px-3.5 pb-3.5 pt-2 shadow-[0_2px_8px_rgba(15,52,96,0.06)] rounded-b-[14px]">
                {item.expandedPanel}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
