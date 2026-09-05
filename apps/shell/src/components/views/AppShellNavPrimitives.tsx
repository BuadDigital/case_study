"use client";

/** Sidebar/topbar building blocks: icons, class recipes, pending spinner, chevron, flyout. */
import { useLinkStatus } from "next/link";
import { cn, Spinner } from "@platform/ui-kit";

export function TopbarSvgIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex size-5 shrink-0 items-center justify-center [&_svg]:size-5">
      {children}
    </span>
  );
}

export function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

/** Design ref: topbar toggle — collapsed icon-rail sidebar. */
export function SidebarPanelsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4v16" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export const mobileTopbarIconBtn =
  "flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface text-text shadow-[0_1px_2px_rgba(15,52,96,0.06)] transition-colors hover:bg-surface-2 active:scale-[0.98] lg:hidden";

export const topbarActionIconBtn =
  "flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface text-text shadow-[0_1px_2px_rgba(15,52,96,0.06)] transition-colors hover:bg-surface-2 active:scale-[0.98]";

/** Sidebar group heading; hidden in the desktop icon rail. */
export function navGroupLabelClasses(rail = false) {
  return cn(
    "px-3 pb-1.5 pt-2 text-[11px] font-bold tracking-[0.03em] text-[#6f7b90]",
    rail && "lg:hidden",
  );
}

/** Thin separator that stands in for a group heading in the icon rail. */
export function NavRailSeparator() {
  return (
    <div className="mx-auto my-1.5 hidden h-px w-6 bg-white/10 lg:block" aria-hidden />
  );
}

export function navItemClasses({
  active = false,
  sub = false,
  locked = false,
  toggle = false,
  rail = false,
}: {
  active?: boolean;
  sub?: boolean;
  locked?: boolean;
  toggle?: boolean;
  /** Desktop icon-rail mode (labels hidden via group on #sidebar). */
  rail?: boolean;
} = {}) {
  return cn(
    "relative flex cursor-pointer items-center gap-[11px] rounded-lg px-3 py-[9px] text-[13.5px] font-medium text-[#aeb6c4] no-underline outline-none transition-[background,color] duration-150",
    "hover:bg-white/[0.06] hover:text-white",
    "[&>svg]:size-[18px] [&>svg]:shrink-0",
    sub && "gap-[9px] ps-8 text-[12.5px] [&>svg]:size-3.5",
    toggle && "w-full border-0 bg-transparent font-inherit",
    rail &&
      "lg:justify-center lg:gap-0 lg:px-0 lg:py-2.5 lg:before:hidden",
    rail && sub && "lg:ps-0",
    active &&
      "bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] font-bold text-gold-2 before:absolute before:inset-y-0 before:start-0 before:w-[3px] before:rounded-e-sm before:bg-gold before:content-['']",
    locked && "cursor-default opacity-35",
  );
}

export function navBadgeClasses(rail = false) {
  return cn(
    "ms-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-danger px-[5px] text-[10px] font-semibold text-white",
    rail &&
      "lg:absolute lg:end-0.5 lg:top-0.5 lg:ms-0 lg:h-[16px] lg:min-w-[16px] lg:px-[4px] lg:text-[9px]",
  );
}

export function navLabelClasses(rail = false) {
  return cn(rail && "lg:sr-only");
}

export function navChevronClasses(rail = false) {
  return cn(rail && "lg:hidden");
}

/**
 * Instant click feedback: navigation used to stay silent until the next page
 * mounted, so the tap looked ignored. Replaces the badge while pending so the row does not grow.
 */
export function NavPending({ fallback = null }: { fallback?: React.ReactNode }) {
  const { pending } = useLinkStatus();
  if (!pending) return fallback;
  return (
    <span className="ms-auto inline-flex items-center" aria-label="جاري التحميل">
      <Spinner />
    </span>
  );
}

export function NavDropdownChevron({ open, rail = false }: { open: boolean; rail?: boolean }) {
  return (
    <span
      className={cn(
        "ms-auto inline-flex shrink-0 opacity-45 transition-transform duration-200 ease-in-out",
        open && "-rotate-90 opacity-70",
        navChevronClasses(rail),
      )}
      aria-hidden
    >
      <svg
        className="size-[18px]"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </span>
  );
}

export function NavFlyoutPanel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute end-full top-0 z-[60] me-2 hidden min-w-[210px] rounded-[10px] border border-white/[0.1] bg-sidebar p-2 shadow-lg lg:block"
      role="group"
      aria-label={label}
    >
      <div className="px-2.5 pb-1.5 pt-1 text-[11px] font-bold tracking-[0.03em] text-[#6f7b90]">
        {label}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}
