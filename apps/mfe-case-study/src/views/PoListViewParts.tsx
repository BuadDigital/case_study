"use client";

/**
 * Presentational pieces of `PoListView` — the portal hover card, the team
 * avatar stack, the status pill, and the toolbar/empty-state icons. No queries
 * and no writes; rules live in `po-list-view-state.ts`.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { PoRow } from "@platform/app-shared/app-data/constants";
import { poListStatusMeta } from "@platform/app-shared/app-data/po-list-status";
import { cn, StatusPill } from "@platform/ui-kit";
import {
  poStatusStyle,
  TEAM_COLORS,
  teamInitial,
} from "./po-list-view-state";

const PO_TOOLTIP_GAP = 8;
const PO_TOOLTIP_VIEWPORT_MARGIN = 8;

function computeHoverCardStyle(
  trigger: HTMLElement,
  card: HTMLElement,
  align: "start" | "end" = "start",
): CSSProperties {
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardWidth = card.offsetWidth;
  const cardHeight = card.offsetHeight;

  let left = align === "end" ? rect.right - cardWidth : rect.left;
  left = Math.max(
    PO_TOOLTIP_VIEWPORT_MARGIN,
    Math.min(left, vw - cardWidth - PO_TOOLTIP_VIEWPORT_MARGIN),
  );

  let top = rect.bottom + PO_TOOLTIP_GAP;
  if (top + cardHeight > vh - PO_TOOLTIP_VIEWPORT_MARGIN) {
    const above = rect.top - cardHeight - PO_TOOLTIP_GAP;
    if (above >= PO_TOOLTIP_VIEWPORT_MARGIN) top = above;
  }

  return {
    position: "fixed",
    top,
    left,
    zIndex: 1200,
  };
}

export function HoverPortalCard({
  children,
  content,
  align = "start",
  panelClassName,
  triggerClassName,
}: {
  children: ReactNode;
  content: ReactNode;
  align?: "start" | "end";
  panelClassName: string;
  triggerClassName?: string;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [cardStyle, setCardStyle] = useState<CSSProperties>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !cardRef.current) return;

    let raf = 0;
    const placeCard = () => {
      if (!triggerRef.current || !cardRef.current) return;
      setCardStyle(
        computeHoverCardStyle(triggerRef.current, cardRef.current, align),
      );
    };

    placeCard();
    raf = requestAnimationFrame(placeCard);
    window.addEventListener("resize", placeCard);
    // passive: listener does not block scroll — lets the browser skip waiting on it (client-passive-event-listeners).
    window.addEventListener("scroll", placeCard, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", placeCard);
      window.removeEventListener("scroll", placeCard, { capture: true });
    };
  }, [align, content, open]);

  const card = open ? (
    <div
      ref={cardRef}
      className={panelClassName}
      style={cardStyle}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {content}
    </div>
  ) : null;

  return (
    <>
      <span
        ref={triggerRef}
        className={cn("inline-block w-fit", triggerClassName)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </span>
      {mounted && card ? createPortal(card, document.body) : null}
    </>
  );
}

export function TeamStack({ members }: { members: string[] }) {
  if (members.length === 0) {
    return <span className="font-normal text-text-3">—</span>;
  }
  const shown = members.slice(0, 3);
  const extra = members.length - shown.length;
  return (
    <HoverPortalCard
      align="end"
      panelClassName="min-w-[190px] rounded-[10px] border border-border-md bg-surface p-2 shadow-[0_8px_24px_-8px_rgba(18,40,76,.28)]"
      content={
        <>
          <div className="px-2 pb-1.5 pt-0.5 text-[11px] font-bold text-text-3">
            فريق المعاملة ({members.length})
          </div>
          {members.map((name, i) => (
            <div
              key={`pop-${name}-${i}`}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
            >
              <span
                className="grid size-[26px] shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                style={{ backgroundColor: TEAM_COLORS[i % TEAM_COLORS.length] }}
              >
                {teamInitial(name)}
              </span>
              <span className="whitespace-nowrap text-[13px] font-semibold text-heading">
                {name}
              </span>
            </div>
          ))}
        </>
      }
    >
      <span className="inline-flex w-fit items-center">
      {shown.map((name, i) => (
        <span
          key={`${name}-${i}`}
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full border-2 border-surface text-[11px] font-bold text-white",
            i > 0 && "-ms-2",
          )}
          style={{ backgroundColor: TEAM_COLORS[i % TEAM_COLORS.length] }}
          title={name}
        >
          {teamInitial(name)}
        </span>
      ))}
      {extra > 0 ? (
        <span className="-ms-2 grid size-7 shrink-0 place-items-center rounded-full border-2 border-surface bg-surface-2 text-[11px] font-bold text-heading">
          +{extra}
        </span>
      ) : null}
      </span>
    </HoverPortalCard>
  );
}

export function PoStatusPill({ status }: { status: PoRow["status"] }) {
  const { label } = poListStatusMeta(status);
  return <StatusPill label={label} style={poStatusStyle(status)} />;
}

export function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SortIcon() {
  return (
    <svg
      className="ms-0.5 opacity-70"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
    </svg>
  );
}

export function InboxIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M4 4h16v12H4zM4 12l4 4h8l4-4" />
    </svg>
  );
}
