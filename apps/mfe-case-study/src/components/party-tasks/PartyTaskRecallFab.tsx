"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@platform/design-system";

type FabAction = {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
};

function BoltIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function CloseIcon() {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

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

function actionIcon(path: ReactNode) {
  return (
    <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center text-text-2">
      {path}
    </span>
  );
}

const Icon = {
  plus: actionIcon(
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[17px] w-[17px]">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>,
  ),
  note: actionIcon(
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[17px] w-[17px]">
      <path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5" />
      <path d="M17.5 2.5a2.121 2.121 0 0 1 3 3L12 14l-4 1 1-4 7.5-7.5z" />
    </svg>,
  ),
  recall: actionIcon(<RecallIcon />),
};

export function PartyTaskRecallFab({
  onRequestRecall,
  onAddObstruction,
  onAddNote,
  deedNumber,
}: {
  onRequestRecall: () => void;
  onAddObstruction?: () => void;
  onAddNote?: () => void;
  deedNumber?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const actions = useMemo<FabAction[]>(
    () => [
      ...(onAddObstruction
        ? [
            {
              id: "add-obstruction",
              label: "تسجيل تعذر",
              icon: Icon.plus,
              onSelect: onAddObstruction,
            },
          ]
        : []),
      ...(onAddNote
        ? [
            {
              id: "add-note",
              label: "إضافة ملاحظة",
              icon: Icon.note,
              onSelect: onAddNote,
            },
          ]
        : []),
      {
        id: "request-recall",
        label: "طلب استرجاع المعاملة",
        icon: Icon.recall,
        onSelect: onRequestRecall,
      },
    ],
    [onAddNote, onAddObstruction, onRequestRecall],
  );

  const hasQuickActions = actions.length > 1;

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
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-lg border-none bg-transparent px-2.5 py-2 text-start text-[13px] text-text transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
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
            ? hasQuickActions
              ? "إغلاق الإجراءات السريعة"
              : "إغلاق الإجراءات"
            : hasQuickActions
              ? `إجراءات سريعة${deedNumber ? ` — صك ${deedNumber}` : ""}`
              : `طلب استرجاع المعاملة${deedNumber ? ` — صك ${deedNumber}` : ""}`
        }
      >
        {hasQuickActions ? (open ? <CloseIcon /> : <BoltIcon />) : <RecallIcon />}
      </button>
    </div>
  );
}
