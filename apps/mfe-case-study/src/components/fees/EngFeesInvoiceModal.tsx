"use client";

/**
 * Statement detail modal of `EngFeesHtmlScreen`: statement lines, the vendor
 * invoice upload form while the statement is issued, and the payment record.
 */

import {
  cn,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  opsInsetPanel,
  StatusPill,
} from "@platform/ui-kit";
import type { PartyBillingStatementDto } from "@platform/api-client";
import { openPartyBillingAttachment } from "@platform/app-shared/app-data/party-billing-statements-api";
import { ymd as formatYmd } from "@platform/app-shared/format/date";
import { VendorInvoicePdfField } from "./VendorInvoicePdfField";
import { fmtSar, statementMeta } from "./eng-fees-state";

export function EngFeesInvoiceModal({
  openStatement,
  closeStatementModal,
  invoiceNo,
  setInvoiceNo,
  invoiceDate,
  setInvoiceDate,
  invoiceFile,
  setInvoiceFile,
  busyId,
  submitInvoice,
  showToast,
}: {
  openStatement: PartyBillingStatementDto | null;
  closeStatementModal: () => void;
  invoiceNo: string;
  setInvoiceNo: (v: string) => void;
  invoiceDate: string;
  setInvoiceDate: (v: string) => void;
  invoiceFile: File | null;
  setInvoiceFile: (v: File | null) => void;
  busyId: string | null;
  submitInvoice: (s: PartyBillingStatementDto) => Promise<void>;
  showToast: (message: string, tone?: "success" | "error" | "info") => void;
}) {
  return (
    <>
      {openStatement ? (
        <ModalOverlay
          role="presentation"
          className="!items-center !justify-center bg-[rgba(16,43,78,0.42)] backdrop-blur-[2px] max-lg:!items-center"
          onClick={closeStatementModal}
        >
          <ModalCard
            wide
            role="dialog"
            aria-modal="true"
            aria-labelledby="eng-statement-modal-title"
            className="max-w-[560px] overflow-hidden rounded-2xl border border-border shadow-[0_24px_60px_-18px_rgba(16,43,78,0.45)] max-lg:max-w-[min(100%,560px)] max-lg:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader className="relative flex-col items-stretch gap-0 border-b border-border bg-[linear-gradient(180deg,color-mix(in_srgb,var(--gold)_10%,transparent),transparent)] px-5 pb-4 pt-5">
              <ModalClose
                onClick={closeStatementModal}
                aria-label="إغلاق"
                className="absolute start-3 top-3 grid h-8 w-8 place-items-center rounded-lg bg-surface text-[15px] text-text-2 hover:bg-surface-2 hover:text-heading"
              >
                ✕
              </ModalClose>
              <div className="flex flex-col items-center gap-2.5 px-6 text-center">
                <StatusPill
                  label={statementMeta(openStatement).label}
                  style={statementMeta(openStatement).style}
                />
                <ModalTitle
                  id="eng-statement-modal-title"
                  className="m-0 flex-none text-center text-[17px] font-extrabold tracking-tight text-heading"
                >
                  كشف{" "}
                  <span
                    dir="ltr"
                    className="inline-block font-extrabold text-gold-d [unicode-bidi:isolate]"
                  >
                    {openStatement.referenceNumber}
                  </span>
                </ModalTitle>
                <div className="flex flex-wrap items-center justify-center gap-1.5 text-[12px] text-text-2">
                  <span
                    dir="ltr"
                    className="rounded-full bg-surface px-2.5 py-0.5 tabular-nums [unicode-bidi:isolate]"
                  >
                    {formatYmd(
                      openStatement.issuedAtUtc ??
                        openStatement.createdAtUtc,
                    )}
                  </span>
                  <span className="rounded-full bg-surface px-2.5 py-0.5">
                    {openStatement.lines.length} معاملات
                  </span>
                  <span className="rounded-full bg-surface px-2.5 py-0.5 font-bold tabular-nums text-heading">
                    {fmtSar(openStatement.totalNetSar)}
                  </span>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="max-h-[min(68vh,520px)] space-y-4 px-5 py-5">
              <div className="text-center text-[12px] font-bold text-text-2">
                معاملات الكشف
              </div>
              <div className="grid gap-2.5">
                {openStatement.lines.map((line) => (
                  <div
                    key={line.id}
                    className={cn(opsInsetPanel, "px-3.5 py-3")}
                  >
                    <div className="mb-2.5 text-center">
                      <div
                        dir="ltr"
                        className="text-[13px] font-extrabold text-gold-d [unicode-bidi:isolate]"
                      >
                        {line.propertyLabel}
                      </div>
                      {line.poNumber ? (
                        <div
                          dir="ltr"
                          className="mt-0.5 text-[11.5px] text-text-3 [unicode-bidi:isolate]"
                        >
                          {line.poNumber}
                        </div>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-t border-border/80 pt-2.5">
                      <div className="text-center">
                        <div className="mb-0.5 text-[10px] text-text-3">
                          الحالة
                        </div>
                        <div className="text-[11.5px] font-semibold text-text-2">
                          {line.billingStatusLabel || "—"}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="mb-0.5 text-[10px] text-text-3">
                          المصدر
                        </div>
                        <div className="text-[11.5px] font-semibold text-text-2">
                          بسعر الجدول
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="mb-0.5 text-[10px] text-text-3">
                          الصافي
                        </div>
                        <div className="text-[13px] font-extrabold tabular-nums text-heading">
                          {fmtSar(line.netFeeSar)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {openStatement.status === "issued" &&
              openStatement.payeeType !== "individual" ? (
                <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-3.5 text-start">
                  <div className="text-center text-[12.5px] font-semibold text-heading">
                    رفع فاتورة مطابقة للمسير
                    <span className="mt-0.5 block text-[11px] font-normal text-text-3">
                      القيمة مقفلة {fmtSar(openStatement.totalNetSar)}
                    </span>
                  </div>
                  <label className="text-[12px] text-text-2">
                    رقم الفاتورة *
                    <input
                      className="mt-1 w-full rounded-lg border border-border-md bg-surface px-3 py-2 text-center text-[13px]"
                      value={invoiceNo}
                      onChange={(e) => setInvoiceNo(e.target.value)}
                      dir="ltr"
                    />
                  </label>
                  <label className="text-[12px] text-text-2">
                    تاريخ الفاتورة
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-border-md bg-surface px-3 py-2 text-center text-[13px]"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                    />
                  </label>
                  <VendorInvoicePdfField
                    busy={busyId === openStatement.id}
                    disabled={busyId === openStatement.id}
                    file={invoiceFile}
                    onPick={setInvoiceFile}
                    onClear={() => setInvoiceFile(null)}
                  />
                  <button
                    type="button"
                    disabled={
                      busyId === openStatement.id ||
                      !invoiceFile ||
                      !invoiceNo.trim()
                    }
                    className="mt-0.5 w-full cursor-pointer rounded-lg border-none bg-[var(--ink,#102B4E)] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,.55)] disabled:cursor-not-allowed disabled:opacity-45"
                    onClick={() => void submitInvoice(openStatement)}
                  >
                    {busyId === openStatement.id
                      ? "جاري الإرسال…"
                      : "إرسال الفاتورة"}
                  </button>
                </div>
              ) : null}

              {openStatement.status === "closed" ? (
                <div className="rounded-xl border border-[color-mix(in_srgb,#3f8f5f_28%,transparent)] bg-[color-mix(in_srgb,#3f8f5f_10%,transparent)] px-3.5 py-3 text-center">
                  <div className="text-[13px] font-bold text-[#2f7a4d]">
                    تم صرف هذا الكشف
                  </div>
                  {openStatement.vendorInvoiceNumber ? (
                    <div className="mt-1 text-[12px] text-text-2">
                      رقم الفاتورة:{" "}
                      <b
                        dir="ltr"
                        className="tabular-nums [unicode-bidi:isolate]"
                      >
                        {openStatement.vendorInvoiceNumber}
                      </b>
                    </div>
                  ) : null}
                  {openStatement.paidAtUtc ? (
                    <div className="mt-0.5 text-[11.5px] text-text-3">
                      تاريخ الصرف:{" "}
                      <span
                        dir="ltr"
                        className="tabular-nums [unicode-bidi:isolate]"
                      >
                        {formatYmd(openStatement.paidAtUtc)}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : openStatement.status === "invoice_received" ? (
                <div className="rounded-xl border border-[color-mix(in_srgb,#4a7ab5_30%,transparent)] bg-[color-mix(in_srgb,#4a7ab5_10%,transparent)] px-3.5 py-3 text-center text-[12.5px] text-text-2">
                  وُجدت فاتورة واردة — بانتظار صرف المالية.
                  {openStatement.vendorInvoiceNumber ? (
                    <div className="mt-1">
                      رقم الفاتورة:{" "}
                      <b
                        dir="ltr"
                        className="tabular-nums [unicode-bidi:isolate]"
                      >
                        {openStatement.vendorInvoiceNumber}
                      </b>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {openStatement.transferReceiptAttachmentId ? (
                <div className="flex justify-center">
                  <button
                    type="button"
                    className="cursor-pointer rounded-lg border border-border-md bg-surface px-4 py-2 text-[12.5px] font-semibold text-heading transition-colors hover:border-gold hover:bg-[color-mix(in_srgb,var(--gold)_10%,transparent)]"
                    onClick={() => {
                      void openPartyBillingAttachment(
                        openStatement.transferReceiptAttachmentId!,
                      ).then((r) => {
                        if (!r.ok) showToast(r.error, "error");
                      });
                    }}
                  >
                    عرض إيصال التحويل
                  </button>
                </div>
              ) : null}
            </ModalBody>
          </ModalCard>
        </ModalOverlay>
      ) : null}
    </>
  );
}
