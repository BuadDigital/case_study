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

import { Fragment } from "react";
import Link from "next/link";
import {
  cn,
  KpiBand,
  KpiCell,
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
} from "@platform/ui-kit";
import { openPartyBillingAttachment } from "@platform/app-shared/app-data/party-billing-statements-api";
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
  fmtSar,
  individualFeeUiStatus,
  statementMeta,
  statusMeta,
  type IndividualFeesVariant,
} from "./party-individual-fees-state";
import { usePartyIndividualFeesWorkflow } from "./usePartyIndividualFeesWorkflow";

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

  return (
    <div className="flex flex-col gap-3.5">
      <KpiBand className="mb-1">
        <KpiCell
          first
          icon={<CurrencyIcon />}
          iconClass="bg-gold-soft text-gold-d"
          label="إجمالي المستحق غير المصروف"
          value={
            <span className="text-[20px] font-extrabold tabular-nums">
              {fmtSar(kpi.outstanding)}
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
              {fmtSar(kpi.actionSar)}
            </span>
          }
          sub={copy.actionKpiSub}
        />
        <KpiCell
          icon={<CardIcon />}
          iconClass="bg-navy-soft text-ink"
          label={copy.readyKpiLabel}
          value={
            <span className="text-[20px] font-extrabold tabular-nums">
              {fmtSar(kpi.readySar)}
            </span>
          }
          sub={copy.readyKpiSub}
        />
        <KpiCell
          last
          icon={<CurrencyIcon />}
          iconClass="bg-[color-mix(in_srgb,#3f8f5f_14%,transparent)] text-[#2f7a4d]"
          label={copy.paidKpiLabel}
          value={
            <span className="text-[20px] font-extrabold tabular-nums">
              {fmtSar(kpi.paidSar)}
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

          <TableFrame>
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
                          {fmtSar(row.agreedFeeSar)}
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
                                − {fmtSar(row.supervisorDiscountSar)}
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
                          {fmtSar(row.netFeeSar)}
                        </TdLtr>
                        <Td>
                          <StatusPill label={meta.label} style={meta.style} />
                        </Td>
                        <Td className="overflow-visible">
                          {st === "needs_submit" ? (
                            <button
                              type="button"
                              disabled={busy || !row.canSubmitToSupervisor}
                              className="cursor-pointer whitespace-nowrap rounded-lg border-none bg-ink px-[11px] py-1 text-[11px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,.6)] disabled:opacity-50"
                              onClick={() =>
                                void act(row, "submit-to-supervisor")
                              }
                            >
                              رفع للمشرف
                            </button>
                          ) : st === "sup_review" ? (
                            <span className="text-[11px] text-text-3">
                              بانتظار الاعتماد
                            </span>
                          ) : st === "returned_to_party" ||
                            st === "inquiry_to_party" ? (
                            <span className="text-[11px] text-text-3">
                              راجع الملاحظات وأعِد الرفع
                            </span>
                          ) : st === "draft_work" ? (
                            <span className="text-[11px] text-text-3">
                              بعد إنجاز العمل يظهر للرفع
                            </span>
                          ) : st === "at_finance" || st === "listed" ? (
                            <span className="text-[11px] text-text-3">
                              المالية تتولى أمر الصرف
                            </span>
                          ) : st === "paid" ? (
                            <span className="text-[11px] font-semibold text-[#2f7a4d]">
                              ✓ مصروف
                            </span>
                          ) : (
                            <span className="text-[11px] text-text-3">—</span>
                          )}
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

          <TableFrame>
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
                            {fmtSar(s.totalNetSar)}
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
                              <div className="mb-2 text-[11.5px] font-bold text-text-2">
                                بنود {s.referenceNumber}
                              </div>
                              <div className="grid gap-1.5">
                                {s.lines.map((line) => (
                                  <div
                                    key={line.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px]"
                                  >
                                    <span
                                      dir="ltr"
                                      className="font-bold text-gold-d"
                                    >
                                      {line.propertyLabel}
                                    </span>
                                    <span className="font-bold text-heading">
                                      {fmtSar(line.netFeeSar)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {s.transferReceiptAttachmentId ? (
                                <button
                                  type="button"
                                  className="mt-2 cursor-pointer border-none bg-transparent p-0 text-[12px] text-primary underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void openPartyBillingAttachment(
                                      s.transferReceiptAttachmentId!,
                                    ).then((r) => {
                                      if (!r.ok) showToast(r.error, "error");
                                    });
                                  }}
                                >
                                  عرض إيصال التحويل
                                </button>
                              ) : null}
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
  );
}
