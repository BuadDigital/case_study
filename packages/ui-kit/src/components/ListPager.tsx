"use client";

import { useState } from "react";
import { cn } from "../lib/cn";
import { opsPanelCard } from "../lib/ops-chrome";
import { Button } from "./Button";

/**
 * The pager numbers a screen derives from a `PagedResultDto` envelope
 * (`docs/architecture/pagination-contract.md`): `totalCount` / `totalPages`
 * are the server's, the page is clamped into range, and the range label is
 * 1-based and inclusive. Pure, so a screen can reuse it for a client-side
 * window over a whole list.
 */
export function listPagerWindow(input: {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages?: number;
}) {
  const pageSize = input.pageSize > 0 ? input.pageSize : 1;
  const totalPages = Math.max(
    1,
    input.totalPages ?? Math.ceil(input.totalCount / pageSize),
  );
  const safePage = Math.min(Math.max(1, Math.trunc(input.page) || 1), totalPages);
  return {
    totalPages,
    safePage,
    rangeStart: input.totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1,
    rangeEnd: Math.min(safePage * pageSize, input.totalCount),
  };
}

/** «السابق» / «التالي»: a labelled button; 44px tall on a phone, like the page box. */
const PAGER_STEP_BUTTON =
  "h-8 gap-1 px-3 text-[12.5px] font-semibold disabled:opacity-40 max-lg:h-11 max-lg:px-4";

/** A drawn chevron — fixed on screen, unlike ‹ › which Arabic text mirrors. */
function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "right" ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
    </svg>
  );
}

export type ListPagerProps = {
  page: number;
  totalCount: number;
  /** From the envelope when the server paged; derived from the count otherwise. */
  totalPages?: number;
  /**
   * Rows per page. Either pass it, or pass a precomputed `rangeStart` /
   * `rangeEnd` (the `listPagerWindow` output) — a screen that already cut its
   * window spreads that object straight in.
   */
  pageSize?: number;
  rangeStart?: number;
  rangeEnd?: number;
  onPageChange: (page: number) => void;
  /** Shows «—» for the range while the first page is still loading. */
  pending?: boolean;
  /** The inverse signal: `ready={false}` is the same as `pending`. */
  ready?: boolean;
  /** The counted noun after the total (e.g. "معاملة", "طرف"). @default "نتيجة" */
  unit?: string;
  className?: string;
};

/**
 * The shared list pager: the range and total («عرض 1–25 من 2,480 معاملة»), a
 * type-to-jump «صفحة [ N ] من M» field, and «السابق» / «التالي» — no numbered
 * page-number strip (docs/new-look decision, option B). The finance journeys
 * assert against its button names «الصفحة السابقة» / «الصفحة التالية».
 */
export function ListPager({
  page,
  pageSize,
  totalCount,
  totalPages,
  rangeStart,
  rangeEnd,
  onPageChange,
  pending = false,
  ready,
  unit = "نتيجة",
  className,
}: ListPagerProps) {
  // Without an explicit page size, recover it from the envelope so the
  // numbered pages still line up with the server's `totalPages`.
  const effectivePageSize =
    pageSize ??
    (totalPages && totalPages > 0
      ? Math.max(1, Math.ceil(totalCount / totalPages))
      : Math.max(1, totalCount));
  const win = listPagerWindow({
    page,
    pageSize: effectivePageSize,
    totalCount,
    totalPages,
  });
  const start = rangeStart ?? win.rangeStart;
  const end = rangeEnd ?? win.rangeEnd;
  const waiting = pending || ready === false;

  // The box mirrors the active page; syncing during render keeps it from showing
  // the previous number for one paint after the page changes elsewhere.
  const [pageDraft, setPageDraft] = useState(String(win.safePage));
  const [draftForPage, setDraftForPage] = useState(win.safePage);
  if (draftForPage !== win.safePage) {
    setDraftForPage(win.safePage);
    setPageDraft(String(win.safePage));
  }

  function commitPageDraft() {
    const n = Math.trunc(Number(pageDraft));
    if (Number.isFinite(n) && n >= 1 && n <= win.totalPages && n !== win.safePage) {
      onPageChange(n);
    } else {
      setPageDraft(String(win.safePage));
    }
  }

  return (
    // A bar in the table frame's own look (2026-11-15): the count on one side, the page controls on
    // the other — «السابق» / «التالي» with drawn chevrons (the ‹ › characters flip in Arabic text and
    // pointed the wrong way), and the type-to-jump page box between them.
    <nav
      aria-label="التنقل بين الصفحات"
      className={cn(
        opsPanelCard,
        "mt-3 flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-4 py-2.5",
        className,
      )}
    >
      <span className="text-[12.5px] text-text-3">
        {waiting ? (
          "—"
        ) : (
          <>
            عرض{" "}
            {/* LTR, so «1–25» does not read «25–1» inside the Arabic line. */}
            <bdi dir="ltr" className="font-bold text-heading tabular-nums">
              {start}–{end}
            </bdi>{" "}
            من{" "}
            <b className="font-bold text-heading tabular-nums">
              {totalCount.toLocaleString("en-US")}
            </b>{" "}
            {unit}
          </>
        )}
      </span>
      <div className="flex items-center gap-2 max-lg:w-full max-lg:justify-between">
        <Button
          type="button"
          size="sm"
          variant="default"
          className={PAGER_STEP_BUTTON}
          disabled={win.safePage <= 1}
          onClick={() => onPageChange(win.safePage - 1)}
          aria-label="الصفحة السابقة"
          showActionToast={false}
        >
          <Chevron direction="right" />
          السابق
        </Button>
        <span className="flex items-center gap-1.5 text-[12.5px] text-text-3">
          صفحة
          <input
            type="text"
            inputMode="numeric"
            aria-label="رقم الصفحة"
            className="h-8 w-11 rounded-[9px] border border-border-md bg-surface text-center text-[13px] font-semibold text-heading tabular-nums outline-none transition-[border-color,box-shadow] focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-55 max-lg:h-11"
            value={pageDraft}
            disabled={waiting}
            onChange={(e) => setPageDraft(e.target.value.replace(/\D/g, ""))}
            onBlur={commitPageDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitPageDraft();
              }
            }}
          />
          <span className="tabular-nums">من {win.totalPages.toLocaleString("en-US")}</span>
        </span>
        <Button
          type="button"
          size="sm"
          variant="default"
          className={PAGER_STEP_BUTTON}
          disabled={win.safePage >= win.totalPages}
          onClick={() => onPageChange(win.safePage + 1)}
          aria-label="الصفحة التالية"
          showActionToast={false}
        >
          التالي
          <Chevron direction="left" />
        </Button>
      </div>
    </nav>
  );
}
