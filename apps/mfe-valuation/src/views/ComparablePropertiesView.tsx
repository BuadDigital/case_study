"use client";

/**
 * Company-wide comparable bank CRUD. Selection / adopt into a valuation request
 * lives on the appraiser workspace (Comparables tab). The intake form and the
 * quality-tag editor are siblings; pure rules live in
 * `comparable-properties-state.ts`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  deactivateComparableProperty,
  listComparableProperties,
  reactivateComparableProperty,
  type ComparablePropertyDto,
} from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import {
  cn,
  EmptyState,
  InlineLoadingSkeleton,
  PageShell,
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
import { SAR_FORMAT } from "./comparable-properties-state";
import { BANK_ICON, OpsIcon } from "./ComparablesOpsIcon";
import { AddComparableForm } from "./AddComparableForm";
import { TagEditorRow } from "./TagEditorRow";

/**
 * Company-wide comparable bank CRUD.
 * Selection / adopt into a valuation request lives on the appraiser workspace (Comparables tab).
 */
export function ComparablePropertiesView() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<ComparablePropertyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 280);
    return () => clearTimeout(t);
  }, [q]);

  const reload = useCallback(async () => {
    const config = apiConfig();
    if (!config) {
      setLoading(false);
      setError("يلزم تسجيل الدخول");
      return;
    }
    const seq = ++requestSeqRef.current;
    setLoading(true);
    const res = await listComparableProperties(config, {
      q: debouncedQ || undefined,
      take: 100,
      includeInactive: showInactive,
    });
    if (seq !== requestSeqRef.current) return;
    setLoading(false);
    if (!res.ok) {
      setError("تعذّر تحميل بنك المقارنات");
      return;
    }
    setError(null);
    setRows(res.data);
  }, [debouncedQ, showInactive]);

  useEffect(() => {
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

  const inactiveCount = rows.filter((row) => !row.isActive).length;
  const activeCount = rows.length - inactiveCount;

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

      <div className={opsToolbar}>
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
                {rows.length === 0
                  ? showInactive
                    ? "لا مقارنات"
                    : "لا مقارنات نشطة — جرّب إظهار المعطّلة"
                  : showInactive && inactiveCount > 0
                    ? `${activeCount} نشط · ${inactiveCount} معطّل`
                    : `${rows.length} ${rows.length === 1 ? "مقارن" : "مقارنًا"}`}
              </div>
            </div>
          </div>
          <span className={opsPpBadge}>{rows.length}</span>
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
            <div className={cn(loading && "opacity-60")}>
              {rows.map((row) => (
                <div
                  key={row.id}
                  className={cn(
                    "border-b border-border py-3 last:border-b-0",
                    "[content-visibility:auto] [contain-intrinsic-size:auto_88px]",
                    !row.isActive && "opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-bold text-heading">
                          {row.referenceCode} · {row.comparablePropertyType}
                          {row.usage ? ` (${row.usage})` : ""}
                        </span>
                        {row.reliabilityTag !== "normal" ? (
                          <span className="inline-flex items-center rounded-full bg-gold-soft px-2 py-0.5 text-[10.5px] font-bold text-gold-d">
                            {row.reliabilityTagLabelAr}
                          </span>
                        ) : null}
                        {row.isDuplicateTagged ? (
                          <span className="inline-flex items-center rounded-full bg-gold-soft px-2 py-0.5 text-[10.5px] font-bold text-gold-d">
                            مكرر
                          </span>
                        ) : null}
                        {row.duplicateSuspect && !row.isDuplicateTagged ? (
                          <span className="inline-flex items-center rounded-full border border-border-md px-2 py-0.5 text-[10.5px] font-semibold text-text-2">
                            اشتباه تكرار
                          </span>
                        ) : null}
                        {!row.isActive ? (
                          <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-text-3">
                            معطّل
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[11.5px] leading-relaxed text-text-3">
                        {row.transactionKindLabelAr}
                        {row.priceDescriptionLabelAr
                          ? ` / ${row.priceDescriptionLabelAr}`
                          : ""}{" "}
                        · {row.district}
                        {row.city ? ` · ${row.city}` : ""} ·{" "}
                        {row.transactionDate} · {row.areaSqm} م² ·{" "}
                        {SAR_FORMAT.format(row.price)} ر.س ·{" "}
                        {SAR_FORMAT.format(row.pricePerSqm)} ر.س/م²
                      </div>
                      <div className="mt-0.5 text-[11px] text-text-3">
                        المصدر: {row.sourceCard.intakeChannelLabelAr} ·{" "}
                        {row.sourceCard.freshnessLabelAr}
                        {row.sourceCard.fromPriorDeal
                          ? ` · من معاملة سابقة${
                              row.sourceCard.sourceWorkOrderNumber
                                ? ` (${row.sourceCard.sourceWorkOrderNumber})`
                                : ""
                            }`
                          : ""}
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
                    <div className="flex shrink-0 flex-wrap gap-1.5">
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
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-[#d9694f] transition-colors enabled:hover:border-[#d9694f]/40 enabled:hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => void onDeactivate(row.id)}
                        >
                          تعطيل
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-gold-d transition-colors enabled:hover:border-gold/40 enabled:hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
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
          )}
        </div>
      </section>
    </PageShell>
  );
}
