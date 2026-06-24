"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePoListRowsQuery } from "@/lib/query/prototype-queries";
import { useWorkflowTasksQuery } from "@case-study/mfe/query/case-study-queries";
import { isFeatureEnabled } from "@platform/app-shared/feature-flags";
import { cn } from "@platform/design-system";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const { data: poRows = [] } = usePoListRowsQuery();
  const { data: tasks = [] } = useWorkflowTasksQuery();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const poMatches = poRows
      .filter(
        (row) =>
          row.id.toLowerCase().includes(needle) ||
          row.specialist.toLowerCase().includes(needle),
      )
      .slice(0, 5)
      .map((row) => ({
        key: `po-${row.id}`,
        label: `أمر عمل ${row.id}`,
        sub: row.specialist || row.status,
        href: `/po/${encodeURIComponent(row.id)}/property`,
      }));
    const taskMatches = tasks
      .filter(
        (t) =>
          t.poNumber.toLowerCase().includes(needle) ||
          t.title.toLowerCase().includes(needle) ||
          t.id.toLowerCase().includes(needle),
      )
      .slice(0, 5)
      .map((t) => ({
        key: `task-${t.id}`,
        label: t.title || t.poNumber,
        sub: t.assigneeName || t.kind,
        href: `/case-study/${encodeURIComponent(t.id)}`,
      }));
    return [...poMatches, ...taskMatches].slice(0, 8);
  }, [poRows, tasks, q]);

  if (!isFeatureEnabled("globalSearch")) return null;

  return (
    <div ref={rootRef} className="relative hidden max-w-xs flex-1 sm:block lg:max-w-sm">
      <label className="sr-only" htmlFor="global-search">
        بحث في أوامر العمل والمهام
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-text-3">
          <SearchIcon />
        </span>
        <input
          id="global-search"
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="بحث: صك أو أمر عمل…"
          className={cn(
            "h-8 w-full rounded-md border border-border bg-surface-2 pe-3 ps-8 text-xs text-text",
            "placeholder:text-text-3 focus:border-primary focus:outline-none",
          )}
          dir="rtl"
          autoComplete="off"
        />
      </div>
      {open && q.trim() && (
        <div
          className="absolute inset-x-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md border border-border bg-surface shadow-modal"
          role="listbox"
        >
          {results.length === 0 ? (
            <p className="m-0 px-3 py-2.5 text-xs text-text-3">لا توجد نتائج.</p>
          ) : (
            results.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="block border-b border-border px-3 py-2 text-xs no-underline last:border-b-0 hover:bg-surface-2"
                onClick={() => {
                  setOpen(false);
                  setQ("");
                }}
              >
                <div className="font-medium text-text">{item.label}</div>
                <div className="text-text-3">{item.sub}</div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
