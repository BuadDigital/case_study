"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@platform/ui-kit";

const TOOLTIP_GAP = 8;
const VIEWPORT_MARGIN = 8;

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
    VIEWPORT_MARGIN,
    Math.min(left, vw - cardWidth - VIEWPORT_MARGIN),
  );

  let top = rect.bottom + TOOLTIP_GAP;
  if (top + cardHeight > vh - VIEWPORT_MARGIN) {
    const above = rect.top - cardHeight - TOOLTIP_GAP;
    if (above >= VIEWPORT_MARGIN) top = above;
  }

  return {
    position: "fixed",
    top,
    left,
    zIndex: 1200,
  };
}

/** Hover card portaled to `document.body` so table overflow cannot clip it (same as /po). */
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
    // passive: المستمع لا يمنع التمرير — يسمح للمتصفح بعدم انتظاره (client-passive-event-listeners).
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
