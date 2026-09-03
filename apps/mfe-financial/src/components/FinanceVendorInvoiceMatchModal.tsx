"use client";

/**
 * HTML-aligned modal: vendor invoice match (My Tasks → open action).
 * Stays on My Tasks; match + return-for-correction only.
 */

import { useState } from "react";
import type { PartyBillingStatementDto } from "@platform/api-client";
import { fmtMax } from "@platform/app-shared/format/number";
import { useEscapeKey } from "@platform/app-shared/hooks/use-escape-key";
import {
  openPartyBillingAttachment,
  runMatchVendorInvoice,
  runRejectVendorInvoice,
} from "@platform/app-shared/app-data/party-billing-statements-api";
import {
  ModalBody,
  ModalCard,
  ModalClose,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  cn,
  opsBtnGhost,
  opsBtnPrimary,
  opsFldControl,
  opsFldTextarea,
  opsTfNote,
  useToast,
} from "@platform/ui-kit";
import { statementDisplayTotal } from "../lib/finance-cost-parties";

function formatInvoiceDate(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.trim();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function attachmentLabel(s: PartyBillingStatementDto): string {
  const no = (s.vendorInvoiceNumber || "").trim();
  if (no) return `فاتورة_${no}.pdf`;
  return "فاتورة_المورّد.pdf";
}

export function FinanceVendorInvoiceMatchModal({
  statement,
  open,
  onClose,
  onDone,
  onMatched,
}: {
  statement: PartyBillingStatementDto | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void | Promise<void>;
  /** After successful match — e.g. leave My Tasks for Costs */
  onMatched?: (statement: PartyBillingStatementDto) => void;
}) {
  if (!open || !statement) return null;
  return (
    <FinanceVendorInvoiceMatchForm
      key={statement.id}
      statement={statement}
      onClose={onClose}
      onDone={onDone}
      onMatched={onMatched}
    />
  );
}

function FinanceVendorInvoiceMatchForm({
  statement,
  onClose,
  onDone,
  onMatched,
}: {
  statement: PartyBillingStatementDto;
  onClose: () => void;
  onDone: () => void | Promise<void>;
  onMatched?: (statement: PartyBillingStatementDto) => void;
}) {
  const { showToast } = useToast();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEscapeKey(!busy, onClose);

  const lockedTotal = statementDisplayTotal(statement);
  const hasAttachment = Boolean(statement.vendorInvoiceAttachmentId?.trim());

  async function handleMatch() {
    setBusy(true);
    setErr("");
    try {
      const result = await runMatchVendorInvoice(statement.id);
      if (!result.ok) {
        setErr(result.error);
        showToast(result.error, "error");
        return;
      }
      showToast(
        `طُوبقت فاتورة ${result.statement.vendorInvoiceNumber ?? "—"} وصدر أمر الصرف`,
        "success",
      );
      onClose();
      // After match: leave My Tasks for Costs (document leaves the My Tasks list).
      onMatched?.(result.statement);
      void onDone();
    } finally {
      setBusy(false);
    }
  }

  async function handleReturn() {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setErr("سبب الإعادة للتصحيح إلزامي");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const result = await runRejectVendorInvoice(statement.id, {
        reason: trimmed,
      });
      if (!result.ok) {
        setErr(result.error);
        showToast(result.error, "error");
        return;
      }
      showToast("أُعيدت الفاتورة للتصحيح وأُرشفت", "success");
      await onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function openAttachment() {
    if (!statement.vendorInvoiceAttachmentId) return;
    const r = await openPartyBillingAttachment(
      statement.vendorInvoiceAttachmentId,
    );
    if (!r.ok) {
      showToast(r.error, "error");
    }
  }

  return (
    <ModalOverlay
      role="presentation"
      className="!items-center !justify-center bg-[rgba(16,43,78,0.42)] backdrop-blur-[2px] !z-[var(--z-modal)] max-lg:!items-center"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <ModalCard
        wide
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendor-inv-match-title"
        className="max-w-[640px] rounded-2xl border border-border shadow-[0_24px_60px_-18px_rgba(16,43,78,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader className="justify-between gap-3 px-[22px] py-4">
          <div className="min-w-0 text-start">
            <ModalTitle
              id="vendor-inv-match-title"
              className="text-start text-base font-extrabold text-[#102B4E]"
            >
              مطابقة فاتورة المورّد – {statement.referenceNumber}
            </ModalTitle>
          </div>
          <ModalClose
            disabled={busy}
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border-none bg-surface-2 text-[15px] text-text-2 hover:bg-[#faf6ee] hover:text-heading"
          >
            ✕
          </ModalClose>
        </ModalHeader>

        <ModalBody className="max-h-[76vh] px-[22px] py-5">
          {err ? (
            <div
              className="mb-4 rounded-[10px] border border-[color-mix(in_srgb,#d9694f_30%,transparent)] bg-[color-mix(in_srgb,#d9694f_12%,transparent)] px-[13px] py-2.5 text-[12.5px] font-semibold leading-[1.7] text-[#a32d2d]"
              role="alert"
            >
              {err}
            </div>
          ) : null}

          <p className={cn(opsTfNote, "mb-4 text-center")}>
            الفاتورة للقراءة فقط وقيمتها مقفلة على المسير. الإعادة للتصحيح
            تؤرشف الفاتورة ويظهر سببها للمكتب.
          </p>

          <div className="overflow-hidden rounded-[10px] border border-border bg-surface">
            <div className="grid grid-cols-1 gap-0 sm:grid-cols-4">
              {(
                [
                  [
                    "رقم الفاتورة",
                    statement.vendorInvoiceNumber?.trim() || "—",
                    true,
                  ],
                  [
                    "تاريخها",
                    formatInvoiceDate(statement.vendorInvoiceDate),
                    true,
                  ],
                  [
                    "قيمتها (مقفلة على المسير)",
                    fmtMax(lockedTotal),
                    true,
                  ],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-col items-center justify-center border-b border-border px-3.5 py-3 text-center sm:border-e sm:border-b-0"
                >
                  <div className="mb-1 text-[11px] text-text-3">{label}</div>
                  <div
                    className="text-[13px] font-bold tabular-nums text-heading"
                    dir="ltr"
                  >
                    {value}
                  </div>
                </div>
              ))}
              <div className="flex flex-col items-center justify-center border-b border-border px-3.5 py-3 text-center sm:border-b-0">
                <div className="mb-1 text-[11px] text-text-3">المرفق</div>
                {hasAttachment ? (
                  <button
                    type="button"
                    className="max-w-full cursor-pointer truncate border-none bg-transparent p-0 text-center text-[12.5px] font-semibold text-[#8c7857] underline underline-offset-2 hover:text-[#102B4E]"
                    dir="ltr"
                    disabled={busy}
                    onClick={() => void openAttachment()}
                  >
                    {attachmentLabel(statement)}
                  </button>
                ) : (
                  <span className="text-[13px] text-text-3">—</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="vendor-inv-return-reason"
              className="mb-1.5 block text-xs font-semibold text-text-2"
            >
              سبب الإعادة للتصحيح{" "}
              <span className="font-medium text-text-3">
                (إلزامي عند الإعادة)
              </span>
            </label>
            <textarea
              id="vendor-inv-return-reason"
              rows={3}
              disabled={busy}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErr("");
              }}
              placeholder="خلل في المستند أو بياناته"
              className={cn(opsFldTextarea, "leading-[1.55] placeholder:text-text-3 disabled:opacity-60")}
            />
          </div>
        </ModalBody>

        <ModalFooter className="flex-wrap justify-end gap-2.5 border-t border-border bg-surface-2 px-[22px] py-3.5">
          <button
            type="button"
            className={opsBtnGhost}
            disabled={busy}
            onClick={onClose}
          >
            إلغاء
          </button>
          <button
            type="button"
            className={cn(
              opsBtnGhost,
              "border-[#c0553d] text-[#a5432e] enabled:hover:border-[#a5432e] enabled:hover:bg-[color-mix(in_srgb,#c0553d_6%,transparent)] enabled:hover:text-[#a5432e]",
            )}
            disabled={busy}
            onClick={() => void handleReturn()}
          >
            إعادة للتصحيح
          </button>
          <button
            type="button"
            className={cn(opsBtnPrimary, busy && "opacity-75")}
            disabled={busy}
            onClick={() => void handleMatch()}
          >
            {busy ? "جارٍ…" : "إقرار المطابقة وإصدار أمر الصرف"}
          </button>
        </ModalFooter>
      </ModalCard>
    </ModalOverlay>
  );
}
