"use client";

/**
 * Faithful port of Case Study.html `renderEngFees()` for the engineering office.
 * Layout: KPI -> tabs -> (secT + toolbar + card) | statements.
 *
 * Queries, filters and the writes live in `useEngFeesWorkflow`; status meta and
 * list filters in `eng-fees-state.ts`; each tab body in a sibling component.
 */

import { fmtSar } from "@platform/app-shared/format/number";
import { useRef } from "react";
import {
  KpiBand,
  KpiCell,
  MobileKpiStatCards,
  useSwapAnimation,
  KpiClockIcon,
} from "@platform/ui-kit";
import { EngFeesHtmlTabs } from "./EngFeesHtmlTabs";
import { EngFeesLedgerSection } from "./EngFeesLedgerSection";
import { EngFeesStatementsSection } from "./EngFeesStatementsSection";
import { EngFeesInvoiceModal } from "./EngFeesInvoiceModal";
import { useEngFeesWorkflow } from "./useEngFeesWorkflow";
import { CardIcon, CurrencyIcon } from "./FeeKpiIcons";

export function EngFeesHtmlScreen({ assigneeId }: { assigneeId?: string }) {
  const {
    tab,
    onTabChange,
    search,
    setSearch,
    stFilter,
    setStFilter,
    fnSearch,
    setFnSearch,
    openFn,
    setOpenFn,
    busyId,
    invoiceNo,
    setInvoiceNo,
    invoiceDate,
    setInvoiceDate,
    invoiceFile,
    setInvoiceFile,
    feesPending,
    statements,
    kpi,
    actionCount,
    readyCount,
    filteredFees,
    filteredFns,
    submitInvoice,
    openStatement,
    closeStatementModal,
    showToast,
  } = useEngFeesWorkflow(assigneeId);
  const panelRef = useRef<HTMLDivElement>(null);
  useSwapAnimation(panelRef, tab);

  return (
    <div className="flex flex-col gap-3.5">
      {/* Phones: 2×2 KPI cards instead of the four-cell desktop slab. */}
      <MobileKpiStatCards
        className="mb-0"
        items={[
          {
            key: "outstanding",
            icon: <CurrencyIcon />,
            iconClass: "bg-gold-soft text-gold-d",
            tone: "gold",
            label: "إجمالي المستحق غير المفوتر",
            value: fmtSar(kpi.outstanding, { digits: 3, trim: true }),
            sub: "كل استحقاقاتكم التي لم تُصرف بعد",
          },
          {
            key: "pending",
            icon: <KpiClockIcon />,
            iconClass: "bg-[color-mix(in_srgb,#d9a441_14%,transparent)] text-[#8a5e14]",
            tone: "gold",
            label: "قيد المراجعة مع المشرف",
            value: fmtSar(kpi.pending, { digits: 3, trim: true }),
            sub: "حسم مقترح يناقشه معكم المشرف",
          },
          {
            key: "ready",
            icon: <CardIcon />,
            iconClass: "bg-navy-soft text-heading",
            tone: "ink",
            label: "جاهزة للفوترة",
            value: fmtSar(kpi.ready, { digits: 3, trim: true }),
            sub: "تشمل المرحَّل — بانتظار كشف المحاسب",
          },
          {
            key: "paid",
            icon: <CurrencyIcon />,
            iconClass: "bg-[color-mix(in_srgb,#3f8f5f_14%,transparent)] text-heading",
            tone: "ink",
            label: "مفوترة / مدفوعة",
            value: fmtSar(kpi.paid, { digits: 3, trim: true }),
            sub: "إجمالي الكشوف المصروفة الموثَّقة",
          },
        ]}
      />
      {/* Case Study.html `.kpi` */}
      <KpiBand className="mb-1 hidden lg:flex">
        <KpiCell
          first
          icon={<CurrencyIcon />}
          iconClass="bg-gold-soft text-gold-d"
          label="إجمالي المستحق غير المفوتر"
          value={
            <span className="text-[20px] font-extrabold tabular-nums">
              {fmtSar(kpi.outstanding, { digits: 3, trim: true })}
            </span>
          }
          sub="كل استحقاقاتكم التي لم تُصرف بعد"
          dot
        />
        <KpiCell
          icon={<KpiClockIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_14%,transparent)] text-[#8a5e14]"
          label="قيد المراجعة مع المشرف"
          value={
            <span className="text-[20px] font-extrabold tabular-nums">
              {fmtSar(kpi.pending, { digits: 3, trim: true })}
            </span>
          }
          sub="حسم مقترح يناقشه معكم المشرف"
        />
        <KpiCell
          icon={<CardIcon />}
          iconClass="bg-navy-soft text-heading"
          label="جاهزة للفوترة"
          value={
            <span className="text-[20px] font-extrabold tabular-nums">
              {fmtSar(kpi.ready, { digits: 3, trim: true })}
            </span>
          }
          sub="تشمل المرحَّل — بانتظار كشف المحاسب"
        />
        <KpiCell
          last
          icon={<CurrencyIcon />}
          iconClass="bg-[color-mix(in_srgb,#3f8f5f_14%,transparent)] text-heading"
          label="مفوترة / مدفوعة"
          value={
            <span className="text-[20px] font-extrabold tabular-nums">
              {fmtSar(kpi.paid, { digits: 3, trim: true })}
            </span>
          }
          sub="إجمالي الكشوف المصروفة الموثَّقة"
        />
      </KpiBand>

      <EngFeesHtmlTabs
        className="!mb-0"
        active={tab}
        onChange={onTabChange}
        tabs={[
          {
            id: "action",
            label: "قيد المراجعة",
            count: actionCount,
            countWarnWhenActive: true,
          },
          { id: "ready", label: "جاهزة للفوترة", count: readyCount },
          {
            id: "statements",
            label: "كشوف الفوترة الصادرة",
            count: statements.length,
          },
        ]}
      />

      <div ref={panelRef} className="flex flex-col gap-3.5">
        {tab !== "statements" ? (
          <EngFeesLedgerSection
            tab={tab}
            search={search}
            setSearch={setSearch}
            stFilter={stFilter}
            setStFilter={setStFilter}
            filteredFees={filteredFees}
            feesPending={feesPending}
          />
        ) : (
          <>
            <EngFeesStatementsSection
              fnSearch={fnSearch}
              setFnSearch={setFnSearch}
              filteredFns={filteredFns}
              openFn={openFn}
              setOpenFn={setOpenFn}
            />

            <EngFeesInvoiceModal
              openStatement={openStatement}
              closeStatementModal={closeStatementModal}
              invoiceNo={invoiceNo}
              setInvoiceNo={setInvoiceNo}
              invoiceDate={invoiceDate}
              setInvoiceDate={setInvoiceDate}
              invoiceFile={invoiceFile}
              setInvoiceFile={setInvoiceFile}
              busyId={busyId}
              submitInvoice={submitInvoice}
              showToast={showToast}
            />
          </>
        )}
      </div>
    </div>
  );
}
