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

const VIEWPORT_MARGIN = 8;
const MENU_GAP = 4;
const MENU_MIN_WIDTH_PX = 176;
const MENU_MAX_WIDTH_PX = 320;

function computeMenuStyle(
  btn: HTMLElement,
  menu: HTMLElement,
): CSSProperties {
  const rect = btn.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxWidth = Math.min(MENU_MAX_WIDTH_PX, vw - VIEWPORT_MARGIN * 2);
  const menuWidth = Math.min(
    Math.max(menu.offsetWidth, MENU_MIN_WIDTH_PX),
    maxWidth,
  );
  const menuHeight = menu.offsetHeight;

  let left = rect.right - menuWidth;
  if (left < VIEWPORT_MARGIN) left = rect.left;
  if (left + menuWidth > vw - VIEWPORT_MARGIN) {
    left = vw - menuWidth - VIEWPORT_MARGIN;
  }
  left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(left, vw - menuWidth - VIEWPORT_MARGIN),
  );

  let top = rect.bottom + MENU_GAP;
  if (menuHeight > 0 && top + menuHeight > vh - VIEWPORT_MARGIN) {
    const above = rect.top - menuHeight - MENU_GAP;
    if (above >= VIEWPORT_MARGIN) top = above;
  }

  return {
    position: "fixed",
    top,
    left,
    zIndex: 1200,
    minWidth: "11rem",
    maxWidth: `${maxWidth}px`,
    width: "max-content",
  };
}

const moreBtnClass = (open: boolean) =>
  cn(
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent bg-transparent text-text-2 outline-none transition-colors hover:border-border-md hover:bg-surface-2 hover:text-heading",
    open && "border-border-md bg-surface-2 text-heading",
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
    let raf = 0;
    function placeMenu() {
      const btn = btnRef.current;
      const menu = menuRef.current;
      if (!btn || !menu) return;
      setMenuStyle(computeMenuStyle(btn, menu));
    }
    placeMenu();
    raf = requestAnimationFrame(placeMenu);
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [open, items.length]);

  useEffect(() => {
    if (!open) setMenuStyle({});
  }, [open]);

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
      className="w-max max-w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-border bg-surface py-1 shadow-[0_8px_24px_rgba(15,23,42,0.14)]"
      role="menu"
      data-no-action-toast
      style={menuStyle}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={cn(
            "block w-full min-w-0 cursor-pointer border-none bg-transparent px-3 py-2 text-start text-xs whitespace-nowrap text-text hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-45",
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
