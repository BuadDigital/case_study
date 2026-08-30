"use client";

import type { ReactNode } from "react";
import {
  EmptyIconSearch,
  EmptyState,
  StatusPill,
  cn,
  statusPillStyleFromColor,
} from "@platform/ui-kit";

export function KeysBackLink({
  onClick,
  children = "محفظة المفاتيح",
}: {
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2 inline-flex cursor-pointer items-center gap-[7px] border-none bg-transparent p-0 py-1.5 text-[12.5px] font-semibold text-text-2 transition-colors hover:text-gold-d"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="-scale-x-100"
        aria-hidden
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      <span>{children}</span>
    </button>
  );
}

export function KeysStatusPill({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return <StatusPill label={label} style={statusPillStyleFromColor(color)} />;
}

export function KeysTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "-mb-px cursor-pointer border-b-2 bg-transparent px-[15px] py-2.5 font-[inherit] text-[13px] font-semibold transition-[color,border-color]",
              on
                ? "border-gold text-gold-d"
                : "border-transparent text-text-2 hover:text-heading",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <span className="ms-[5px] inline-flex rounded-full border border-border-md bg-surface-2 px-[7px] py-px text-[11px] text-text-3">
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function KeysEmpty({
  title,
  sub,
}: {
  title: string;
  sub: string;
}) {
  return (
    <EmptyState panel line={title} hint={sub}>
      <EmptyIconSearch />
    </EmptyState>
  );
}

export function KeysPpCell({
  label,
  children,
  first,
}: {
  label: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-2.5 min-w-0 flex-1 px-[18px]",
        first
          ? "border-s-0 ps-0"
          : "border-s border-border max-lg:border-s-0 max-lg:px-2",
      )}
    >
      <div className="mb-[3px] text-[11px] text-text-3">{label}</div>
      <div className="min-h-[22px] text-[13.5px] font-semibold text-heading">
        {children}
      </div>
    </div>
  );
}
