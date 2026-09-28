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
import {
  cn,
  formControlClassName,
  formControlErrorClassName,
} from "@platform/ui-kit";
import type {
  FailureProblemType,
  FailureTypeCategory,
} from "../../lib/failure-types-data";

type Group = {
  category: FailureTypeCategory;
  types: FailureProblemType[];
};

const VIEWPORT_MARGIN = 8;
const MENU_GAP = 4;

/** Always open below the trigger; use the remaining viewport so every option is reachable by scroll. */
function placeBelow(trigger: HTMLElement): CSSProperties {
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = rect.left;
  if (left + rect.width > vw - VIEWPORT_MARGIN) {
    left = Math.max(VIEWPORT_MARGIN, vw - rect.width - VIEWPORT_MARGIN);
  }
  const top = rect.bottom + MENU_GAP;
  const maxHeight = Math.max(180, vh - top - VIEWPORT_MARGIN);
  return {
    position: "fixed",
    top,
    left,
    width: rect.width,
    maxHeight,
    zIndex: 1200,
  };
}

/** Portal listbox that always opens below the trigger (scrolls if short on space). */
export function FailureTypeMenuSelect({
  id,
  value,
  onChange,
  groups,
  placeholder,
  disabled = false,
  hasError = false,
  autoFocus = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  groups: Group[];
  placeholder: string;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const flat = groups.flatMap((g) => g.types);
  const selected = flat.find((t) => t.id === value);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    function place() {
      const btn = btnRef.current;
      if (!btn) return;
      setMenuStyle(placeBelow(btn));
    }
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, groups]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    btnRef.current?.focus();
  }

  const menu =
    open && !disabled ? (
      <div
        ref={menuRef}
        id={listId}
        role="listbox"
        aria-labelledby={id}
        className="overflow-y-auto overscroll-contain rounded-[9px] border border-border-md bg-surface py-1 shadow-[0_12px_30px_-8px_rgba(18,40,76,0.3)] [-webkit-overflow-scrolling:touch]"
        style={menuStyle}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {groups.map(({ category, types }) => (
          <div key={category.id} role="group" aria-label={category.label}>
            <div className="sticky top-0 z-[1] bg-surface px-3 py-1.5 text-[11px] font-bold text-text-3">
              {category.label}
            </div>
            {types.map((type) => {
              const active = type.id === value;
              return (
                <button
                  key={type.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "flex w-full cursor-pointer border-none bg-transparent px-3 py-2.5 text-start text-[13px] text-text transition-colors hover:bg-row-hover",
                    active && "bg-surface-2 font-semibold text-heading",
                  )}
                  onClick={() => pick(type.id)}
                >
                  {type.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={btnRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-invalid={hasError || undefined}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn(
          formControlClassName,
          "flex items-center justify-between gap-2 text-start leading-normal",
          hasError && formControlErrorClassName,
          !selected && "text-text-3",
        )}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
      >
        <span className="min-w-0 truncate">
          {selected?.label ?? placeholder}
        </span>
        <i
          className={cn(
            "ti ti-chevron-down shrink-0 text-[14px] text-text-3 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
