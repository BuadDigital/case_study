"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@platform/design-system";

function RecallIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

export function PartyTaskRecallFab({
  onRequestRecall,
  deedNumber,
}: {
  onRequestRecall: () => void;
  deedNumber?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed bottom-7 left-7 z-[200]" dir="rtl">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-[199] cursor-default border-none bg-transparent p-0"
          onClick={() => setOpen(false)}
          aria-label="إغلاق القائمة"
        />
      ) : null}

      <div
        className={cn(
          "absolute bottom-[calc(100%+12px)] left-0 w-[240px] transition-[opacity,transform] duration-150",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-1 opacity-0",
        )}
        role="menu"
        aria-hidden={!open}
      >
        <div className="rounded-xl border border-border-md bg-surface p-1.5 shadow-lg">
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-lg border-none bg-transparent px-2.5 py-2 text-start text-[13px] text-text transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
            onClick={() => {
              setOpen(false);
              onRequestRecall();
            }}
          >
            <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center text-text-2">
              <RecallIcon />
            </span>
            طلب استرجاع المعاملة
          </button>
        </div>
      </div>

      <button
        type="button"
        className={cn(
          "relative z-[201] flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-none bg-primary text-white shadow-[0_4px_16px_rgba(15,42,78,0.35)] transition-[transform,box-shadow] hover:shadow-[0_6px_20px_rgba(15,42,78,0.45)] active:scale-95",
          open && "[&_svg]:rotate-90",
        )}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          open
            ? "إغلاق الإجراءات"
            : `طلب استرجاع المعاملة${deedNumber ? ` — صك ${deedNumber}` : ""}`
        }
      >
        <RecallIcon />
      </button>
    </div>
  );
}
