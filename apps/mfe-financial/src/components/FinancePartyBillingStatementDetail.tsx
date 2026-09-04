"use client";

import {
  Input,
  StatusPill,
  TBody,
  THead,
  Table,
  TableFrame,
  Td,
  TdLtr,
  Th,
  Tr,
  cn,
  finStatusStyle,
  opsBtnGhost,
  opsBtnPrimary,
  opsFld,
  opsInsetPanel,
  opsLetterCard,
  opsPanelCard,
} from "@platform/ui-kit";
import type { PartyBillingStatementDto } from "@platform/api-client";

import {
  partyBillingWorkflowLabel,
  partyBillingWorkflowTone,
  statementDisplayTotal,
} from "../lib/finance-cost-parties";
import { finMuted, finWorkFlush, finWorkHead, finWorkTitle } from "../lib/finance-tw";
import { FinanceReceiptUploadField } from "./FinanceReceiptUploadField";
import {
  MetaCell,
  formatInvoiceDate,
  formatSar,
} from "./FinancePartyBillingParts";
import type { PartyBillingStatementsWorkflow } from "./usePartyBillingStatementsWorkflow";

/**
 * One statement in full: its lines, the amount summary, and whichever action
 * panel its status calls for — issue, vendor-invoice matching, disbursement
 * documentation, or the paid/cancelled banner.
 */
export function FinancePartyBillingStatementDetail({
  selectedStatement,
  workflow,
}: {
  selectedStatement: PartyBillingStatementDto;
  workflow: PartyBillingStatementsWorkflow;
}) {
  const {
    busy,
    closeDetail,
    issueStatement,
    cancelReason,
    setCancelReason,
    cancelStatement,
    viewReceipt,
    matchInvoice,
    rejectReason,
    setRejectReason,
    rejectInvoice,
    disbursementVoucher,
    setDisbursementVoucher,
    transferReference,
    setTransferReference,
    paidAt,
    setPaidAt,
    uploadingReceipt,
    receiptAttachmentId,
    receiptFileName,
    handleReceiptFile,
    receiptRef,
    setReceiptRef,
    closeStatement,
  } = workflow;

  return (
    <div className={finWorkFlush}>
      <div className="flex flex-col gap-3">
        <div className={finWorkHead}>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              className={cn(opsBtnGhost, "h-auto px-2.5 py-1.5 text-[11.5px]")}
              onClick={closeDetail}
            >
              ‹ إغلاق
            </button>
            <div>
              <div className={finWorkTitle} dir="ltr">
                {selectedStatement.referenceNumber}
              </div>
              <div className={cn(finMuted, "mt-1")}>
                {formatSar(
                  statementDisplayTotal(selectedStatement),
                )}{" "}
                · {selectedStatement.lines.length} معاملة
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill
              label={selectedStatement.payeeTypeLabel}
              style={finStatusStyle(
                selectedStatement.payeeType === "individual"
                  ? "individual"
                  : "default",
              )}
            />
            <StatusPill
              label={partyBillingWorkflowLabel(selectedStatement)}
              style={finStatusStyle(
                partyBillingWorkflowTone(selectedStatement),
              )}
            />
          </div>
        </div>

        <div className={opsLetterCard}>
          <div className="border-b border-border bg-surface-2 px-3.5 py-2.5 text-xs font-bold text-heading">
            معاملات{" "}
            {selectedStatement.payeeType === "individual"
              ? "أمر الصرف"
              : "مسير الصرف"}
          </div>
          <TableFrame className="rounded-[12px]">
            <Table wrapClassName="max-h-[220px] overflow-auto">
              <THead>
                <Tr hoverable={false}>
                  <Th>المرجع</Th>
                  <Th>البيان</Th>
                  <Th className="text-center">المبلغ</Th>
                </Tr>
              </THead>
              <TBody>
                {selectedStatement.lines.map((line) => (
                  <Tr key={line.id} hoverable={false}>
                    <TdLtr valueClassName="text-[12.5px] font-bold text-gold-d">
                      {line.propertyLabel || line.poNumber || "—"}
                    </TdLtr>
                    <Td>
                      <span className="text-[11.5px] text-text-2">
                        {line.poNumber ? `أمر عمل ${line.poNumber}` : "—"}
                      </span>
                    </Td>
                    <TdLtr
                      className="text-center"
                      valueClassName="text-[12.5px] font-bold text-heading"
                    >
                      {formatSar(line.netFeeSar)}
                    </TdLtr>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableFrame>
        </div>

        {selectedStatement.payeeType === "vendor" &&
        selectedStatement.totalNetSar > 0 ? (
          <div className={opsLetterCard}>
            <div className="border-b border-border bg-surface-2 px-3.5 py-2 text-[11.5px] font-bold text-heading">
              ملخص المبالغ
            </div>
            {[
              ["صافي الأتعاب", selectedStatement.totalNetSar, false],
              [
                "ضريبة القيمة المضافة (15%)",
                Math.round(selectedStatement.totalNetSar * 0.15 * 100) /
                  100,
                false,
              ],
              [
                "الإجمالي — تُطابقه فاتورة المورّد",
                statementDisplayTotal(selectedStatement),
                true,
              ],
            ].map(([label, val, bold]) => (
              <div
                key={String(label)}
                className={cn(
                  "flex items-center justify-between gap-4 px-3.5 py-2",
                  bold && "border-t border-border bg-[#faf8f3]",
                )}
              >
                <span
                  className={cn(
                    bold
                      ? "text-[12.5px] font-extrabold text-heading"
                      : "text-xs font-medium text-text-2",
                  )}
                >
                  {label as string}
                </span>
                <span
                  className="shrink-0 text-[12.5px] font-bold text-heading tabular-nums"
                  dir="ltr"
                >
                  {formatSar(val as number)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {selectedStatement.status === "draft" ? (
          <div className={cn(opsPanelCard, "p-4")}>
            <button
              type="button"
              className={cn(opsBtnPrimary, "w-full justify-center py-3")}
              disabled={busy}
              onClick={() => void issueStatement(selectedStatement)}
            >
              {selectedStatement.payeeType === "vendor"
                ? "تحويل المسير للمكتب لإصدار الفاتورة"
                : "اعتماد وإصدار أمر الصرف"}
            </button>
            {selectedStatement.payeeType === "vendor" ? (
              <p className="m-0 mt-2.5 text-center text-[10.5px] leading-[1.7] text-text-3">
                يُرسل مسير الصرف للمورّد ليُصدر فاتورة ضريبية مطابقة
                لقيمته وبنوده.
              </p>
            ) : null}
            <div className="mt-4 border-t border-dashed border-border-md pt-3">
              <div className={opsFld}>
                <label className="text-xs font-semibold text-text-2">
                  إلغاء المستند
                </label>
                <Input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="سبب الإلغاء"
                />
              </div>
              <button
                type="button"
                className={cn(
                  opsBtnGhost,
                  "mt-2 w-full justify-center text-[#a5432e]",
                )}
                disabled={busy}
                onClick={() => void cancelStatement(selectedStatement)}
              >
                إلغاء المستند وإرجاع بنوده مفتوحة
              </button>
            </div>
          </div>
        ) : null}

        {selectedStatement.status === "issued" &&
        selectedStatement.payeeType === "vendor" ? (
          <div className={cn(opsInsetPanel, "px-4 py-3.5")}>
            <div className="flex gap-2.5">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#8c7857"
                strokeWidth="1.9"
                className="mt-0.5 shrink-0"
                aria-hidden
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" strokeLinecap="round" />
              </svg>
              <div>
                <div className="text-[12.5px] font-bold text-heading">
                  بانتظار رفع المورّد لفاتورته
                </div>
                <div className="mt-1 text-[11px] leading-[1.7] text-text-2">
                  أُرسل مسير الصرف للمورّد؛ يُصدر فاتورته من برنامجه
                  المحاسبي ويرفعها على المسير من بوابته.
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {selectedStatement.status === "invoice_received" ? (
          <div className={opsLetterCard}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2 px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="text-[12.5px] font-bold text-heading">
                  فاتورة المورّد
                </div>
                <div className="mt-0.5 text-[11px] text-text-3">
                  وردت من بوابة المورّد
                </div>
              </div>
              {selectedStatement.vendorInvoiceMatched ? (
                <span className="shrink-0 rounded-md bg-[color-mix(in_srgb,#3f8f5f_12%,transparent)] px-2 py-1 text-[11px] font-bold text-[#2f7a4d]">
                  طُوبقت — جاهزة للصرف
                </span>
              ) : (
                <span className="shrink-0 rounded-md bg-[color-mix(in_srgb,#d9a441_14%,transparent)] px-2 py-1 text-[11px] font-bold text-[#8a5e14]">
                  بانتظار المطابقة
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 p-3.5 sm:grid-cols-3">
              <MetaCell
                label="رقم الفاتورة"
                value={
                  selectedStatement.vendorInvoiceNumber?.trim() || "—"
                }
                ltr
              />
              <MetaCell
                label="تاريخ الفاتورة"
                value={formatInvoiceDate(
                  selectedStatement.vendorInvoiceDate,
                )}
                ltr
              />
              <MetaCell
                label="القيمة (مطابقة للمسير)"
                value={formatSar(
                  statementDisplayTotal(selectedStatement),
                )}
                ltr
                emphasize
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border px-3.5 py-3">
              {selectedStatement.vendorInvoiceAttachmentId ? (
                <button
                  type="button"
                  className={cn(opsBtnGhost, "justify-center")}
                  onClick={() =>
                    void viewReceipt(
                      selectedStatement.vendorInvoiceAttachmentId!,
                    )
                  }
                >
                  عرض PDF الفاتورة
                </button>
              ) : (
                <span className="text-[11.5px] text-text-3">
                  لا يوجد مرفق فاتورة
                </span>
              )}
              {!selectedStatement.vendorInvoiceMatched ? (
                <button
                  type="button"
                  className={cn(opsBtnPrimary, "ms-auto")}
                  disabled={busy}
                  onClick={() => void matchInvoice(selectedStatement)}
                >
                  إقرار المطابقة وإصدار أمر الصرف
                </button>
              ) : null}
            </div>

            {!selectedStatement.vendorInvoiceMatched ? (
              <div className="border-t border-dashed border-border-md bg-[#faf8f3] px-3.5 py-3">
                <div className={opsFld}>
                  <label className="text-xs font-semibold text-text-2">
                    سبب الإعادة للمورّد
                  </label>
                  <Input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="خلل في المستند أو بياناته"
                  />
                </div>
                <button
                  type="button"
                  className={cn(
                    opsBtnGhost,
                    "mt-2 w-full justify-center border-[#c0553d] text-[#a5432e]",
                  )}
                  disabled={busy}
                  onClick={() => void rejectInvoice(selectedStatement)}
                >
                  إعادة للمورّد للتصحيح
                </button>
              </div>
            ) : null}

            {selectedStatement.rejectedInvoices?.length ? (
              <div className="border-t border-border px-3.5 py-2 text-[11px] text-text-3">
                فواتير أُعيدت سابقاً:{" "}
                {selectedStatement.rejectedInvoices.length}
              </div>
            ) : null}
          </div>
        ) : null}

        {(selectedStatement.payeeType === "individual" &&
          selectedStatement.status === "issued") ||
        (selectedStatement.payeeType === "vendor" &&
          selectedStatement.status === "invoice_received" &&
          selectedStatement.vendorInvoiceMatched) ? (
          <div className={opsLetterCard}>
            <div className="border-b border-border bg-surface-2 px-3.5 py-2.5">
              <div className="text-[12.5px] font-bold text-heading">
                توثيق الصرف
              </div>
              <div className="mt-0.5 text-[11px] text-text-3">
                من البرنامج المحاسبي الخارجي — سند + مرجع + إيصال
              </div>
            </div>

            <div className="flex flex-col gap-3.5 p-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className={opsFld}>
                  <label className="text-xs font-semibold text-text-2">
                    رقم سند الصرف{" "}
                    <span className="text-[#c0553d]">*</span>
                  </label>
                  <Input
                    value={disbursementVoucher}
                    onChange={(e) =>
                      setDisbursementVoucher(e.target.value)
                    }
                    placeholder="من البرنامج المحاسبي"
                    dir="ltr"
                  />
                </div>
                <div className={opsFld}>
                  <label className="text-xs font-semibold text-text-2">
                    مرجع التحويل{" "}
                    <span className="text-[#c0553d]">*</span>
                  </label>
                  <Input
                    value={transferReference}
                    onChange={(e) =>
                      setTransferReference(e.target.value)
                    }
                    placeholder="رقم التحويل البنكي"
                    dir="ltr"
                  />
                </div>
                <div className={opsFld}>
                  <label className="text-xs font-semibold text-text-2">
                    تاريخ الصرف
                  </label>
                  <Input
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                  />
                </div>
              </div>

              <FinanceReceiptUploadField
                required
                disabled={busy}
                busy={uploadingReceipt}
                fileName={
                  receiptAttachmentId ? receiptFileName : null
                }
                onPick={(file) =>
                  void handleReceiptFile(selectedStatement, file)
                }
                onPreview={
                  receiptAttachmentId
                    ? () => void viewReceipt(receiptAttachmentId)
                    : undefined
                }
              />

              <div className={opsFld}>
                <label className="text-xs font-semibold text-text-2">
                  ملاحظة إيصال (اختياري)
                </label>
                <Input
                  value={receiptRef}
                  onChange={(e) => setReceiptRef(e.target.value)}
                  placeholder="مرجع أو ملاحظة داخلية"
                />
              </div>
            </div>

            <div className="border-t border-border bg-surface-2 px-3.5 py-3">
              <button
                type="button"
                className={cn(
                  opsBtnPrimary,
                  "w-full justify-center py-2.5",
                )}
                disabled={busy || uploadingReceipt}
                onClick={() => void closeStatement(selectedStatement)}
              >
                إقفال أمر الصرف كمدفوع
              </button>
            </div>

            {selectedStatement.payeeType === "individual" ||
            !selectedStatement.vendorInvoiceMatched ? (
              <div className="border-t border-dashed border-border-md px-3.5 py-3">
                <div className={opsFld}>
                  <Input
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="سبب الإلغاء"
                  />
                </div>
                <button
                  type="button"
                  className={cn(
                    opsBtnGhost,
                    "mt-2 w-full justify-center text-[#a5432e]",
                  )}
                  disabled={busy}
                  onClick={() =>
                    void cancelStatement(selectedStatement)
                  }
                >
                  إلغاء المستند وإرجاع بنوده مفتوحة
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {selectedStatement.status === "closed" ? (
          <div className="rounded-[11px] border border-[#a9dfbf] bg-[color-mix(in_srgb,#3f8f5f_10%,transparent)] px-[15px] py-3.5 text-[12.5px] leading-[1.9] text-[#2f7a4d]">
            <div className="mb-1 font-extrabold">✓ مدفوع</div>
            سند صرف{" "}
            <b dir="ltr">
              {selectedStatement.disbursementVoucher ??
                selectedStatement.externalInvoiceNumber}
            </b>
            {selectedStatement.transferReference
              ? ` · مرجع تحويل ${selectedStatement.transferReference}`
              : ""}
            {selectedStatement.paidAtUtc
              ? ` · ${new Date(selectedStatement.paidAtUtc).toLocaleDateString("en-GB")}`
              : ""}
            {selectedStatement.transferReceiptAttachmentId ? (
              <div className="mt-2">
                <button
                  type="button"
                  className={opsBtnGhost}
                  onClick={() =>
                    void viewReceipt(
                      selectedStatement.transferReceiptAttachmentId!,
                    )
                  }
                >
                  عرض إيصال التحويل
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {selectedStatement.status === "cancelled" ? (
          <div className="rounded-[11px] border border-border-md bg-surface-2 px-[15px] py-3.5 text-[12.5px] leading-[1.9] text-text-2">
            <div className="mb-1 font-extrabold text-heading">
              مستند ملغى
            </div>
            أُلغي قبل الصرف وأُرجعت بنوده مفتوحة.{" "}
            {selectedStatement.cancelReason}
          </div>
        ) : null}
      </div>
    </div>
  );
}
