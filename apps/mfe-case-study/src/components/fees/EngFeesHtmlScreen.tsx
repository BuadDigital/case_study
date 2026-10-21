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
} from "@platform/ui-kit";
import { EngFeesHtmlTabs } from "./EngFeesHtmlTabs";
import { EngFeesLedgerSection } from "./EngFeesLedgerSection";
import { EngFeesStatementsSection } from "./EngFeesStatementsSection";
import { EngFeesInvoiceModal } from "./EngFeesInvoiceModal";
import { useEngFeesWorkflow } from "./useEngFeesWorkflow";

function CurrencyIcon({ className }: { className?: string }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22a10 10 0 1 0-10-10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}


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
    objectOpenId,
    setObjectOpenId,
    objectText,
    setObjectText,
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
    act,
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
            icon: <ClockIcon />,
            iconClass: "bg-[color-mix(in_srgb,#d9a441_14%,transparent)] text-[#8a5e14]",
            tone: "gold",
            label: "بانتظار إفادتكم",
            value: fmtSar(kpi.pending, { digits: 3, trim: true }),
            sub: "تعديلات تسعير تنتظر إفادتكم",
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
          icon={<ClockIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_14%,transparent)] text-[#8a5e14]"
          label="بانتظار إفادتكم"
          value={
            <span className="text-[20px] font-extrabold tabular-nums">
              {fmtSar(kpi.pending, { digits: 3, trim: true })}
            </span>
          }
          sub="تعديلات تسعير تنتظر إفادتكم"
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
            label: "تتطلب إجراءكم",
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
            busyId={busyId}
            objectOpenId={objectOpenId}
            setObjectOpenId={setObjectOpenId}
            objectText={objectText}
            setObjectText={setObjectText}
            act={act}
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
