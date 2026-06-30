"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@platform/design-system";

type QuickAction = {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  dimmed?: boolean;
};

export type QuickActionsFabProps = {
  deedNumber?: string;
  placement?: "top-start" | "bottom-start";
  onAddObstruction?: () => void;
  onAddNote?: () => void;
  onStartSurvey?: () => void;
  onRequestRecall?: () => void;
  /** Shaded — click still runs handler (parent shows reason). */
  startSurveyDimmed?: boolean;
  workActionsDimmed?: boolean;
  recallDimmed?: boolean;
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
  survey: actionIcon(
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[17px] w-[17px]">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>,
  ),
  recall: actionIcon(
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[17px] w-[17px]">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>,
  ),
};

export function QuickActionsFab({
  deedNumber,
  placement = "bottom-start",
  onAddObstruction,
  onAddNote,
  onStartSurvey,
  onRequestRecall,
  startSurveyDimmed = false,
  workActionsDimmed = false,
  recallDimmed = false,
}: QuickActionsFabProps) {
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

  const actions: QuickAction[] = [
    {
      id: "start-survey",
      label: "ابدأ الرفع المساحي",
      icon: Icon.survey,
      onSelect: onStartSurvey ?? (() => {}),
      dimmed: startSurveyDimmed,
    },
    {
      id: "add-obstruction",
      label: "إضافة تعذر",
      icon: Icon.plus,
      onSelect: onAddObstruction ?? (() => {}),
      dimmed: workActionsDimmed,
    },
    {
      id: "add-note",
      label: "إضافة ملاحظة",
      icon: Icon.note,
      onSelect: onAddNote ?? (() => {}),
      dimmed: workActionsDimmed,
    },
    {
      id: "request-recall",
      label: "طلب استرجاع المعاملة",
      icon: Icon.recall,
      onSelect: onRequestRecall ?? (() => {}),
      dimmed: recallDimmed,
    },
  ];

  const anchorClass =
    placement === "top-start"
      ? "fixed left-5 top-[4.75rem] z-[200]"
      : "fixed bottom-7 left-7 z-[200]";

  const menuPositionClass =
    placement === "top-start"
      ? "top-[calc(100%+12px)]"
      : "bottom-[calc(100%+12px)]";

  return (
    <div ref={containerRef} className={cn(anchorClass)} dir="rtl">
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
          "absolute left-0 z-[202] flex w-[240px] flex-col transition-[opacity,transform] duration-150",
          menuPositionClass,
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
              aria-disabled={action.dimmed}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border-none bg-transparent px-2.5 py-2 text-start text-[13px] transition-colors focus-visible:outline-none",
                action.dimmed
                  ? "cursor-pointer text-text-3 opacity-45"
                  : "cursor-pointer text-text hover:bg-surface-2 focus-visible:bg-surface-2",
              )}
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
            ? "إغلاق الإجراءات السريعة"
            : `إجراءات سريعة${deedNumber ? ` — صك ${deedNumber}` : ""}`
        }
      >
        {open ? <CloseIcon /> : <BoltIcon />}
      </button>
    </div>
  );
}
