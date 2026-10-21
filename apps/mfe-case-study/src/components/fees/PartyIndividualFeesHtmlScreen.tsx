"use client";

/**
 * Party fees shell (same module shape as EngFeesHtmlScreen: KPI -> tabs -> table | docs)
 * with a per-role slot. Each party only sees its lane:
 *   - field-inspection  -> inspector: submit-to-supervisor, individual voucher, no invoice
 *   - court-visit -> reviewer: visit fees (CourtVisitFeeCharges) + payment orders + keys
 *     (no ledger/supervisor-submit path - product dropped government-review workflow)
 * Never share eng (vendor) actions or statements across variants.
 *
 * Queries, filters and the fee transition live in `usePartyIndividualFeesWorkflow`;
 * status buckets, copy and totals in `party-individual-fees-state.ts`.
 */

import { fmtSar } from "@platform/app-shared/format/number";
import { Fragment, useRef } from "react";
import Link from "next/link";
import {
  cn,
  KpiBand,
  KpiCell,
  MobileKpiStatCards,
  QueueTableHint,
  StatusPill,
  Table,
  TableEmptyRow,
  TableFrame,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
  useSwapAnimation,
} from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { KeyEnvelopeFeesPanel } from "./KeyEnvelopeFeesPanelSlot";
import { EngFeesHtmlTabs, EngFeesSectionTitle } from "./EngFeesHtmlTabs";
import { CourtVisitFeesPanel } from "./CourtVisitFeesPanel";
import { ymd as formatYmd } from "@platform/app-shared/format/date";
import {
  opsFldControl,
  opsFilters,
  opsListCount,
  opsToolbar,
} from "../../lib/app-data/ops-tasks-tw";
import {
  deedParts,
  individualFeeUiStatus,
  statementMeta,
  statusMeta,
  type IndividualFeesVariant,
} from "./party-individual-fees-state";
import { usePartyIndividualFeesWorkflow } from "./usePartyIndividualFeesWorkflow";
import {
  FeeRowAction,
  PartyFeesPhoneList,
  PartyStatementsPhoneList,
  StatementLinesDetail,
} from "./PartyIndividualFeesParts";

export type { IndividualFeesVariant };

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

export function PartyIndividualFeesHtmlScreen({
  assigneeId,
  variant,
}: {
  assigneeId?: string;
  variant: IndividualFeesVariant;
}) {
  const { hasCapability } = useAppAccess();
  const {
    copy,
    isCourtVisit,
    showVisitKey,
    tab,
    tabs,
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
    feesPending,
    filteredFees,
    filteredFns,
    kpi,
    act,
    showToast,
  } = usePartyIndividualFeesWorkflow(assigneeId, variant);
  const panelRef = useRef<HTMLDivElement>(null);
  useSwapAnimation(panelRef, tab);

  return (
    <div className="flex flex-col gap-3.5">
      <MobileKpiStatCards
        className="mb-0"
        items={[
          {
            key: "outstanding",
            icon: <CurrencyIcon />,
            iconClass: "bg-gold-soft text-gold-d",
            tone: "gold",
            label: "إجمالي المستحق غير المصروف",
            value: fmtSar(kpi.outstanding, { digits: 3, trim: true }),
            sub: copy.outstandingSub,
          },
          {
            key: "action",
            icon: <ClockIcon />,
            iconClass: "bg-[color-mix(in_srgb,#d9a441_14%,transparent)] text-[#8a5e14]",
            tone: "gold",
            label: copy.actionKpiLabel,
            value: fmtSar(kpi.actionSar, { digits: 3, trim: true }),
            sub: copy.actionKpiSub,
          },
          {
            key: "ready",
            icon: <CardIcon />,
            iconClass: "bg-navy-soft text-heading",
            tone: "ink",
            label: copy.readyKpiLabel,
            value: fmtSar(kpi.readySar, { digits: 3, trim: true }),
            sub: copy.readyKpiSub,
          },
          {
            key: "paid",
            icon: <CurrencyIcon />,
            iconClass: "bg-[color-mix(in_srgb,#3f8f5f_14%,transparent)] text-heading",
            tone: "ink",
            label: copy.paidKpiLabel,
            value: fmtSar(kpi.paidSar, { digits: 3, trim: true }),
            sub: copy.paidKpiSub,
          },
        ]}
      />
      <KpiBand className="mb-1 hidden lg:flex">
        <KpiCell
          first
          icon={<CurrencyIcon />}
          iconClass="bg-gold-soft text-gold-d"
          label="إجمالي المستحق غير المصروف"
          value={
            <span className="text-[20px] font-extrabold tabular-nums">
              {fmtSar(kpi.outstanding, { digits: 3, trim: true })}
            </span>
          }
          sub={copy.outstandingSub}
          dot
        />
        <KpiCell
          icon={<ClockIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_14%,transparent)] text-[#8a5e14]"
          label={copy.actionKpiLabel}
          value={
            <span className="text-[20px] font-extrabold tabular-nums">
              {fmtSar(kpi.actionSar, { digits: 3, trim: true })}
            </span>
          }
          sub={copy.actionKpiSub}
        />
        <KpiCell
          icon={<CardIcon />}
          iconClass="bg-navy-soft text-heading"
          label={copy.readyKpiLabel}
          value={
            <span className="text-[20px] font-extrabold tabular-nums">
              {fmtSar(kpi.readySar, { digits: 3, trim: true })}
            </span>
          }
          sub={copy.readyKpiSub}
        />
        <KpiCell
          last
          icon={<CurrencyIcon />}
          iconClass="bg-[color-mix(in_srgb,#3f8f5f_14%,transparent)] text-heading"
          label={copy.paidKpiLabel}
          value={
            <span className="text-[20px] font-extrabold tabular-nums">
              {fmtSar(kpi.paidSar, { digits: 3, trim: true })}
            </span>
          }
          sub={copy.paidKpiSub}
        />
      </KpiBand>

      <EngFeesHtmlTabs
        className="!mb-0"
        active={tab}
        onChange={onTabChange}
        tabs={tabs}
      />

      <div ref={panelRef} className="flex flex-col gap-3.5">
        {!isCourtVisit &&
        (tab === "action" || tab === "tracking" || tab === "ready") ? (
          <>
            <EngFeesSectionTitle
              title={
                tab === "action"
                  ? copy.actionTitle
                  : tab === "tracking"
                    ? copy.trackingTitle
                    : copy.readyTitle
              }
              sub={
                tab === "action"
                  ? copy.actionSub
                  : tab === "tracking"
                    ? copy.trackingSub
                    : copy.readySub
              }
            />

            <div className={opsToolbar}>
              <div className={opsFilters}>
                <div className="relative flex items-center">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="pointer-events-none absolute start-3 text-text-3"
                    aria-hidden
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="رقم الصك أو المدينة أو الحي…"
                    aria-label="بحث الأتعاب"
                    className={cn(opsFldControl, "w-[248px] max-w-full ps-[38px]")}
                  />
                </div>
                <div className="relative flex items-center">
                  <select
                    value={stFilter}
                    onChange={(e) => setStFilter(e.target.value)}
                    aria-label="تصفية الحالة"
                    className={cn(opsFldControl, "cursor-pointer")}
                  >
                    <option value="">جميع الحالات</option>
                    {tab === "action" ? (
                      <option value="needs_submit">جاهز للرفع</option>
                    ) : null}
                    {tab === "tracking" ? (
                      <>
                        <option value="draft_work">بانتظار العمل</option>
                        <option value="returned_to_party">مُعاد إليكم</option>
                        <option value="inquiry_to_party">استفسار بانتظار ردكم</option>
                        <option value="sup_review">عند المشرف</option>
                        <option value="suspended">موقوف</option>
                      </>
                    ) : null}
                    {tab === "ready" ? (
                      <>
                        <option value="at_finance">لدى المالية</option>
                        <option value="listed">في أمر صرف</option>
                        <option value="paid">مصروف</option>
                      </>
                    ) : null}
                  </select>
                </div>
                <span className={opsListCount}>{filteredFees.length} بند</span>
              </div>
            </div>

            <PartyFeesPhoneList
              rows={filteredFees}
              pending={feesPending}
              copy={copy}
              busyId={busyId}
              onSubmit={(row) => void act(row, "submit-to-supervisor")}
            />

            <TableFrame className="max-lg:hidden">
              <Table className="min-w-[920px]">
                <THead>
                  <Tr hoverable={false}>
                    <Th>الصك</Th>
                    <Th>{copy.dateCol}</Th>
                    <Th>سعر الجدول</Th>
                    <Th>تعديل / مبرر</Th>
                    <Th>الصافي</Th>
                    <Th>الحالة</Th>
                    <Th>{copy.actionCol}</Th>
                  </Tr>
                </THead>
                <TBody>
                  {feesPending && filteredFees.length === 0 ? (
                    <TableEmptyRow colSpan={7}>جاري التحميل…</TableEmptyRow>
                  ) : filteredFees.length === 0 ? (
                    <TableEmptyRow colSpan={7}>لا توجد بنود مطابقة.</TableEmptyRow>
                  ) : (
                    filteredFees.map((row) => {
                      const st = individualFeeUiStatus(row);
                      const meta = statusMeta(st);
                      const { deed, region } = deedParts(row);
                      const ded = row.supervisorDiscountSar > 0;
                      const busy = busyId === row.workflowTaskId;
                      return (
                        <Tr
                          key={
                            row.id ||
                            `${row.workflowTaskId}-${row.billingStatus}-${row.netFeeSar}`
                          }
                        >
                          <Td>
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span
                                dir="ltr"
                                className="inline-block text-start text-[13px] font-bold tabular-nums text-gold-d [unicode-bidi:isolate]"
                              >
                                {deed}
                              </span>
                              <span className="text-[11px] text-text-3">
                                {region}
                              </span>
                            </div>
                          </Td>
                          <TdLtr valueClassName="text-[12px] text-text-2">
                            {formatYmd(
                              row.workSubmittedAtUtc ??
                                row.accruedAtUtc ??
                                row.updatedAtUtc,
                            )}
                          </TdLtr>
                          <TdLtr valueClassName="text-[12.5px] text-text-2">
                            {fmtSar(row.agreedFeeSar, { digits: 3, trim: true })}
                          </TdLtr>
                          <Td>
                            {ded ? (
                              <span
                                className="inline-flex min-w-0 max-w-full items-center gap-1.5"
                                title={row.discountReason ?? undefined}
                              >
                                <span
                                  dir="ltr"
                                  className="shrink-0 text-[12.5px] font-bold tabular-nums text-[#a5432e] [unicode-bidi:isolate]"
                                >
                                  − {fmtSar(row.supervisorDiscountSar, { digits: 3, trim: true })}
                                </span>
                                <span className="truncate text-[10.5px] text-text-3">
                                  {row.discountReason || ""}
                                </span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-text-3">
                                بسعر الجدول
                              </span>
                            )}
                          </Td>
                          <TdLtr valueClassName="text-[13px] font-bold text-heading">
                            {fmtSar(row.netFeeSar, { digits: 3, trim: true })}
                          </TdLtr>
                          <Td>
                            <StatusPill label={meta.label} style={meta.style} />
                          </Td>
                          <Td className="overflow-visible">
                            <FeeRowAction
                              row={row}
                              st={st}
                              busy={busy}
                              onSubmit={() => void act(row, "submit-to-supervisor")}
                            />
                          </Td>
                        </Tr>
                      );
                    })
                  )}
                </TBody>
              </Table>
              <div className="border-t border-border px-4 py-[11px] text-[12px] text-text-3">
                {copy.roleLabel}: {copy.statementsFooter}
              </div>
            </TableFrame>
          </>
        ) : null}

        {tab === "statements" ? (
          <>
            <div className={opsToolbar}>
              <div className={opsFilters}>
                <div className="relative flex items-center">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="pointer-events-none absolute start-3 text-text-3"
                    aria-hidden
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="search"
                    value={fnSearch}
                    onChange={(e) => setFnSearch(e.target.value)}
                    placeholder="رقم أمر الصرف…"
                    className={cn(opsFldControl, "w-[248px] max-w-full ps-[38px]")}
                  />
                </div>
                <span className={opsListCount}>{filteredFns.length} مستند</span>
              </div>
            </div>

            <PartyStatementsPhoneList
              statements={filteredFns}
              openFn={openFn}
              setOpenFn={setOpenFn}
              footer={copy.statementsFooter}
              onError={(e) => showToast(e, "error")}
            />

            <TableFrame className="max-lg:hidden">
              <Table className="min-w-[820px]">
                <THead>
                  <Tr hoverable={false}>
                    <Th>رقم الأمر</Th>
                    <Th>تاريخ الإصدار</Th>
                    <Th>المعاملات</Th>
                    <Th>الإجمالي</Th>
                    <Th>الحالة</Th>
                    <Th>الصرف</Th>
                  </Tr>
                </THead>
                <TBody>
                  {filteredFns.length === 0 ? (
                    <TableEmptyRow colSpan={6}>
                      لا توجد مستندات مطابقة.
                    </TableEmptyRow>
                  ) : (
                    filteredFns.map((s) => {
                      const open = openFn === s.referenceNumber;
                      const meta = statementMeta(s);
                      return (
                        <Fragment key={s.id}>
                          <Tr
                            hoverable={false}
                            className={cn(
                              "cursor-pointer [&:hover_td]:bg-row-hover",
                              open && "[&_td]:bg-row-hover",
                            )}
                            onClick={() =>
                              setOpenFn(open ? null : s.referenceNumber)
                            }
                          >
                            <TdLtr valueClassName="font-bold text-gold-d text-[12.5px]">
                              {s.referenceNumber}
                            </TdLtr>
                            <TdLtr valueClassName="text-[12px] text-text-2">
                              {formatYmd(s.issuedAtUtc ?? s.createdAtUtc)}
                            </TdLtr>
                            <Td className="text-[12.5px]">
                              {s.lines.length} معاملات
                            </Td>
                            <TdLtr valueClassName="text-[13px] font-bold text-heading">
                              {fmtSar(s.totalNetSar, { digits: 3, trim: true })}
                            </TdLtr>
                            <Td>
                              <StatusPill
                                label={meta.label}
                                style={meta.style}
                              />
                            </Td>
                            <Td className="text-[11px] text-text-2">
                              {s.status === "closed" && s.paidAtUtc
                                ? `صُرف ${formatYmd(s.paidAtUtc)}`
                                : "بانتظار الصرف"}
                            </Td>
                          </Tr>
                          {open ? (
                            <Tr hoverable={false}>
                              <Td
                                colSpan={6}
                                className="bg-surface-2 !py-3"
                              >
                                <StatementLinesDetail
                                  s={s}
                                  onError={(e) => showToast(e, "error")}
                                />
                              </Td>
                            </Tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </TBody>
              </Table>
              <div className="border-t border-border px-4 py-[11px] text-[12px] text-text-3">
                {copy.statementsFooter}
              </div>
            </TableFrame>
          </>
        ) : null}

        {tab === "visit-fees" && showVisitKey ? (
          <CourtVisitFeesPanel creditAssigneeId={assigneeId} />
        ) : null}

        {tab === "key-fees" && showVisitKey ? (
          <>
            <KeyEnvelopeFeesPanel
              canCollect={hasCapability("manage-financial")}
              onOpenEnvelope={(envelopeId: string) => {
                window.location.assign(
                  `/keys?envelope=${encodeURIComponent(envelopeId)}`,
                );
              }}
            />
            <QueueTableHint className="mt-3">
              أتعاب استلام ظرف المفاتيح — التفاصيل من{" "}
              <Link
                href="/keys?tab=fees"
                className="font-semibold text-primary underline underline-offset-2"
              >
                إدارة المفاتيح → تقرير الأتعاب
              </Link>
              .
            </QueueTableHint>
          </>
        ) : null}
      </div>
    </div>
  );
}
