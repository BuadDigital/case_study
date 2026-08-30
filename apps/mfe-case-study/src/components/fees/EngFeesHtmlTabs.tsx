"use client";

import type { ReactNode } from "react";
import { cn } from "@platform/ui-kit";
import {
  opsIconBoxGold,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  opsPpBadge,
  opsTfSeg,
  opsTfSegActive,
  opsTfSegRow,
} from "../../lib/prototype/ops-tasks-tw";

const FOLDER_ICON =
  "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z";

function OpsIcon({ path, size = 18 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

/** Segment tabs — same control language as FailureTypes / CaseStudyInfoRoles. */
export function EngFeesHtmlTabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: {
    id: string;
    label: string;
    count?: number;
    /** When active and count > 0, count uses dispute red ("action required"). */
    countWarnWhenActive?: boolean;
  }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(opsTfSegRow, "mb-3.5 flex-wrap gap-0", className)}
      role="tablist"
    >
      {tabs.map((tab) => {
        const on = active === tab.id;
        const count = tab.count;
        const warn =
          on && tab.countWarnWhenActive && typeof count === "number" && count > 0;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.id)}
            className={on ? opsTfSegActive : opsTfSeg}
          >
            {tab.label}
            {typeof count === "number" ? (
              <span
                className={cn(
                  "ms-1.5 text-[11px] tabular-nums",
                  warn ? "text-[#ffc9bc]" : on ? "text-white/80" : "text-text-3",
                )}
              >
                ({count})
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Section chrome matching FailureTypes letter heads. */
export function EngFeesSectionTitle({
  title,
  sub,
  count,
  className,
}: {
  title: string;
  sub: ReactNode;
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3.5 flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-[11px]">
        <span className={opsIconBoxGold}>
          <OpsIcon path={FOLDER_ICON} />
        </span>
        <div className="min-w-0">
          <div className={opsLetterTitle}>{title}</div>
          <div className={opsLetterSub}>{sub}</div>
        </div>
      </div>
      {typeof count === "number" ? (
        <span className={opsPpBadge}>{count}</span>
      ) : null}
    </div>
  );
}

/** Letter card shell for fee tables / panels. */
export function EngFeesLetterCard({
  title,
  sub,
  count,
  children,
  className,
  toolbar,
}: {
  title?: string;
  sub?: ReactNode;
  count?: number;
  children: ReactNode;
  className?: string;
  toolbar?: ReactNode;
}) {
  return (
    <section className={cn(opsLetterCard, className)}>
      {title ? (
        <div className={opsLetterHead}>
          <div className="flex min-w-0 items-center gap-[11px]">
            <span className={opsIconBoxGold}>
              <OpsIcon path={FOLDER_ICON} />
            </span>
            <div className="min-w-0">
              <div className={opsLetterTitle}>{title}</div>
              {sub ? <div className={opsLetterSub}>{sub}</div> : null}
            </div>
          </div>
          {typeof count === "number" ? (
            <span className={opsPpBadge}>{count}</span>
          ) : null}
        </div>
      ) : null}
      {toolbar ? (
        <div className="border-b border-border px-4 py-3 sm:px-[18px]">
          {toolbar}
        </div>
      ) : null}
      <div className={title || toolbar ? undefined : "contents"}>{children}</div>
    </section>
  );
}
