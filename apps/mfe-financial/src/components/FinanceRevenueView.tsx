"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { fmt } from "@platform/app-shared/format/number";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { loadEnfazTracking } from "@platform/app-shared/app-data/enfaz-billing-api";
import type { EnfazTrackingRowDto } from "@platform/api-client";
import {
  EmptyState,
  cn,
  opsBtnGhost,
  opsBtnPrimary,
  opsFilters,
  opsLetterCard,
  opsSearchInput,
} from "@platform/ui-kit";
import { REVENUE_STAGES, type RevenueStage } from "../lib/finance-nav";
import {
  revenueAmountsFromRow,
  uniqueCities,
  bucketRevenueRows,
} from "../lib/finance-revenue-stages";
import {
  finCaret,
  finPo,
  finSearch,
  finSearchIcon,
  finSel,
  finSelCtrl,
  finWork,
  finWorkHead,
  finWorkTitle,
} from "../lib/finance-tw";
import { FinanceStagePills } from "./FinanceStagePills";
import { FinanceEnfazPoBilling } from "./FinanceEnfazPoBilling";
import { FinanceEnfazFollowupsPanel } from "./FinanceEnfazFollowupsPanel";
import {
  EMPTY_TRACKING_ROWS,
  filterRows,
  SearchIcon,
  RevenueStageEmpty,
  StudyTable,
  EligibleTable,
  BillingAssistantTable,
  CollectionTable,
  CollectedTable,
  StoppedTable,
} from "./FinanceRevenueTables";

export function FinanceRevenueView({
  stage,
  onStageChange,
  focusPo,
  onFocusPo,
}: {
  stage: RevenueStage;
  onStageChange: (stage: RevenueStage) => void;
  focusPo: string | null;
  /** forStage = current display stage so an old stage is not written into the URL */
  onFocusPo: (po: string | null, forStage?: RevenueStage) => void;
}) {
  const [search, setSearch] = useState("");
  /** Deferred value for filtering — search input stays immediate without blocking typing */
  const deferredSearch = useDeferredValue(search);
  const [period, setPeriod] = useState<"all" | "30" | "90">("all");
  const [city, setCity] = useState("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [followMode, setFollowMode] = useState(false);
  /**
   * Immediate display stage — do not wait on delayed searchParams after click,
   * or the tab badge and content from another stage would show.
   */
  const [viewStage, setViewStage] = useState(stage);
  const [prevStage, setPrevStage] = useState(stage);
  if (stage !== prevStage) {
    setPrevStage(stage);
    setViewStage(stage);
  }

  // Deliberately unpaged although `GET /api/enfaz-billing/tracking` pages
  // (pagination-contract §10.2): the stage tabs are client-side buckets
  // (`bucketRevenueRows`) whose badges count every row, the study table shows
  // «X of Y» properties per work order from its siblings, and the collection
  // table groups rows by invoice. A server page would cut across those
  // groups, so the screen keeps the whole set.
  const trackingQuery = useQuery({
    queryKey: [...appDataKeys.all, "enfaz-billing", "tracking", "revenue"],
    queryFn: loadEnfazTracking,
    staleTime: 20_000,
  });

  const allRows = trackingQuery.data ?? EMPTY_TRACKING_ROWS;
  const cities = useMemo(() => uniqueCities(allRows), [allRows]);
  const buckets = useMemo(() => bucketRevenueRows(allRows), [allRows]);

  /** Rows per stage after the same search/city/period filters — badges = what is shown */
  const filteredBuckets = useMemo(() => {
    const next = {} as Record<RevenueStage, EnfazTrackingRowDto[]>;
    for (const s of REVENUE_STAGES) {
      next[s.id] = filterRows(buckets[s.id] ?? [], deferredSearch, city, period);
    }
    return next;
  }, [buckets, deferredSearch, city, period]);

  const counts = useMemo(() => {
    const next: Partial<Record<RevenueStage, number>> = {};
    for (const s of REVENUE_STAGES) {
      next[s.id] = filteredBuckets[s.id]?.length ?? 0;
    }
    return next;
  }, [filteredBuckets]);

  const stageRows = useMemo(
    () => filteredBuckets[viewStage] ?? [],
    [filteredBuckets, viewStage],
  );

  /** Reset selection when the stage changes */
  useEffect(() => {
    setSelected({});
    setFollowMode(false);
  }, [viewStage]);

  const toggleGroup = useCallback((key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleSelect = useCallback((propertyId: string) => {
    setSelected((prev) => ({ ...prev, [propertyId]: !prev[propertyId] }));
  }, []);

  const selectedRows: EnfazTrackingRowDto[] = [];
  let selectedTotal = 0;
  for (const r of stageRows) {
    if (!selected[r.propertyId]) continue;
    selectedRows.push(r);
    selectedTotal += revenueAmountsFromRow(r).total;
  }
  const allSelected =
    stageRows.length > 0 && selectedRows.length === stageRows.length;

  const selectAll = () => {
    if (allSelected) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const r of stageRows) next[r.propertyId] = true;
    setSelected(next);
  };

  const openPo = (po: string, follow = false) => {
    setFollowMode(follow);
    onFocusPo(po, viewStage);
  };

  const showWorkPanel =
    focusPo != null &&
    (viewStage === "eligible" ||
      viewStage === "billing_assistant" ||
      viewStage === "awaiting_collection" ||
      viewStage === "stopped");

  const onInvoiceSelected = () => {
    if (selectedRows.length === 0) return;
    // First work order within selection — grouping is display-only
    openPo(selectedRows[0]!.poNumber);
  };

  const changeStage = (id: RevenueStage) => {
    setViewStage(id);
    // setStage clears po and updates the URL
    onStageChange(id);
  };

  return (
    <div>
      <FinanceStagePills
        items={REVENUE_STAGES}
        active={viewStage}
        onChange={changeStage}
        counts={counts}
      />

      {/* HTML order: search (right · flex:1) → city → period */}
      <div className={cn("mb-3.5 w-full", opsFilters)}>
        <div className={finSearch}>
          <SearchIcon />
          <input
            className={opsSearchInput}
            placeholder="بحث: رقم الطلب · رقم الصك · رقم الفاتورة"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="بحث الإيرادات"
          />
        </div>
        <div className={finSel}>
          <select
            className={finSelCtrl}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label="المدينة"
          >
            <option value="all">كل المدن</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className={finCaret} aria-hidden>
            ▾
          </span>
        </div>
        <div className={finSel}>
          <select
            className={finSelCtrl}
            value={period}
            onChange={(e) =>
              setPeriod(e.target.value as "all" | "30" | "90")
            }
            aria-label="الفترة"
          >
            <option value="all">كل الفترات</option>
            <option value="30">آخر ٣٠ يوماً</option>
            <option value="90">آخر ٩٠ يوماً</option>
          </select>
          <span className={finCaret} aria-hidden>
            ▾
          </span>
        </div>
      </div>

      {viewStage === "billing_assistant" ? (
        <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            className={cn(
              opsBtnGhost,
              "h-auto px-3.5 py-2 text-xs",
              stageRows.length === 0 && "pointer-events-none opacity-50",
            )}
            onClick={selectAll}
          >
            {allSelected
              ? "إلغاء التحديد"
              : `تحديد الكل (${stageRows.length})`}
          </button>
          <button
            type="button"
            className={cn(
              opsBtnPrimary,
              "px-4 py-2 text-[12.5px]",
              selectedRows.length === 0 && "pointer-events-none opacity-50",
            )}
            onClick={onInvoiceSelected}
          >
            تسجيل فاتورة للمحدد
            {selectedRows.length
              ? ` (${selectedRows.length} — ${fmt(selectedTotal, 2)} ر.س)`
              : ""}
          </button>
          <span className="text-[11px] text-text-3">
            اختر المعاملات الجاهزة وأضفها لفاتورة واحدة — التجميع تحت أمر العمل
            للعرض فقط.
          </span>
        </div>
      ) : null}

      {showWorkPanel ? (
        <div className={finWork}>
          <div className={finWorkHead}>
            <h3 className={finWorkTitle}>
              {viewStage === "stopped"
                ? "استدعاء ومتابعة — "
                : viewStage === "awaiting_collection"
                  ? followMode
                    ? "متابعة التحصيل — "
                    : "تسجيل التحويل — "
                  : viewStage === "billing_assistant"
                    ? "تسجيل الفاتورة — "
                    : "تحديث حالة إنفاذ / مطابقة — "}
              <span className={finPo} dir="ltr">
                {focusPo}
              </span>
            </h3>
            <button
              type="button"
              className={opsBtnGhost}
              onClick={() => {
                onFocusPo(null, viewStage);
                setFollowMode(false);
              }}
            >
              إغلاق
            </button>
          </div>
          {viewStage === "stopped" ? (
            <p className="mb-3 text-[12.5px] leading-[1.6] text-text-2">
              الفاتورة متأخرة عن موعد التحصيل، أو المعاملة جاهزة ولم تُرفع منذ
              30 يوماً. سجّل التحويل عند الاستلام أو وثّق المتابعة مع مركز
              التصفية.
            </p>
          ) : null}
          {viewStage !== "stopped" || !followMode ? (
            <FinanceEnfazPoBilling initialPo={focusPo} compact />
          ) : null}
          {(viewStage === "stopped" ||
            (viewStage === "awaiting_collection" && followMode)) &&
          focusPo ? (
            <FinanceEnfazFollowupsPanel poNumber={focusPo} />
          ) : null}
        </div>
      ) : null}

      {trackingQuery.isPending ? (
        <div className={opsLetterCard}>
          <EmptyState panel line="جاري التحميل…" />
        </div>
      ) : stageRows.length === 0 ? (
        <RevenueStageEmpty stage={viewStage} />
      ) : viewStage === "under_study" ? (
        <StudyTable
          rows={stageRows}
          allRows={allRows}
          collapsed={collapsed}
          onToggleGroup={toggleGroup}
        />
      ) : viewStage === "eligible" ? (
        <EligibleTable rows={stageRows} onOpenPo={(po) => openPo(po)} />
      ) : viewStage === "billing_assistant" ? (
        <BillingAssistantTable
          rows={stageRows}
          selected={selected}
          onToggle={toggleSelect}
          collapsed={collapsed}
          onToggleGroup={toggleGroup}
        />
      ) : viewStage === "awaiting_collection" ? (
        <CollectionTable
          rows={stageRows}
          collapsed={collapsed}
          onToggleGroup={toggleGroup}
          onCollect={(po) => openPo(po, false)}
          onFollow={(po) => openPo(po, true)}
        />
      ) : viewStage === "collected" ? (
        <CollectedTable rows={stageRows} />
      ) : viewStage === "excluded" ? (
        <StoppedTable rows={stageRows} mode="excluded" />
      ) : (
        <StoppedTable rows={stageRows} onRecall={(po) => openPo(po)} />
      )}
    </div>
  );
}
