import { cn } from "../lib/cn";
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

/** Page numbers to show: every page up to 7, else first / last / the current ±1. */
function visiblePages(totalPages: number, safePage: number): number[] {
  return Array.from({ length: totalPages }, (_, i) => i + 1).filter((n) => {
    if (totalPages <= 7) return true;
    if (n === 1 || n === totalPages) return true;
    return Math.abs(n - safePage) <= 1;
  });
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
  className?: string;
};

/**
 * The shared list pager: the range label «عرض X–Y من N نتيجة», previous / next
 * buttons («الصفحة السابقة» / «الصفحة التالية») and the numbered pages with
 * `aria-current="page"` on the current one — the markup the PO list renders
 * and the finance journeys assert against.
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

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 py-3",
        className,
      )}
    >
      <span className="text-[13px] text-text-3">
        {waiting ? (
          "—"
        ) : (
          <>
            عرض{" "}
            <b className="font-bold text-heading">
              {start}–{end}
            </b>{" "}
            من <b className="font-bold text-heading">{totalCount}</b> نتيجة
          </>
        )}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-[30px] w-[30px] p-0 disabled:opacity-40"
          disabled={win.safePage <= 1}
          onClick={() => onPageChange(win.safePage - 1)}
          aria-label="الصفحة السابقة"
          showActionToast={false}
        >
          ‹
        </Button>
        {visiblePages(win.totalPages, win.safePage).map((n, idx, arr) => {
          const prev = arr[idx - 1];
          const showGap = prev != null && n - prev > 1;
          return (
            <span key={n} className="contents">
              {showGap ? (
                <span className="px-1 text-[12px] text-text-3">…</span>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant={n === win.safePage ? "primary" : "default"}
                className="h-[30px] min-w-[30px] px-1.5"
                aria-current={n === win.safePage ? "page" : undefined}
                onClick={() => onPageChange(n)}
                showActionToast={false}
              >
                {n}
              </Button>
            </span>
          );
        })}
        <Button
          type="button"
          size="sm"
          variant="default"
          className="h-[30px] w-[30px] p-0 disabled:opacity-40"
          disabled={win.safePage >= win.totalPages}
          onClick={() => onPageChange(win.safePage + 1)}
          aria-label="الصفحة التالية"
          showActionToast={false}
        >
          ›
        </Button>
      </div>
    </div>
  );
}
