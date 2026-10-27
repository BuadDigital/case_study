"use client";

/**
 * Company-wide comparable bank CRUD. Selection / adopt into a valuation request
 * lives on the appraiser workspace (Comparables tab). The intake form and the
 * quality-tag editor are siblings; pure rules live in
 * `comparable-properties-state.ts`.
 */

import { fmtSar } from "@platform/app-shared/format/number";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  deactivateComparableProperty,
  listComparablePropertiesPage,
  reactivateComparableProperty,
  type ComparablePropertyDto,
} from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import {
  cn,
  EmptyState,
  InlineLoadingSkeleton,
  OpsIcon,
  PageShell,
  useSwapAnimation,
  useToast,
} from "@platform/ui-kit";
import {
  opsBtnGhost,
  opsBtnPrimary,
  opsFld,
  opsFldControl,
  opsIconBoxGold,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  opsPpBadge,
  opsTfLbl,
  opsToolbar,
} from "../lib/comparables-ops-tw";
import { BANK_ICON } from "./ComparablesOpsIcon";
import { AddComparableForm } from "./AddComparableForm";
import { TagEditorRow } from "./TagEditorRow";
import {
  comparableDeactivateBtn,
  comparableReactivateBtn,
  comparableSourceText,
  comparableStatusPills,
} from "./comparable-row-parts";
import {
  ComparableBankPhoneList,
  ComparableBankPhoneToolbar,
} from "./ComparablePropertiesPhone";

/**
 * Company-wide comparable bank CRUD.
 * Selection / adopt into a valuation request lives on the appraiser workspace (Comparables tab).
 */
/** Rows per server page — the screen used to take one truncated 100-row slab. */
const BANK_PAGE_SIZE = 25;

export function ComparablePropertiesView() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<ComparablePropertyDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const requestSeqRef = useRef(0);
  // Which page / «show inactive» set the rows on screen belong to — set with the
  // rows, so the swap fade plays when they land (not on reloads, not per keystroke).
  // Starts at the first set, so the initial load does not fade.
  const [shownSetKey, setShownSetKey] = useState(`${showInactive}|${page}`);
  const listRef = useRef<HTMLDivElement>(null);
  useSwapAnimation(listRef, shownSetKey);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 280);
    return () => clearTimeout(t);
  }, [q]);

  // A new search or a toggled «show inactive» is a different result set — page 3
  // of the old one is not page 3 of the new one. Adjusted during render so the
  // table never paints the stale page first.
  const resultSetKey = `${debouncedQ}|${showInactive}`;
  const [pagedResultSet, setPagedResultSet] = useState(resultSetKey);
  if (pagedResultSet !== resultSetKey) {
    setPagedResultSet(resultSetKey);
    setPage(1);
  }

  /**
   * One server page (pagination-contract). The bank used to arrive as a
   * single `take: 100` slab that silently dropped row 101 onwards; `totalCount`
   * is now the real size of the filtered bank.
   */
  const reload = useCallback(async () => {
    const config = apiConfig();
    if (!config) {
      setLoading(false);
      setError("يلزم تسجيل الدخول");
      return;
    }
    const seq = ++requestSeqRef.current;
    setLoading(true);
    const res = await listComparablePropertiesPage(config, {
      q: debouncedQ || undefined,
      includeInactive: showInactive,
      page,
      pageSize: BANK_PAGE_SIZE,
    });
    if (seq !== requestSeqRef.current) return;
    setLoading(false);
    if (!res.ok) {
      setError("تعذّر تحميل بنك المقارنات");
      return;
    }
    setError(null);
    setRows(res.data.items);
    setShownSetKey(`${showInactive}|${page}`);
    setTotalCount(res.data.totalCount);
    setTotalPages(Math.max(1, res.data.totalPages));
  }, [debouncedQ, showInactive, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- server fetch: reload() is shared with the retry/refresh handlers and flips loading/error before its first await
    void reload();
  }, [reload]);

  async function onDeactivate(id: string) {
    const config = apiConfig();
    if (!config) return;
    const res = await deactivateComparableProperty(config, id);
    if (!res.ok) {
      showToast("تعذّر التعطيل", "error");
      return;
    }
    showToast(
      "عُطّل المقارن (بدون حذف) — فعّل «إظهار المعطّلة» لمراجعته",
      "success",
    );
    await reload();
  }

  async function onReactivate(id: string) {
    const config = apiConfig();
    if (!config) return;
    const res = await reactivateComparableProperty(config, id);
    if (!res.ok) {
      showToast("تعذّر التفعيل", "error");
      return;
    }
    showToast("أُعيد تفعيل المقارن", "success");
    await reload();
  }

  // Page-local, so the active/inactive split is only exact on a single page.
  const inactiveCount = rows.filter((row) => !row.isActive).length;
  const activeCount = rows.length - inactiveCount;
  const singlePage = totalPages <= 1;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * BANK_PAGE_SIZE + 1;
  const rangeEnd = rangeStart === 0 ? 0 : rangeStart + rows.length - 1;

  return (
    <PageShell
      variant="canvas"
      className={cn(
        "gap-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6",
        loading && rows.length === 0 && "opacity-55",
      )}
      dir="rtl"
    >
      {loading && rows.length === 0 ? (
        <InlineLoadingSkeleton className="mb-3" />
      ) : null}

      <ComparableBankPhoneToolbar
        q={q}
        onQ={setQ}
        showInactive={showInactive}
        onShowInactive={setShowInactive}
        showForm={showForm}
        onReload={() => void reload()}
        onToggleForm={() => setShowForm((v) => !v)}
      />
      <div className={cn(opsToolbar, "max-lg:hidden")}>
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2.5">
          <div className={cn(opsFld, "min-w-[12rem] flex-1")}>
            <label htmlFor="comparables_bank_q" className={opsTfLbl}>
              بحث
            </label>
            <input
              id="comparables_bank_q"
              className={opsFldControl}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="مرجع / نوع / حي / إعلان…"
            />
          </div>
          <label className="flex items-center gap-1.5 self-end pb-2 text-[12.5px] text-text-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--gold-d)]"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            إظهار المعطّلة
          </label>
          <button
            type="button"
            className={opsBtnGhost}
            onClick={() => void reload()}
          >
            تحديث
          </button>
          <button
            type="button"
            className={opsBtnPrimary}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "إخفاء النموذج" : "إضافة مقارن"}
          </button>
        </div>
      </div>

      {showForm ? (
        <AddComparableForm
          bankRows={rows}
          onCreated={() => {
            setShowForm(false);
            void reload();
          }}
        />
      ) : null}

      {error ? (
        <p className="mb-3.5 m-0 rounded-[10px] border border-danger/30 bg-danger-bg px-3.5 py-3 text-[12.5px] text-danger-text">
          {error}
        </p>
      ) : null}

      <section className={opsLetterCard}>
        <div className={opsLetterHead}>
          <div className="flex items-center gap-[11px]">
            <span className={opsIconBoxGold}>
              <OpsIcon path={BANK_ICON} />
            </span>
            <div>
              <div className={opsLetterTitle}>سجل المقارنات</div>
              <div className={opsLetterSub}>
                {totalCount === 0
                  ? showInactive
                    ? "لا مقارنات"
                    : "لا مقارنات نشطة — جرّب إظهار المعطّلة"
                  : singlePage && showInactive && inactiveCount > 0
                    ? `${activeCount} نشط · ${inactiveCount} معطّل`
                    : `${totalCount} ${totalCount === 1 ? "مقارن" : "مقارنًا"}`}
              </div>
            </div>
          </div>
          <span className={opsPpBadge}>{totalCount}</span>
        </div>
        <div className="px-4 pb-2 sm:px-[18px]">
          {rows.length === 0 ? (
            <EmptyState
              line={
                loading
                  ? "جاري التحميل…"
                  : showInactive
                    ? "لا مقارنات."
                    : "لا مقارنات نشطة — فعّل «إظهار المعطّلة» لرؤية المعطّلة سابقاً."
              }
            />
          ) : (
            // The fade sits on a wrapper: the list's own loading dim would snap.
            <div ref={listRef}>
              <div className={cn(loading && "opacity-60")}>
              <ComparableBankPhoneList
                rows={rows}
                tagEditId={tagEditId}
                onToggleTag={(id) =>
                  setTagEditId((cur) => (cur === id ? null : id))
                }
                onDeactivate={(id) => void onDeactivate(id)}
                onReactivate={(id) => void onReactivate(id)}
                onTagSaved={() => {
                  setTagEditId(null);
                  void reload();
                }}
              />
              <div className="max-lg:hidden">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className={cn(
                      "border-b border-border py-3 last:border-b-0",
                      "[content-visibility:auto] [contain-intrinsic-size:auto_88px]",
                      !row.isActive && "opacity-60",
                    )}
                  >
                    {/* Phones: actions drop under the details so the text keeps the full width. */}
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-bold text-heading">
                            {row.referenceCode} · {row.comparablePropertyType}
                            {row.usage ? ` (${row.usage})` : ""}
                          </span>
                          {comparableStatusPills(row)}
                        </div>
                        <div className="mt-0.5 text-[11.5px] leading-relaxed text-text-3">
                          {row.transactionKindLabelAr}
                          {row.priceDescriptionLabelAr
                            ? ` / ${row.priceDescriptionLabelAr}`
                            : ""}{" "}
                          · {row.district}
                          {row.city ? ` · ${row.city}` : ""} ·{" "}
                          <bdi className="whitespace-nowrap">{row.transactionDate}</bdi> ·{" "}
                          <bdi className="whitespace-nowrap">{row.areaSqm} م²</bdi> ·{" "}
                          <bdi className="whitespace-nowrap">
                            {fmtSar(row.price, { digits: 3, trim: true })}
                          </bdi>{" "}
                          ·{" "}
                          <bdi className="whitespace-nowrap">
                            {fmtSar(row.pricePerSqm, { digits: 3, trim: true })}/م²
                          </bdi>
                        </div>
                        <div className="mt-0.5 text-[11px] text-text-3">
                          المصدر: {comparableSourceText(row)}
                        </div>
                        {row.tagRationale ? (
                          <div className="mt-0.5 text-[11px] text-text-3">
                            مبرر الوسم: {row.tagRationale}
                            {row.taggedByUserId
                              ? ` — بواسطة ${row.taggedByUserId}`
                              : ""}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5 max-sm:[&>*]:flex-1 max-sm:[&>*]:justify-center">
                        <button
                          type="button"
                          className={opsBtnGhost}
                          onClick={() =>
                            setTagEditId((cur) =>
                              cur === row.id ? null : row.id,
                            )
                          }
                        >
                          {tagEditId === row.id ? "إغلاق الوسم" : "وسم الجودة"}
                        </button>
                        {row.isActive ? (
                          <button
                            type="button"
                            className={comparableDeactivateBtn}
                            onClick={() => void onDeactivate(row.id)}
                          >
                            تعطيل
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={comparableReactivateBtn}
                            onClick={() => void onReactivate(row.id)}
                          >
                            تفعيل
                          </button>
                        )}
                      </div>
                    </div>
                    {tagEditId === row.id ? (
                      <TagEditorRow
                        key={row.id}
                        row={row}
                        onSaved={() => {
                          setTagEditId(null);
                          void reload();
                        }}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
              </div>
            </div>
          )}
          {totalCount > 0 && !singlePage ? (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-2.5 pb-1">
              <span className="text-[12px] text-text-3">
                عرض{" "}
                <b className="font-bold text-heading">
                  {rangeStart}–{rangeEnd}
                </b>{" "}
                من <b className="font-bold text-heading">{totalCount}</b>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className={cn(opsBtnGhost, "disabled:opacity-40")}
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((n) => Math.max(1, n - 1))}
                  aria-label="الصفحة السابقة"
                >
                  ‹
                </button>
                <span className="px-1 text-[12px] text-text-3">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className={cn(opsBtnGhost, "disabled:opacity-40")}
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
                  aria-label="الصفحة التالية"
                >
                  ›
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </PageShell>
  );
}
