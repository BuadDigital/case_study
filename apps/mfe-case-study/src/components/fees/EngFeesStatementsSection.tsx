"use client";

/**
 * Issued billing statements list of `EngFeesHtmlScreen` — search plus the
 * statements table; clicking a row opens `EngFeesInvoiceModal`.
 */

import { fmtSar } from "@platform/app-shared/format/number";
import {
  cn,
  MobileRecordCard,
  MobileRecordList,
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
import type { PartyBillingStatementDto } from "@platform/api-client";
import { ymd as formatYmd } from "@platform/app-shared/format/date";
import { EngFeesSectionTitle } from "./EngFeesHtmlTabs";
import { statementMeta } from "./eng-fees-state";

const STATEMENTS_FOOTER =
  "دورة الكشف: مسودة ← صادر ← محال للمالية ← مصروف. الفاتورة تصدر من البرنامج المحاسبي خارج النظام، ويُوثَّق الصرف هنا برقم الفاتورة وإيصال التحويل والتاريخ. البنود المتحفَّظ عليها تُعالَج بالتنسيق مع المشرف قبل إحالتها للمالية.";

/** The statement's payout note — paid date, invoice and transfer receipt (table cell and phone card). */
function StatementPayout({
  s,
  wrap,
}: {
  s: PartyBillingStatementDto;
  /** Phone card: let the receipt line wrap instead of truncating. */
  wrap?: boolean;
}) {
  return (
    <>
    {s.status === "closed" && s.paidAtUtc ? (
      <span className="inline-flex min-w-0 flex-col gap-px text-start">
        <span>
          صُرف {formatYmd(s.paidAtUtc)}
          {s.externalInvoiceNumber ||
          s.vendorInvoiceNumber ? (
            <>
              {" "}
              — فاتورة{" "}
              <b dir="ltr">
                {s.externalInvoiceNumber ||
                  s.vendorInvoiceNumber}
              </b>
            </>
          ) : null}
        </span>
        <span className={cn("text-text-3", !wrap && "truncate")}>
          📎{" "}
          {s.transferReceiptRef || "إيصال التحويل"}
          {s.transferReference
            ? ` · مرجع ${s.transferReference}`
            : ""}
        </span>
      </span>
    ) : (
      "بانتظار الصرف"
    )}
    </>
  );
}

export function EngFeesStatementsSection({
  fnSearch,
  setFnSearch,
  filteredFns,
  openFn,
  setOpenFn,
}: {
  fnSearch: string;
  setFnSearch: (v: string) => void;
  filteredFns: PartyBillingStatementDto[];
  openFn: string | null;
  setOpenFn: (v: string | null) => void;
}) {
  return (
    <>
      <EngFeesSectionTitle
        title="كشوف الفوترة الصادرة"
        sub="يُصدرها المحاسب نهاية الشهر من البنود الجاهزة فقط — مستند داخلي لتحديد نطاق الصرف؛ الفاتورة من البرنامج المحاسبي. للاطلاع ومتابعة الصرف فقط."
      />

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex min-w-0 flex-1 items-center">
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
            value={fnSearch}
            onChange={(e) => setFnSearch(e.target.value)}
            placeholder="رقم الكشف أو رقم صك ضمنه…"
            aria-label="بحث كشوف الفوترة"
            className="w-full max-w-[320px] rounded-lg border border-border-md bg-surface py-2 pe-3.5 ps-[38px] text-[13px] text-text outline-none focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)]"
          />
        </div>
        <span className="ms-auto rounded-full bg-gold-soft px-3 py-[5px] text-[12px] font-bold text-gold-d">
          {filteredFns.length} كشف
        </span>
      </div>

      {/* Phones: one card per statement; tapping opens the same invoice modal. */}
      <MobileRecordList
        className="lg:hidden"
        isEmpty={filteredFns.length === 0}
        empty="لا توجد كشوف مطابقة."
      >
        {filteredFns.map((s) => {
          const meta = statementMeta(s);
          return (
            <MobileRecordCard
              key={s.id}
              tone={openFn === s.referenceNumber ? "gold" : undefined}
              onOpen={() => setOpenFn(s.referenceNumber)}
              title={<bdi dir="ltr" className="tabular-nums">{s.referenceNumber}</bdi>}
              status={<StatusPill label={meta.label} style={meta.style} />}
              fields={[
                {
                  label: "تاريخ الإصدار",
                  ltr: true,
                  value: formatYmd(s.issuedAtUtc ?? s.createdAtUtc),
                },
                {
                  label: "الإجمالي",
                  ltr: true,
                  value: fmtSar(s.totalNetSar, { digits: 3, trim: true }),
                },
                { label: "المعاملات", value: `${s.lines.length} معاملات` },
                { label: "الصرف", wide: true, value: <StatementPayout s={s} wrap /> },
              ]}
            />
          );
        })}
      </MobileRecordList>
      <p className="m-0 text-[12px] text-text-3 lg:hidden">
        {STATEMENTS_FOOTER} اضغط بطاقة لفتح تفاصيل الكشف.
      </p>

      <TableFrame className="max-lg:hidden">
        <Table className="min-w-[820px]">
          <THead>
            <Tr hoverable={false}>
              <Th>رقم الكشف</Th>
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
                لا توجد كشوف مطابقة.
              </TableEmptyRow>
            ) : (
              filteredFns.map((s) => {
                const selected = openFn === s.referenceNumber;
                const meta = statementMeta(s);
                return (
                  <Tr
                    key={s.id}
                    hoverable={false}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "cursor-pointer [&:hover_td]:bg-row-hover",
                      selected && "[&_td]:bg-row-hover",
                    )}
                    onClick={() => setOpenFn(s.referenceNumber)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenFn(s.referenceNumber);
                      }
                    }}
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
                      <StatusPill label={meta.label} style={meta.style} />
                    </Td>
                    <Td className="text-[11px] text-text-2">
                      <StatementPayout s={s} />
                    </Td>
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
        <div className="border-t border-border px-4 py-[11px] text-[12px] text-text-3">
          {STATEMENTS_FOOTER} اضغط صفاً لفتح تفاصيل الكشف.
        </div>
      </TableFrame>
    </>
  );
}
