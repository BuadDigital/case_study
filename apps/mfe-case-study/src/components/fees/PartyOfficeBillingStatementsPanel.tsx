"use client";

import { fmtSar } from "@platform/app-shared/format/number";
import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  loadPartyBillingStatements,
  openPartyBillingAttachment,
  runSubmitVendorInvoice,
  uploadPartyBillingVendorInvoice,
} from "@platform/app-shared/app-data/party-billing-statements-api";
import {
  Button,
  Input,
  MobileRecordCard,
  MobileRecordList,
  OperationalToolbarSearch,
  PageToolbar,
  SkeletonTableRows,
  StatusPill,
  Table,
  TableFrame,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
  cn,
  useToast,
  type StatusPillStyle,
} from "@platform/ui-kit";
import type { PartyBillingStatementDto } from "@platform/api-client";
import { EngFeesSectionTitle } from "./EngFeesHtmlTabs";
import { VendorInvoicePdfField } from "./VendorInvoicePdfField";
import { statementCardFields } from "./FeeLedgerParts";
import { todayIso, ymd as formatYmd } from "@platform/app-shared/format/date";
import { opsLetterCard } from "../../lib/app-data/ops-tasks-tw";


function statementStatusMeta(s: PartyBillingStatementDto): {
  label: string;
  style: StatusPillStyle;
} {
  if (s.status === "closed") {
    return {
      label: s.statusLabel || "مدفوع",
      style: { base: "#3f8f5f", fg: "#2f7a4d" },
    };
  }
  if (s.status === "invoice_received") {
    return {
      label: s.statusLabel || "فاتورة واردة",
      style: { base: "#d9a441", fg: "#8a5e14" },
    };
  }
  if (s.status === "issued") {
    return {
      label: s.statusLabel || "أُرسل",
      style: { base: "#22406e", fg: "#102B4E" },
    };
  }
  if (s.status === "cancelled") {
    return {
      label: s.statusLabel || "ملغى",
      style: { base: "#9ca3af", fg: "#6b7280" },
    };
  }
  return {
    label: s.statusLabel || "مسودة",
    style: { base: "#6b7c8f", fg: "#4a5568" },
  };
}

const STATEMENTS_FOOTER =
  "دورة الكشف: مسودة ← صادر ← محال للمالية ← مصروف. الفاتورة تصدر من البرنامج المحاسبي خارج النظام، ويُوثَّق الصرف هنا برقم الفاتورة وإيصال التحويل والتاريخ. البنود المتحفَّظ عليها تُعالَج بالتنسيق مع المشرف قبل إحالتها للمالية.";

/**
 * Case Study.html `renderEngFees` statements tab — expandable statement rows,
 * search toolbar, cycle footer. Office read-only.
 */
export function PartyOfficeBillingStatementsPanel({
  assigneeId,
  issuedOrLaterOnly = true,
}: {
  assigneeId?: string;
  /** Supervisor may see all issued statements when assigneeId is omitted. */
  issuedOrLaterOnly?: boolean;
}) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayIso);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: statements = [], isPending, isFetched } = useQuery({
    queryKey: [
      ...appDataKeys.all,
      "party-billing",
      "statements",
      assigneeId ?? "all",
      issuedOrLaterOnly ? "issued+" : "all-status",
    ],
    queryFn: () =>
      loadPartyBillingStatements({
        assigneeId,
        issuedOrLaterOnly,
      }),
  });

  const submitInvoice = async (s: PartyBillingStatementDto) => {
    if (!invoiceNo.trim()) {
      showToast("رقم الفاتورة مطلوب", "error");
      return;
    }
    if (!invoiceFile) {
      showToast("اختر ملف الفاتورة أولاً", "error");
      return;
    }
    setBusyId(s.id);
    try {
      const upload = await uploadPartyBillingVendorInvoice(s.id, invoiceFile);
      if (!upload.ok) {
        showToast(upload.error, "error");
        return;
      }
      const result = await runSubmitVendorInvoice(s.id, {
        invoiceNumber: invoiceNo.trim(),
        invoiceDate: invoiceDate
          ? new Date(`${invoiceDate}T12:00:00`).toISOString()
          : undefined,
        attachmentId: upload.id,
      });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast(
        `رُفعت الفاتورة — القيمة مقفلة ${fmtSar(s.totalNetSar, { digits: 3, trim: true })}`,
        "success",
      );
      setInvoiceNo("");
      setInvoiceFile(null);
      await queryClient.invalidateQueries({
        queryKey: [...appDataKeys.all, "party-billing"],
      });
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return statements;
    return statements.filter((s) => {
      if (s.referenceNumber.toLowerCase().includes(q)) return true;
      return s.lines.some(
        (line) =>
          line.propertyLabel.toLowerCase().includes(q) ||
          line.poNumber.toLowerCase().includes(q),
      );
    });
  }, [statements, search]);

  const viewReceipt = async (attachmentId: string) => {
    const result = await openPartyBillingAttachment(
      attachmentId,
      "إيصال-التحويل",
    );
    if (!result.ok) showToast(result.error, "error");
  };

  const pending = isPending && !isFetched;

  // Shared by the table row and the phone card.
  const renderPayout = (s: PartyBillingStatementDto, wrap = false) =>
    s.status === "closed" && s.paidAtUtc ? (
      <span className="inline-flex min-w-0 flex-col gap-px">
        <span>
          صُرف {formatYmd(s.paidAtUtc)}
          {s.externalInvoiceNumber ? (
            <>
              {" "}
              — فاتورة{" "}
              <b dir="ltr">{s.externalInvoiceNumber}</b>
            </>
          ) : null}
        </span>
        <span className={cn("text-text-3", !wrap && "truncate")}>
          {s.transferReceiptAttachmentId ? (
            <button
              type="button"
              className="border-none bg-transparent p-0 text-start font-[inherit] text-[11px] text-text-3 underline-offset-2 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                void viewReceipt(
                  s.transferReceiptAttachmentId!,
                );
              }}
            >
              📎 إيصال التحويل
              {s.transferReceiptRef
                ? ` · مرجع ${s.transferReceiptRef}`
                : ""}
            </button>
          ) : s.transferReceiptRef ? (
            <>📎 مرجع {s.transferReceiptRef}</>
          ) : (
            "موثَّق الصرف"
          )}
        </span>
      </span>
    ) : (
      "بانتظار الصرف"
    );

  const renderDetail = (s: PartyBillingStatementDto) => (
    <>
      <div className="mb-2 text-[11.5px] font-bold text-text-2">
        معاملات الكشف {s.referenceNumber}
      </div>
      <div className="grid gap-1.5">
        {s.lines.map((line) => (
          <div
            key={line.id}
            className="grid grid-cols-2 items-center gap-2.5 lg:grid-cols-[minmax(115px,1fr)_minmax(105px,1.1fr)_minmax(85px,.8fr)_minmax(85px,.8fr)] rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px]"
          >
            <span
              dir="ltr"
              className="text-start font-bold text-gold-d lg:text-end"
            >
              {line.propertyLabel}
            </span>
            <span className="text-text-2">
              {line.poNumber || "—"}
            </span>
            <span className="text-[11px] text-text-3">
              {line.billingStatusLabel || "—"}
            </span>
            <span className="font-bold text-heading">
              {fmtSar(line.netFeeSar, { digits: 3, trim: true })}
            </span>
          </div>
        ))}
      </div>
      {s.status === "issued" &&
      s.payeeType !== "individual" ? (
        <div
          className="mt-3 flex flex-col gap-2 rounded border border-border bg-surface-2 p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[12px] font-semibold text-text">
            رفع فاتورة مطابقة للمسير (القيمة مقفلة{" "}
            {fmtSar(s.totalNetSar, { digits: 3, trim: true })})
          </div>
          <label className="text-[12px] text-text-2">
            رقم الفاتورة *
            <Input
              className="mt-1"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              dir="ltr"
            />
          </label>
          <label className="text-[12px] text-text-2">
            تاريخ الفاتورة
            <Input
              className="mt-1"
              type="date"
              value={invoiceDate}
              onChange={(e) =>
                setInvoiceDate(e.target.value)
              }
            />
          </label>
          <VendorInvoicePdfField
            busy={busyId === s.id}
            disabled={busyId === s.id}
            file={invoiceFile}
            onPick={setInvoiceFile}
            onClear={() => setInvoiceFile(null)}
          />
          <button
            type="button"
            disabled={
              busyId === s.id ||
              !invoiceFile ||
              !invoiceNo.trim()
            }
            className="mt-0.5 w-full cursor-pointer rounded-lg border-none bg-[var(--ink,#102B4E)] px-4 py-2.5 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => void submitInvoice(s)}
          >
            {busyId === s.id
              ? "جاري الإرسال…"
              : "إرسال الفاتورة"}
          </button>
        </div>
      ) : null}
      {s.status === "invoice_received" ? (
        <div className="mt-2 text-[12px] text-text-2">
          فاتورة {s.vendorInvoiceNumber} تحت المراجعة من
          المالية
          {s.vendorInvoiceMatched
            ? " — طُوبقت"
            : " — بانتظار المطابقة"}
        </div>
      ) : null}
      {s.rejectedInvoices?.length ? (
        <div className="mt-2 text-[11px] text-danger">
          آخر إعادة:{" "}
          {
            s.rejectedInvoices[
              s.rejectedInvoices.length - 1
            ]?.reason
          }
        </div>
      ) : null}
      {s.status === "closed" &&
      s.transferReceiptAttachmentId ? (
        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              void viewReceipt(
                s.transferReceiptAttachmentId!,
              )
            }
          >
            عرض / تنزيل إيصال التحويل
          </Button>
        </div>
      ) : null}
    </>
  );

  return (
    <section className={opsLetterCard}>
      <div className="px-4 pb-4 pt-1 sm:px-[18px]">
        <EngFeesSectionTitle
          className="mb-3 mt-3"
          title="كشوف الفوترة الصادرة"
          sub="يُصدرها المحاسب نهاية الشهر من البنود الجاهزة فقط — مستند داخلي لتحديد نطاق الصرف؛ الفاتورة من البرنامج المحاسبي. للاطلاع ومتابعة الصرف فقط."
        />

        <PageToolbar className="mt-0 shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-border bg-surface-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
            <OperationalToolbarSearch
              type="search"
              placeholder="رقم الكشف أو رقم صك ضمنه…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="بحث كشوف الفوترة"
            />
            <span className="ms-auto shrink-0 rounded-full bg-gold-soft px-3 py-[5px] text-[12px] font-bold text-gold-d">
              {filtered.length} كشف
            </span>
          </div>
        </PageToolbar>

        {/* Phones: one card per statement; tap to expand its lines and invoice upload. */}
        <MobileRecordList
          className="mt-3 lg:hidden"
          isEmpty={filtered.length === 0}
          empty={pending ? "جاري التحميل…" : "لا توجد كشوف مطابقة."}
        >
          {filtered.map((s) => {
            const open = openRef === s.referenceNumber;
            const meta = statementStatusMeta(s);
            return (
              <MobileRecordCard
                key={s.id}
                tone={open ? "gold" : undefined}
                onOpen={() => setOpenRef(open ? null : s.referenceNumber)}
                title={<bdi dir="ltr" className="tabular-nums">{s.referenceNumber}</bdi>}
                status={<StatusPill label={meta.label} style={meta.style} />}
                fields={statementCardFields(s, renderPayout(s, true), true)}
              >
                {open ? (
                  <div
                    className="rounded-[10px] bg-surface-2 p-2.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {renderDetail(s)}
                  </div>
                ) : (
                  <span className="text-[11.5px] text-text-3">اضغط لعرض المعاملات</span>
                )}
              </MobileRecordCard>
            );
          })}
        </MobileRecordList>
        <p className="m-0 mt-3 text-[12px] text-text-3 lg:hidden">{STATEMENTS_FOOTER}</p>

        <TableFrame className="max-lg:hidden">
        <Table className="w-full min-w-[820px]" pending={pending}>
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
            {pending && filtered.length === 0 ? (
              <SkeletonTableRows rows={4} cols={6} />
            ) : filtered.length === 0 ? (
              <Tr hoverable={false}>
                <Td
                  colSpan={6}
                  className="!py-10 text-center text-[13px] text-text-3"
                >
                  لا توجد كشوف مطابقة.
                </Td>
              </Tr>
            ) : (
              filtered.map((s) => {
                const open = openRef === s.referenceNumber;
                const meta = statementStatusMeta(s);
                return (
                  <Fragment key={s.id}>
                    <Tr
                      hoverable={false}
                      className={cn(
                        "cursor-pointer",
                        open && "bg-[var(--row-hover,#faf6ee)]",
                      )}
                      onClick={() =>
                        setOpenRef(open ? null : s.referenceNumber)
                      }
                    >
                      <Td>
                        <span className="inline-flex items-center gap-1.5">
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={cn(
                              "text-text-3 transition-transform duration-150",
                              open && "rotate-90",
                            )}
                            aria-hidden
                          >
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                          <span
                            dir="ltr"
                            className="text-[12.5px] font-bold text-gold-d"
                          >
                            {s.referenceNumber}
                          </span>
                        </span>
                      </Td>
                      <TdLtr valueClassName="text-[12px] text-text-2">
                        {formatYmd(s.issuedAtUtc ?? s.createdAtUtc)}
                      </TdLtr>
                      <Td className="text-[12.5px] text-text">
                        {s.lines.length} معاملات
                      </Td>
                      <TdLtr valueClassName="text-[13px] font-bold text-heading">
                        {fmtSar(s.totalNetSar, { digits: 3, trim: true })}
                      </TdLtr>
                      <Td>
                        <StatusPill label={meta.label} style={meta.style} />
                      </Td>
                      <Td className="text-[11px] text-text-2">
                        {renderPayout(s)}
                      </Td>
                    </Tr>
                    {open ? (
                      <Tr hoverable={false}>
                        <Td
                          colSpan={6}
                          className="!bg-surface-2 !p-0 border-b border-border"
                        >
                          <div className="px-[18px] py-3">
                            {renderDetail(s)}
                          </div>
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
          {STATEMENTS_FOOTER}
        </div>
      </TableFrame>
      </div>
    </section>
  );
}
