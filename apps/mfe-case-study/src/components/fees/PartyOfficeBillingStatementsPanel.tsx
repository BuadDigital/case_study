"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadPartyBillingStatements,
  openPartyBillingAttachment,
  runSubmitVendorInvoice,
  uploadPartyBillingVendorInvoice,
} from "@platform/app-shared/prototype/party-billing-statements-api";
import {
  Button,
  Input,
  OperationalToolbarSearch,
  PageToolbar,
  SkeletonTableRows,
  StatusPill,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  queueTableWrapClassName,
  useToast,
  type StatusPillStyle,
} from "@platform/design-system";
import type { PartyBillingStatementDto } from "@platform/api-client";
import { EngFeesSectionTitle } from "./EngFeesHtmlTabs";
import { VendorInvoicePdfField } from "./VendorInvoicePdfField";

function fmtSar(n: number): string {
  return `${Number(n || 0).toLocaleString("en-US")} ر.س`;
}

function formatYmd(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

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

/**
 * Case Study.html `renderEngFees` statements tab — expandable كشف rows,
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
  const [invoiceDate, setInvoiceDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: statements = [], isPending, isFetched } = useQuery({
    queryKey: [
      ...prototypeKeys.all,
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

  const submitInvoice = async (s: PartyBillingStatementDto, file?: File) => {
    if (!invoiceNo.trim()) {
      showToast("رقم الفاتورة مطلوب", "error");
      return;
    }
    if (!file) {
      showToast("ارفع PDF الفاتورة", "error");
      return;
    }
    setBusyId(s.id);
    try {
      const upload = await uploadPartyBillingVendorInvoice(s.id, file);
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
        `رُفعت الفاتورة — القيمة مقفلة ${fmtSar(s.totalNetSar)}`,
        "success",
      );
      setInvoiceNo("");
      await queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "party-billing"],
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

  return (
    <div className="flex flex-col gap-0">
      <EngFeesSectionTitle
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

      <div
        className={cn(
          queueTableWrapClassName,
          "rounded-b-[var(--radius-lg)] border border-t-0 border-border bg-surface",
        )}
      >
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
                const paidLabel = formatYmd(s.paidAtUtc);
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
                      <Td dir="ltr" className="text-[12px] text-text-2">
                        {formatYmd(s.issuedAtUtc ?? s.createdAtUtc)}
                      </Td>
                      <Td className="text-[12.5px] text-text">
                        {s.lines.length} معاملات
                      </Td>
                      <Td className="text-[13px] font-bold text-heading">
                        {fmtSar(s.totalNetSar)}
                      </Td>
                      <Td>
                        <StatusPill label={meta.label} style={meta.style} />
                      </Td>
                      <Td className="text-[11px] text-text-2">
                        {s.status === "closed" && s.paidAtUtc ? (
                          <span className="inline-flex min-w-0 flex-col gap-px">
                            <span>
                              صُرف {paidLabel}
                              {s.externalInvoiceNumber ? (
                                <>
                                  {" "}
                                  — فاتورة{" "}
                                  <b dir="ltr">{s.externalInvoiceNumber}</b>
                                </>
                              ) : null}
                            </span>
                            <span className="truncate text-text-3">
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
                        )}
                      </Td>
                    </Tr>
                    {open ? (
                      <Tr hoverable={false}>
                        <Td
                          colSpan={6}
                          className="!bg-surface-2 !p-0 border-b border-border"
                        >
                          <div className="px-[18px] py-3">
                            <div className="mb-2 text-[11.5px] font-bold text-text-2">
                              معاملات الكشف {s.referenceNumber}
                            </div>
                            <div className="grid gap-1.5">
                              {s.lines.map((line) => (
                                <div
                                  key={line.id}
                                  className="grid grid-cols-[minmax(115px,1fr)_minmax(105px,1.1fr)_minmax(85px,.8fr)_minmax(85px,.8fr)] items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px]"
                                >
                                  <span
                                    dir="ltr"
                                    className="text-end font-bold text-gold-d"
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
                                    {fmtSar(line.netFeeSar)}
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
                                  {fmtSar(s.totalNetSar)})
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
                                  onPick={(file) => {
                                    void submitInvoice(s, file);
                                  }}
                                />
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
      </div>

      <div className="border border-t-0 border-border px-4 py-[11px] text-[12px] text-text-3">
        دورة الكشف: مسودة ← صادر ← محال للمالية ← مصروف. الفاتورة تصدر من البرنامج
        المحاسبي خارج النظام، ويُوثَّق الصرف هنا برقم الفاتورة وإيصال التحويل
        والتاريخ. البنود المتحفَّظ عليها تُعالَج بالتنسيق مع المشرف قبل إحالتها
        للمالية.
      </div>
    </div>
  );
}
