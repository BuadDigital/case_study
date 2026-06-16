"use client";

import Link from "next/link";
import { cn } from "@platform/design-system";

function EyeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const eyeBtnClass = (active?: boolean) =>
  cn(
    "inline-flex h-[30px] w-[30px] items-center justify-center rounded-[var(--radius-DEFAULT)] border border-border bg-surface text-text-2 outline-none transition-colors hover:bg-info-bg hover:border-info hover:text-info-text",
    active && "bg-info-bg border-info text-info-text",
  );

export function EyeIconButton({
  href,
  active,
  label,
  onClick,
}: {
  href?: string;
  active?: boolean;
  label: string;
  onClick?: () => void;
}) {
  const className = eyeBtnClass(active);

  if (href) {
    return (
      <Link
        href={href}
        className={className}
        aria-label={label}
        title={label}
      >
        <EyeIcon />
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
    >
      <EyeIcon />
    </button>
  );
}
