"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@platform/design-system";

export type RowMoreMenuItem = {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};

function KebabIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="8" cy="3.25" r="1.35" />
      <circle cx="8" cy="8" r="1.35" />
      <circle cx="8" cy="12.75" r="1.35" />
    </svg>
  );
}

const moreBtnClass = (open: boolean) =>
  cn(
    "inline-flex h-[30px] w-[30px] items-center justify-center rounded-[var(--radius-DEFAULT)] border border-border bg-surface text-text-2 outline-none transition-colors hover:bg-info-bg hover:border-info hover:text-info-text",
    open && "bg-info-bg border-info text-info-text",
  );

export function RowMoreMenu({
  items,
  ariaLabel = "المزيد",
}: {
  items: RowMoreMenuItem[];
  ariaLabel?: string;
}) {
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;

    function placeMenu() {
      const btn = btnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const menuWidth = menuRef.current?.offsetWidth ?? 176;
      const gap = 4;
      let left = rect.right - menuWidth;
      left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + gap,
        left,
        zIndex: 1200,
        minWidth: "11rem",
      });
    }

    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        wrapRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menu = open ? (
    <div
      ref={menuRef}
      id={menuId}
      className="rounded-lg border border-border bg-surface py-1 shadow-[0_8px_24px_rgba(15,23,42,0.14)]"
      role="menu"
      style={menuStyle}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={cn(
            "block w-full cursor-pointer border-none bg-transparent px-3 py-2 text-start text-xs whitespace-nowrap text-text hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45",
            item.danger && "text-danger-text",
          )}
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            setOpen(false);
            item.onClick();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div
      ref={wrapRef}
      className="relative inline-flex justify-center align-middle"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={btnRef}
        type="button"
        className={moreBtnClass(open)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <KebabIcon />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
