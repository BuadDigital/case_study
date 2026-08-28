"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fmtMax } from "@platform/app-shared/format/number";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadPartyBillingReadyLines,
  loadPartyBillingStatements,
  openPartyBillingAttachment,
  runCancelPartyBillingStatement,
  runClosePartyBillingStatement,
  runCreatePartyBillingStatement,
  runIssuePartyBillingStatement,
  runMatchVendorInvoice,
  runRejectVendorInvoice,
  uploadPartyBillingTransferReceipt,
} from "@platform/app-shared/prototype/party-billing-statements-api";
import { resolvePartyName } from "@platform/app-shared/fees/party-fee-meta";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { Input, cn, useToast } from "@platform/ui-kit";
import type {
  PartyBillingReadyLineDto,
  PartyBillingStatementDto,
} from "@platform/api-client";
import { pushNotification } from "@platform/app-shared";
import {
  applyCostTax,
  daysSinceIsoCost,
  lineRefMain,
  lineRefSub,
  partyBillingWorkflowLabel,
  partyBillingWorkflowTone,
  statementDisplayTotal,
} from "../lib/finance-cost-parties";
import {
  finCard,
  finCheck,
  finEmpty,
  finEmptyS,
  finEmptyT,
  finFld,
  finGhost,
  finGridDues,
  finGridStmtLines,
  finGridStmts,
  finGroupHead,
  finMuted,
  finPrimary,
  finRow,
  finRowActive,
  finRowClickable,
  finScroll,
  finScrollY,
  finSearch,
  finSearchIcon,
  finSearchInput,
  finSectionTitle,
  finStatusFor,
  finStatusTeal,
  finTd,
  finTh,
  finThead,
  finWorkFlush,
  finWorkHead,
  finWorkTitle,
} from "../lib/finance-tw";
import { FinanceReceiptUploadField } from "./FinanceReceiptUploadField";

const EMPTY_READY_LINES: PartyBillingReadyLineDto[] = [];
const EMPTY_STATEMENTS: PartyBillingStatementDto[] = [];

// لاحقة ر.س دون أصفار كسور إلزامية — نبقيها محلياً حفاظاً على العرض نفسه.
function formatSar(n: number) {
  return `${fmtMax(n)} ر.س`;
}

function formatInvoiceDate(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.trim();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** خلية بيانات: تسمية فوق وقيمة تحت — لا تتمدّد بعرض الشاشة */
function MetaCell({
  label,
  value,
  ltr,
  emphasize,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-[9px] border border-border bg-surface px-3 py-2.5">
      <div className="mb-1 text-[10.5px] font-medium text-text-3">{label}</div>
      <div
        className={cn(
          "truncate text-[13px] font-bold text-heading",
          emphasize && "text-[15px] font-extrabold",
        )}
        dir={ltr ? "ltr" : undefined}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

export type PartyBillingMode = "all" | "dues" | "statements" | "paid";

export function FinancePartyBillingStatements({
  mode = "all",
  assigneeId = null,
  focusStatementId = null,
  onFocusStatement,
  onCreatedStatement,
}: {
  mode?: PartyBillingMode;
  /** حصر المستحقات/المسيرات بمستحق واحد (حساب المستحق). */
  assigneeId?: string | null;
  focusStatementId?: string | null;
  onFocusStatement?: (id: string | null, partyId?: string | null) => void;
  onCreatedStatement?: () => void;
} = {}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(
    focusStatementId,
  );
  const [duesSearch, setDuesSearch] = useState("");
  const [disbursementVoucher, setDisbursementVoucher] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [receiptRef, setReceiptRef] = useState("");
  const [receiptAttachmentId, setReceiptAttachmentId] = useState<string | null>(
    null,
  );
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [paidAt, setPaidAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  const readyQuery = useQuery({
    queryKey: [...prototypeKeys.all, "party-billing", "ready-lines"],
    queryFn: () => loadPartyBillingReadyLines(),
  });

  const statementsQuery = useQuery({
    queryKey: [...prototypeKeys.all, "party-billing", "statements"],
    queryFn: () => loadPartyBillingStatements(),
  });

  const readyLinesAll = readyQuery.data ?? EMPTY_READY_LINES;
  const allStatementsRaw = statementsQuery.data ?? EMPTY_STATEMENTS;

  const readyLines = useMemo(() => {
    if (!assigneeId?.trim()) return readyLinesAll;
    const key = assigneeId.trim();
    return readyLinesAll.filter((l) => (l.assigneeId?.trim() || "—") === key);
  }, [readyLinesAll, assigneeId]);

  const allStatements = useMemo(() => {
    if (!assigneeId?.trim()) return allStatementsRaw;
    const key = assigneeId.trim();
    return allStatementsRaw.filter(
      (s) => (s.assigneeId?.trim() || "") === key,
    );
  }, [allStatementsRaw, assigneeId]);

  const statements = useMemo(() => {
    if (mode === "paid")
      return allStatements.filter((s) => s.status === "closed");
    if (mode === "statements")
      return allStatements.filter(
        (s) =>
          s.status === "draft" ||
          s.status === "issued" ||
          s.status === "invoice_received" ||
          s.status === "cancelled",
      );
    if (mode === "dues") return [];
    return allStatements;
  }, [allStatements, mode]);

  const filteredDues = useMemo(() => {
    const needle = duesSearch.trim().toLowerCase();
    let list = readyLines;
    if (needle) {
      list = list.filter((l) => {
        const hay =
          `${l.propertyLabel} ${l.poNumber} ${l.workflowTaskId}`.toLowerCase();
        return hay.includes(needle);
      });
    }
    return [...list].sort((a, b) => {
      const aa = daysSinceIsoCost(a.accruedAtUtc ?? a.updatedAtUtc) ?? -1;
      const bb = daysSinceIsoCost(b.accruedAtUtc ?? b.updatedAtUtc) ?? -1;
      if (aa >= 0 && bb >= 0 && aa !== bb) return bb - aa;
      return (a.propertyLabel || "").localeCompare(b.propertyLabel || "", "ar");
    });
  }, [readyLines, duesSearch]);

  /** البنود القابلة للتحديد (صافي > صفر) — تُحسب مرة بدل تكرار filter */
  const payableDues = useMemo(
    () => filteredDues.filter((l) => l.netFeeSar > 0),
    [filteredDues],
  );

  const selectedStatement = useMemo(() => {
    const id = focusStatementId ?? selectedStatementId;
    if (!id) return null;
    return (
      allStatements.find((s) => s.id === id) ??
      allStatementsRaw.find((s) => s.id === id) ??
      null
    );
  }, [
    allStatements,
    allStatementsRaw,
    focusStatementId,
    selectedStatementId,
  ]);

  const showDues = mode === "all" || mode === "dues";
  const showStatements = mode === "all" || mode === "statements" || mode === "paid";

  const selectedTotal = useMemo(() => {
    let total = 0;
    for (const line of readyLines) {
      if (selected.has(line.workflowTaskId)) total += line.netFeeSar;
    }
    return total;
  }, [readyLines, selected]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "party-billing"],
      }),
      queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "inspector-fees"],
      }),
    ]);
  };

  const resetCloseForm = () => {
    setDisbursementVoucher("");
    setTransferReference("");
    setReceiptRef("");
    setReceiptAttachmentId(null);
    setReceiptFileName(null);
    setRejectReason("");
    setCancelReason("");
    setPaidAt(new Date().toISOString().slice(0, 10));
  };

  const selectStatement = (id: string) => {
    setSelectedStatementId(id);
    const party =
      allStatementsRaw.find((s) => s.id === id)?.assigneeId?.trim() ||
      assigneeId;
    onFocusStatement?.(id, party);
    resetCloseForm();
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectGroup = (lines: PartyBillingReadyLineDto[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const line of lines) {
        if (on) next.add(line.workflowTaskId);
        else next.delete(line.workflowTaskId);
      }
      return next;
    });
  };

  const createStatement = async () => {
    if (selected.size === 0) {
      showToast("اختر بنوداً لإنشاء المسير / أمر الصرف", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await runCreatePartyBillingStatement({
        workflowTaskIds: [...selected],
        deferUnselectedForAssignee: false,
      });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      setSelected(new Set());
      setSelectedStatementId(result.statement.id);
      resetCloseForm();
      showToast(
        result.deferredCount > 0
          ? `أُنشئ المسير ${result.statement.referenceNumber} ورُحِّل ${result.deferredCount} بند`
          : `أُنشئ المسير ${result.statement.referenceNumber}`,
        "success",
      );
      onFocusStatement?.(
        result.statement.id,
        result.statement.assigneeId?.trim() || null,
      );
      onCreatedStatement?.();
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const matchInvoice = async (statement: PartyBillingStatementDto) => {
    setBusy(true);
    try {
      const result = await runMatchVendorInvoice(statement.id);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast(`طُوبقت فاتورة ${result.statement.vendorInvoiceNumber}`, "success");
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const rejectInvoice = async (statement: PartyBillingStatementDto) => {
    if (rejectReason.trim().length < 3) {
      showToast("سبب الإعادة للتصحيح إلزامي", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await runRejectVendorInvoice(statement.id, {
        reason: rejectReason.trim(),
      });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      setRejectReason("");
      showToast("أُعيدت الفاتورة للتصحيح وأُرشفت", "success");
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const cancelStatement = async (statement: PartyBillingStatementDto) => {
    if (cancelReason.trim().length < 3) {
      showToast("سبب الإلغاء إلزامي", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await runCancelPartyBillingStatement(statement.id, {
        reason: cancelReason.trim(),
      });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      setCancelReason("");
      showToast(`أُلغي ${result.statement.referenceNumber} — عادت البنود مستحقات`, "success");
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const issueStatement = async (statement: PartyBillingStatementDto) => {
    setBusy(true);
    try {
      const result = await runIssuePartyBillingStatement(statement.id);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      if (statement.payeeType === "vendor") {
        pushNotification({
          title: "أُرسل مسير الصرف",
          body: `${result.statement.referenceNumber} مرسل للمكتب.`,
          tone: "info",
          category: "financial",
          href: `/financial?area=costs&section=statements&statement=${result.statement.id}&party=${encodeURIComponent(result.statement.assigneeId || statement.assigneeId || "")}`,
        });
        showToast(`أُرسل المسير ${result.statement.referenceNumber} للمكتب`, "success");
      } else {
        showToast(
          `صدر أمر الصرف ${result.statement.referenceNumber}`,
          "success",
        );
      }
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const handleReceiptFile = async (
    statement: PartyBillingStatementDto,
    file: File | undefined,
  ) => {
    if (!file) return;
    setUploadingReceipt(true);
    setReceiptFileName(file.name);
    try {
      const upload = await uploadPartyBillingTransferReceipt(statement.id, file);
      if (!upload.ok) {
        showToast(upload.error, "error");
        setReceiptAttachmentId(null);
        setReceiptFileName(null);
        return;
      }
      setReceiptAttachmentId(upload.id);
      setReceiptFileName(upload.fileName);
      showToast("تم رفع إيصال التحويل", "success");
    } finally {
      setUploadingReceipt(false);
    }
  };

  const closeStatement = async (statement: PartyBillingStatementDto) => {
    if (!disbursementVoucher.trim()) {
      showToast("رقم سند الصرف مطلوب", "error");
      return;
    }
    if (!transferReference.trim()) {
      showToast("مرجع التحويل مطلوب", "error");
      return;
    }
    if (!receiptAttachmentId) {
      showToast("إيصال التحويل (مرفق) مطلوب", "error");
      return;
    }
    setBusy(true);
    try {
      const paidAtUtc = paidAt
        ? new Date(`${paidAt}T12:00:00`).toISOString()
        : undefined;
      const result = await runClosePartyBillingStatement(statement.id, {
        disbursementVoucher: disbursementVoucher.trim(),
        transferReference: transferReference.trim(),
        transferReceiptAttachmentId: receiptAttachmentId,
        transferReceiptRef: receiptRef.trim() || undefined,
        paidAtUtc,
      });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      resetCloseForm();
      showToast(`أُقفل ${result.statement.referenceNumber} كمدفوع`, "success");
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const viewReceipt = async (attachmentId: string) => {
    const result = await openPartyBillingAttachment(
      attachmentId,
      "إيصال-التحويل",
    );
    if (!result.ok) showToast(result.error, "error");
  };

  return (
    <div className="flex flex-col gap-5">
      {showDues ? (
        <section>
          <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
            <div className={cn(finSearch, "ms-0 max-w-none min-w-[200px] flex-1")}>
              <svg
                className={finSearchIcon}
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <circle
                  cx="11"
                  cy="11"
                  r="7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M20 20l-3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <input
                className={finSearchInput}
                placeholder="بحث: رقم الصك · المنطقة · رقم الطلب"
                value={duesSearch}
                onChange={(e) => setDuesSearch(e.target.value)}
                aria-label="بحث المستحقات"
              />
            </div>
            <button
              type="button"
              className={cn(
                finGhost,
                "h-auto px-3.5 py-2 text-xs",
                filteredDues.length === 0 && "pointer-events-none opacity-50",
              )}
              onClick={() => {
                const allOn =
                  payableDues.length > 0 &&
                  payableDues.every((l) => selected.has(l.workflowTaskId));
                selectGroup(payableDues, !allOn);
              }}
            >
              {filteredDues.length > 0 &&
              payableDues.every((l) => selected.has(l.workflowTaskId))
                ? "إلغاء التحديد"
                : `تحديد الكل (${payableDues.length})`}
            </button>
            <button
              type="button"
              className={cn(
                finPrimary,
                "px-4 py-2 text-[12.5px]",
                selected.size === 0 && "pointer-events-none opacity-50",
              )}
              disabled={busy || selected.size === 0}
              onClick={() => void createStatement()}
            >
              تجهيز{" "}
              {readyLines[0]?.payeeType === "individual" ? "أمر صرف" : "مسير صرف"}
              {selected.size > 0
                ? ` (${selected.size} — ${formatSar(
                    applyCostTax(
                      selectedTotal,
                      readyLines[0]?.payeeType === "individual"
                        ? "individual"
                        : "vendor",
                    ),
                  )})`
                : ""}
            </button>
            <span className="text-[11px] whitespace-nowrap text-text-3">
              {filteredDues.length} مستحق ·{" "}
              <b
                className={
                  payableDues.length > 0
                    ? "text-heading"
                    : "text-[#8a5e14]"
                }
              >
                {payableDues.length}
              </b>{" "}
              جاهز للصرف
            </span>
          </div>

          {readyQuery.isPending ? (
            <div className={finCard}>
              <div className={finEmpty}>
                <div className={finEmptyT}>جاري التحميل…</div>
              </div>
            </div>
          ) : filteredDues.length === 0 ? (
            <div className={finCard}>
              <div className={finEmpty}>
                <div className={finEmptyT}>
                  {duesSearch.trim()
                    ? "لا بنود مطابقة للبحث"
                    : "لا مستحقات قائمة — كل البنود مُدرجة في مستندات صرف"}
                </div>
                <div className={finEmptyS}>
                  تظهر هنا بنود المعاينة والمراجعة والرفع المساحي بحالة جاهز أو
                  مرحَّل.
                </div>
              </div>
            </div>
          ) : (
            <div className={finCard}>
              <div
                className={cn(finScroll, "max-h-[calc(100vh-290px)] overflow-auto")}
              >
                <div className={cn(finThead, finGridDues, "sticky top-0 z-[3]")}>
                  <div className={finTh} />
                  <div className={finTh}>المعاملة</div>
                  <div className={cn(finTh, "!justify-center")}>سعر الجدول</div>
                  <div className={cn(finTh, "!justify-center")}>تعديل التسعير</div>
                  <div className={cn(finTh, "!justify-center")}>الصافي</div>
                </div>
                {filteredDues.map((line) => {
                  const on = selected.has(line.workflowTaskId);
                  const age = daysSinceIsoCost(
                    line.accruedAtUtc ?? line.updatedAtUtc,
                  );
                  const ded = line.supervisorDiscountSar || 0;
                  const list = line.agreedFeeSar || line.netFeeSar;
                  const selectable = line.netFeeSar > 0;
                  const rowKey = `${line.workflowTaskId}:${line.propertyId ?? "po"}`;
                  return (
                    <div
                      key={rowKey}
                      role={selectable ? "button" : undefined}
                      tabIndex={selectable ? 0 : undefined}
                      className={cn(
                        finRow,
                        finGridDues,
                        selectable && "cursor-pointer",
                        !selectable && "opacity-70",
                        on &&
                          "bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]",
                      )}
                      onClick={() => selectable && toggle(line.workflowTaskId)}
                      onKeyDown={(e) => {
                        if (!selectable) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggle(line.workflowTaskId);
                        }
                      }}
                    >
                      <div className={finTd}>
                        {selectable ? (
                          <input
                            type="checkbox"
                            className={finCheck}
                            checked={on}
                            onChange={() => toggle(line.workflowTaskId)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="تحديد البند"
                          />
                        ) : (
                          <span
                            className="inline-block h-[17px] w-[17px] rounded-[5px] border-2 border-dashed border-border-md"
                            title="صافي صفر"
                          />
                        )}
                      </div>
                      <div className={finTd}>
                        <div className="flex min-w-0 flex-col items-end gap-0.5 text-end">
                          <span
                            className="text-[12.5px] font-bold text-gold-d"
                            dir="ltr"
                          >
                            {lineRefMain(line)}
                          </span>
                          <span className="text-[11px] text-text-3">
                            {lineRefSub(line)}
                            {selectable && age != null ? (
                              <>
                                {" · "}
                                <span
                                  className={
                                    age > 30
                                      ? "font-semibold text-[#a5432e]"
                                      : "font-semibold text-text-3"
                                  }
                                >
                                  منذ {age} يوماً
                                </span>
                              </>
                            ) : null}
                            {!selectable ? (
                              <span className="font-bold text-[#8a5e14]">
                                {" "}
                                · صافي صفر — يُقفل بتسوية
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </div>
                      <div className={cn(finTd, "!justify-center")}>
                        <span className="text-[12.5px] text-text-2 tabular-nums">
                          {formatSar(list)}
                        </span>
                      </div>
                      <div className={cn(finTd, "!justify-center")}>
                        {ded > 0 ? (
                          <span className="text-xs font-bold text-[#c0553d] tabular-nums">
                            −{formatSar(ded)}
                          </span>
                        ) : (
                          <span className="text-xs text-text-3">—</span>
                        )}
                      </div>
                      <div className={cn(finTd, "!justify-center")}>
                        <span className="text-[13px] font-bold text-heading tabular-nums">
                          {formatSar(line.netFeeSar)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      ) : null}

      {showStatements ? (
        <section>
          {mode === "all" ? (
            <div className={cn(finGroupHead, "mt-2")}>
              <h3 className={finSectionTitle}>مسيرات وأوامر الصرف</h3>
            </div>
          ) : null}
          {statementsQuery.isPending ? (
            <div className={finCard}>
              <div className={finEmpty}>
                <div className={finEmptyT}>جاري التحميل…</div>
              </div>
            </div>
          ) : statements.length === 0 && !selectedStatement ? (
            <div className={finCard}>
              <div className={finEmpty}>
                <div className={finEmptyT}>
                  {mode === "paid"
                    ? "لا مستندات مدفوعة بعد."
                    : "لا مسيرات أو أوامر صرف قيد الإجراء."}
                </div>
              </div>
            </div>
          ) : selectedStatement && mode !== "all" ? (
            <div className={finWorkFlush}>
              <div className="flex flex-col gap-3">
                <div className={finWorkHead}>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      className={cn(finGhost, "h-auto px-2.5 py-1.5 text-[11.5px]")}
                      onClick={() => {
                        setSelectedStatementId(null);
                        onFocusStatement?.(null);
                      }}
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
                    <span
                      className={
                        selectedStatement.payeeType === "individual"
                          ? finStatusTeal
                          : finStatusFor("default")
                      }
                    >
                      {selectedStatement.payeeTypeLabel}
                    </span>
                    <span
                      className={finStatusFor(
                        partyBillingWorkflowTone(selectedStatement),
                      )}
                    >
                      {partyBillingWorkflowLabel(selectedStatement)}
                    </span>
                  </div>
                </div>

                <div className={finCard}>
                  <div className="border-b border-border bg-surface-2 px-3.5 py-2.5 text-xs font-bold text-heading">
                    معاملات{" "}
                    {selectedStatement.payeeType === "individual"
                      ? "أمر الصرف"
                      : "مسير الصرف"}
                  </div>
                  <div className={finScrollY}>
                    <div>
                      <div className={cn(finThead, finGridStmtLines)}>
                        <div className={finTh}>المرجع</div>
                        <div className={finTh}>البيان</div>
                        <div className={cn(finTh, "!justify-center")}>المبلغ</div>
                      </div>
                      {selectedStatement.lines.map((line) => (
                        <div
                          key={line.id}
                          className={cn(finRow, finGridStmtLines)}
                        >
                          <div className={finTd}>
                            <span
                              className="text-[12.5px] font-bold text-gold-d"
                              dir="ltr"
                            >
                              {line.propertyLabel || line.poNumber || "—"}
                            </span>
                          </div>
                          <div className={finTd}>
                            <span className="text-[11.5px] text-text-2">
                              {line.poNumber ? `أمر عمل ${line.poNumber}` : "—"}
                            </span>
                          </div>
                          <div className={finTd}>
                            <span className="text-[12.5px] font-bold text-heading">
                              {formatSar(line.netFeeSar)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedStatement.payeeType === "vendor" &&
                selectedStatement.totalNetSar > 0 ? (
                  <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
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
                  <div className="rounded-[12px] border border-border bg-surface p-4">
                    <button
                      type="button"
                      className={cn(finPrimary, "w-full justify-center py-3")}
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
                      <div className={finFld}>
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
                          finGhost,
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
                  <div className="rounded-[12px] border border-border bg-surface-2 px-4 py-3.5">
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
                  <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
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
                          className={cn(finGhost, "justify-center")}
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
                          className={cn(finPrimary, "ms-auto")}
                          disabled={busy}
                          onClick={() => void matchInvoice(selectedStatement)}
                        >
                          إقرار المطابقة وإصدار أمر الصرف
                        </button>
                      ) : null}
                    </div>

                    {!selectedStatement.vendorInvoiceMatched ? (
                      <div className="border-t border-dashed border-border-md bg-[#faf8f3] px-3.5 py-3">
                        <div className={finFld}>
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
                            finGhost,
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
                  <div className="overflow-hidden rounded-[12px] border border-border bg-surface">
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
                        <div className={finFld}>
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
                        <div className={finFld}>
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
                        <div className={finFld}>
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

                      <div className={finFld}>
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
                          finPrimary,
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
                        <div className={finFld}>
                          <Input
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="سبب الإلغاء"
                          />
                        </div>
                        <button
                          type="button"
                          className={cn(
                            finGhost,
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
                          className={finGhost}
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
          ) : (
            <div
              className={
                mode === "all"
                  ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
                  : undefined
              }
            >
              <div className={finCard}>
                <div className={finScroll}>
                  <div>
                    <div className={cn(finThead, finGridStmts)}>
                      <div className={finTh}>المرجع</div>
                      <div className={cn(finTh, "!justify-center")}>
                        التاريخ
                      </div>
                      <div className={cn(finTh, "!justify-center")}>
                        المعاملات
                      </div>
                      <div className={cn(finTh, "!justify-center")}>
                        الإجمالي
                      </div>
                      <div className={cn(finTh, "!justify-center")}>
                        الحالة
                      </div>
                    </div>
                    {statements.map((s) => {
                      const active =
                        (focusStatementId ?? selectedStatementId) === s.id;
                      const dateIso =
                        s.closedAtUtc ??
                        s.issuedAtUtc ??
                        s.createdAtUtc;
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            finRow,
                            finGridStmts,
                            finRowClickable,
                            active && finRowActive,
                          )}
                          role="button"
                          tabIndex={0}
                          onClick={() => selectStatement(s.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              selectStatement(s.id);
                            }
                          }}
                        >
                          <div className={finTd}>
                            <span
                              className="text-[12.5px] font-bold text-gold-d"
                              dir="ltr"
                            >
                              {s.referenceNumber}
                            </span>
                          </div>
                          <div className={finTd}>
                            <span className="text-[11.5px] text-text-2" dir="ltr">
                              {dateIso
                                ? new Date(dateIso).toLocaleDateString("en-GB")
                                : "—"}
                            </span>
                          </div>
                          <div className={finTd}>
                            <span className="text-xs text-text-2">
                              {s.lines.length} معاملة
                            </span>
                          </div>
                          <div className={finTd}>
                            <span className="text-[12.5px] font-bold text-heading">
                              {formatSar(statementDisplayTotal(s))}
                            </span>
                          </div>
                          <div className={finTd}>
                            <span
                              className={finStatusFor(
                                partyBillingWorkflowTone(s),
                              )}
                            >
                              {partyBillingWorkflowLabel(s)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {mode === "all" ? (
                <div className={finWorkFlush}>
                  {!selectedStatement ? (
                    <div className={cn(finEmpty, "py-7")}>
                      <div className={finEmptyT}>
                        اختر كشفاً لعرض التفاصيل والإجراءات.
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className={finWorkHead}>
                        <div>
                          <div className={finWorkTitle}>
                            {selectedStatement.referenceNumber}
                          </div>
                          <div className={cn(finMuted, "mt-1")}>
                            {resolvePartyName(
                              selectedStatement.assigneeId,
                              staffUsers,
                            )}{" "}
                            — {formatSar(statementDisplayTotal(selectedStatement))}
                          </div>
                        </div>
                        <span
                          className={finStatusFor(
                            partyBillingWorkflowTone(selectedStatement),
                          )}
                        >
                          {partyBillingWorkflowLabel(selectedStatement)}
                        </span>
                      </div>
                      <p className={finMuted}>
                        افتح تبويب «مسيرات وأوامر صرف» داخل حساب المستحق للتفاصيل
                        الكاملة.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

