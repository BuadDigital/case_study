"use client";

import { Note, Spinner, cn, opsBtnGhost, opsBtnPrimary, opsFldControl, opsIconBoxGold, opsLetterCard, opsLetterHead, opsLetterSub, opsLetterTitle, opsTfNote, opsTfSeg, opsTfSegActive, opsTfSegRow } from "@platform/ui-kit";

import { CATEGORIES, PRICING_ICON } from "../lib/party-fee-pricing-state";
import { OpsIcon, PricingAssignModal } from "./FinancePartyFeePricingParts";
import { FinancePartyFeePricingEditor } from "./FinancePartyFeePricingEditor";
import { useFinancePartyFeePricingWorkflow } from "./useFinancePartyFeePricingWorkflow";

/**
 * Party fee pricing — category picker, table selector and the pricing editor.
 * All queries, drafts and writes live in
 * `useFinancePartyFeePricingWorkflow`.
 */
export function FinancePartyFeePricing() {
  const workflow = useFinancePartyFeePricingWorkflow();
  const {
    canEdit,
    saving,
    panelEpoch,
    draftMatchesCategory,
    tables,
    selectedCategory,
    draft,
    busy,
    loading,
    locked,
    categoryParties,
    assignSet,
    assignOpen,
    setAssignOpen,
    isInitialLoad,
    activeCategory,
    showEditor,
    showEmpty,
    selectValue,
    selectCategory,
    selectTable,
    createTable,
    toggleAssignee,
    saveAssignments,
  } = workflow;

  return (
    <div className="w-full pb-10 sm:pb-12">
      {!canEdit ? (
        <p className={cn(opsTfNote, "m-0 mb-3.5")}>
          وضع العرض فقط — لا صلاحية للتعديل.
        </p>
      ) : null}

      {/* Category — segmented buttons in task style */}
      <div
        className={cn(opsTfSegRow, "mb-3.5")}
        role="tablist"
        aria-label="فئة التسعيرة"
      >
        {CATEGORIES.map((cat) => {
          const on = cat.id === selectedCategory;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={on}
              disabled={busy || saving}
              onClick={() => selectCategory(cat.id)}
              className={on ? opsTfSegActive : opsTfSeg}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Section card — header with table pick and create buttons */}
      <section className={opsLetterCard} aria-busy={loading || busy}>
        <div className={opsLetterHead}>
          <div className="flex items-center gap-[11px]">
            <span className={opsIconBoxGold}>
              <OpsIcon path={PRICING_ICON} />
            </span>
            <div>
              <div className={opsLetterTitle}>
                {activeCategory?.label ?? "التسعيرة"}
              </div>
              <div className={opsLetterSub}>{activeCategory?.hint}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 max-lg:w-full">
            <label className="sr-only" htmlFor="pricing-table-select">
              الجدول
            </label>
            <select
              id="pricing-table-select"
              className={cn(opsFldControl, "min-h-11 min-w-[210px] flex-1 bg-surface font-medium sm:w-auto")}
              value={selectValue}
              disabled={
                loading || busy || tables.length === 0 || !draftMatchesCategory
              }
              onChange={(e) => void selectTable(e.target.value)}
            >
              {loading ? (
                <option value="">
                  جاري تحميل {activeCategory?.label ?? "الجداول"}…
                </option>
              ) : tables.length === 0 ? (
                <option value="">لا جداول بعد</option>
              ) : (
                tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || "بدون اسم"}
                    {t.isActive ? " · افتراضي" : ""}
                    {(t.assignedCount ?? 0) > 0
                      ? ` · ${t.assignedCount} مسند`
                      : ""}
                  </option>
                ))
              )}
            </select>
            {canEdit ? (
              <>
                <button
                  type="button"
                  className={opsBtnGhost}
                  disabled={locked}
                  onClick={() => void createTable("party-rates")}
                >
                  ＋ جدول جديد
                </button>
                {selectedCategory === "field-inspector" && draftMatchesCategory ? (
                  <button
                    type="button"
                    className={opsBtnGhost}
                    disabled={locked}
                    onClick={() => void createTable("flat")}
                  >
                    جدول حوافز
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="min-h-[220px] px-4 pb-[18px] pt-4 sm:px-[18px]">
        {isInitialLoad ? (
          <div className="space-y-4 py-10" aria-live="polite">
            <div className="mx-auto h-3 w-32 animate-pulse rounded bg-surface-2" />
            <div className="mx-auto h-10 max-w-md animate-pulse rounded-lg bg-surface-2" />
            <div className="mx-auto h-10 max-w-md animate-pulse rounded-lg bg-surface-2" />
            <p className="m-0 pt-1 text-center text-[12px] text-text-3">
              جاري تحميل {activeCategory?.label ?? "التسعيرة"}…
            </p>
          </div>
        ) : showEmpty ? (
          <div
            key={`empty-${panelEpoch}`}
            className="py-12 text-center animate-[pricing-panel-in_0.28s_ease-out]"
          >
            <p className="m-0 text-[14px] font-medium text-text">
              لا يوجد جدول في هذه الفئة
            </p>
            {canEdit ? (
              <button
                type="button"
                className={cn(opsBtnPrimary, "mt-5")}
                disabled={locked}
                onClick={() => void createTable("party-rates")}
              >
                ＋ إنشاء أول جدول
              </button>
            ) : null}
          </div>
        ) : showEditor ? (
          <FinancePartyFeePricingEditor workflow={workflow} />
        ) : null}
        </div>
      </section>


      {assignOpen ? (
        <PricingAssignModal
          tableName={draft.name}
          categoryLabel={activeCategory?.partyLabel ?? "المستحقون"}
          categoryParties={categoryParties}
          assignSet={assignSet}
          busy={busy}
          onToggle={toggleAssignee}
          onClose={() => setAssignOpen(false)}
          onSave={() => void saveAssignments()}
        />
      ) : null}
    </div>
  );
}
