"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@platform/ui-kit";
import type { PageId } from "@platform/types";
import { ThemeSwitch } from "@/components/views/ThemeSwitch";
import { ChevronDownIcon, LogoutIcon } from "./AppShellNavPrimitives";

export function ProfileMenu({
  chipName,
  initials,
  dept,
  currentPage,
  onLogout,
}: {
  chipName: string;
  initials: string;
  dept: string;
  currentPage: PageId;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const inMenuSection = currentPage === "profile";

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const avatar = (
    <div
      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-[color-mix(in_srgb,var(--gold)_16%,var(--surface))] text-[13px] font-bold text-gold-d"
      id="uav"
    >
      {initials || "—"}
    </div>
  );

  const identity = (
    <div className="hidden min-w-0 sm:block">
      <div
        className="truncate text-[13px] font-bold leading-[1.25] text-heading"
        id="uname"
      >
        {chipName}
      </div>
      <div className="truncate text-[11px] text-text-3" id="udept">
        {dept}
      </div>
    </div>
  );

  return (
    <div className="relative flex items-center" ref={panelRef}>
      <Link
        href="/profile"
        className={cn(
          "flex items-center gap-2.5 rounded-lg py-1 pe-2 ps-2.5 no-underline transition-colors",
          "max-lg:min-h-11 max-lg:ps-1.5",
          "hover:bg-surface-2",
          inMenuSection && "bg-surface-2",
        )}
        aria-label="البروفايل"
        aria-current={inMenuSection ? "page" : undefined}
      >
        {avatar}
        {identity}
      </Link>
      <button
        type="button"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg text-text-3 transition-colors",
          "max-lg:size-11",
          "hover:bg-surface-2 hover:text-text",
          open && "bg-surface-2 text-text",
        )}
        aria-label="قائمة الحساب"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={cn("inline-flex transition-transform", open && "rotate-180")}
          aria-hidden
        >
          <ChevronDownIcon className="size-3.5" />
        </span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-label="إغلاق القائمة"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute end-0 top-[calc(100%+6px)] z-50 w-64 overflow-hidden rounded-md border border-border bg-surface shadow-modal max-lg:fixed max-lg:inset-x-3 max-lg:bottom-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:top-auto max-lg:w-auto max-lg:rounded-[14px]"
            role="menu"
            aria-label="قائمة الحساب"
          >
            <div className="border-b border-border px-3 py-2.5">
              <div className="truncate text-sm font-semibold text-text">
                {chipName}
              </div>
              <div className="truncate text-[11px] text-text-3">{dept}</div>
            </div>
            <div>
              <ThemeSwitch />
            </div>
            <div className="border-t border-border p-1.5">
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-semibold text-danger-text transition-colors hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)] max-lg:min-h-11 [&>svg]:size-4 [&>svg]:shrink-0"
                onPointerDown={(e) => {
                  // Keep the menu item click from racing the outside-dismiss listener.
                  e.stopPropagation();
                }}
                onClick={() => {
                  setOpen(false);
                  void onLogout();
                }}
                data-no-action-toast
              >
                <LogoutIcon />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
