"use client";

/**
 * Faithful port of Case Study.html `renderEngFees()` for the engineering office.
 * Layout: KPI → tabs → (secT + toolbar + card) | statements.
 */

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cn,
  KpiBand,
  KpiCell,
  ModalBody,
  ModalCard,
  ModalClose,
  ModalHeader,
  ModalOverlay,
  ModalTitle,
  opsInsetPanel,
  StatusPill,
  type StatusPillStyle,
  Table,
  TableEmptyRow,
  TableFrame,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
  useToast,
} from "@platform/ui-kit";
import {
  type InspectorFeeAction,
  type InspectorFeeRowDto,
  type PartyBillingStatementDto,
} from "@platform/api-client";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { runInspectorFeeTransition } from "@platform/app-shared/app-data/inspector-fees-api";
import {
  loadPartyBillingStatements,
  openPartyBillingAttachment,
  runSubmitVendorInvoice,
  uploadPartyBillingVendorInvoice,
} from "@platform/app-shared/app-data/party-billing-statements-api";
import { sortInspectorFeeRowsNewestFirst } from "@platform/app-shared/fees/party-fee-meta";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import {
  computeEngineeringFeesSituation,
} from "../../lib/app-data/active-transaction-page-situation";
import { engFeeUiStatus } from "./EngOfficeFeesBillingTable";
import { EngFeesHtmlTabs, EngFeesSectionTitle } from "./EngFeesHtmlTabs";
import { VendorInvoicePdfField } from "./VendorInvoicePdfField";
import { ymd as formatYmd } from "@platform/app-shared/format/date";
import { fmtMax } from "@platform/app-shared/format/number";
import {
  opsFldControl,
  opsFilters,
  opsListCount,
  opsToolbar,
} from "../../lib/app-data/ops-tasks-tw";

type TabId = "action" | "ready" | "statements";

function fmtSar(n: number): string {
  return `${fmtMax(n || 0, 3)} ر.س`;
}


function deedParts(row: InspectorFeeRowDto): { deed: string; region: string } {
  const label = (row.propertyLabel || "").trim();
  const sep = label.includes("—")
    ? "—"
    : label.includes("–")
      ? "–"
      : label.includes(" - ")
        ? " - "
        : null;
  if (sep) {
    const [a, ...rest] = label.split(sep);
    return { deed: a.trim() || label, region: rest.join(sep).trim() || row.poNumber || "—" };
  }
  return { deed: label || "—", region: row.poNumber || "—" };
}

function statusMeta(st: ReturnType<typeof engFeeUiStatus>): {
  label: string;
  style: StatusPillStyle;
} {
  const map: Record<string, { label: string; style: StatusPillStyle }> = {
    pending_office: {
      label: "بانتظار إفادتكم",
      style: { base: "#d9a441", fg: "#8a5e14" },
    },
    dispute: {
      label: "تحفّظ على التسعير",
      style: { base: "#d9694f", fg: "#a5432e" },
    },
    carried: {
      label: "مرحَّل — متأخر عن دورته",
      style: { base: "#8a5e14", fg: "#8a5e14" },
    },
    ready: {
      label: "جاهز للفوترة",
      style: { base: "var(--ink)", fg: "var(--ink)" },
    },
    listed: {
      label: "مدرج في كشف",
      style: { base: "#d9a441", fg: "#8a5e14" },
    },
    paid: {
      label: "مفوترة / مدفوعة",
      style: { base: "#3f8f5f", fg: "#2f7a4d" },
    },
  };
  return map[st] ?? { label: "—", style: { base: "#6b7c8f", fg: "#4a5568" } };
}

function statementMeta(s: PartyBillingStatementDto): {
  label: string;
  style: StatusPillStyle;
} {
  if (s.status === "closed") {
    return {
      label: s.statusLabel || "مصروف",
      style: { base: "#3f8f5f", fg: "#2f7a4d" },
    };
  }
  if (s.status === "issued" || s.status === "invoice_received") {
    return {
      label: s.statusLabel || "صادر",
      style: { base: "#22406e", fg: "#102B4E" },
    };
  }
  return {
    label: s.statusLabel || "مسودة",
    style: { base: "#6b7c8f", fg: "#4a5568" },
  };
}

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
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [tab, setTab] = useState<TabId>("action");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [stFilter, setStFilter] = useState("");
  const [fnSearch, setFnSearch] = useState("");
  const [openFn, setOpenFn] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [objectOpenId, setObjectOpenId] = useState<string | null>(null);
  const [objectText, setObjectText] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const { data: summary, isPending: feesPending } = useInspectorFeesQuery(
    {
      assigneeId,
      submittedOnly: false,
      taskKind: "engineering-survey",
    },
    { enabled: Boolean(assigneeId) },
  );

  const rows = useMemo(
    () => sortInspectorFeeRowsNewestFirst(summary?.rows ?? []),
    [summary?.rows],
  );

  const { data: statements = [] } = useQuery({
    queryKey: [
      ...appDataKeys.all,
      "party-billing",
      "statements",
      assigneeId ?? "none",
      "issued+",
    ],
    queryFn: () =>
      loadPartyBillingStatements({
        assigneeId,
        issuedOrLaterOnly: true,
      }),
    enabled: Boolean(assigneeId),
  });

  const closedPaid = useMemo(
    () =>
      statements
        .filter((s) => s.status === "closed")
        .reduce((sum, s) => sum + (Number(s.totalNetSar) || 0), 0),
    [statements],
  );

  const kpi = useMemo(
    () =>
      computeEngineeringFeesSituation(rows, {
        closedStatementsPaidSar: closedPaid,
      }),
    [rows, closedPaid],
  );

  const actionCount = rows.filter((r) => {
    const st = engFeeUiStatus(r);
    return st === "pending_office" || st === "dispute";
  }).length;
  const readyCount = rows.filter((r) => {
    const st = engFeeUiStatus(r);
    return st === "ready" || st === "carried";
  }).length;

  const filteredFees = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return rows.filter((row) => {
      const st = engFeeUiStatus(row);
      const inTab =
        tab === "action"
          ? st === "pending_office" || st === "dispute"
          : st === "ready" || st === "carried";
      if (!inTab) return false;
      if (stFilter && st !== stFilter) return false;
      if (!q) return true;
      const { deed, region } = deedParts(row);
      return `${deed} ${region} ${row.poNumber}`.toLowerCase().includes(q);
    });
  }, [rows, tab, deferredSearch, stFilter]);

  const filteredFns = useMemo(() => {
    const q = fnSearch.trim().toLowerCase();
    if (!q) return statements;
    return statements.filter(
      (s) =>
        s.referenceNumber.toLowerCase().includes(q) ||
        s.lines.some((l) =>
          (l.propertyLabel || "").toLowerCase().includes(q),
        ),
    );
  }, [statements, fnSearch]);

  const invalidate = useCallback(async () => {
    // Two independent keys — in parallel (async-parallel).
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...appDataKeys.all, "inspector-fees"],
      }),
      queryClient.invalidateQueries({
        queryKey: [...appDataKeys.all, "party-billing"],
      }),
    ]);
  }, [queryClient]);

  const act = async (
    row: InspectorFeeRowDto,
    action: InspectorFeeAction,
    extra?: { reason?: string },
  ) => {
    setBusyId(row.workflowTaskId);
    try {
      const result = await runInspectorFeeTransition(row.workflowTaskId, {
        action,
        reason: extra?.reason,
      });
      if (!result.ok) {
        showToast(
          result.error || "تعذّر تنفيذ الإجراء — حاول مرة أخرى",
          "error",
        );
        return;
      }
      await invalidate();
      setObjectOpenId(null);
      setObjectText("");
    } finally {
      setBusyId(null);
    }
  };

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
      showToast(`رُفعت الفاتورة — ${fmtSar(s.totalNetSar)}`, "success");
      setInvoiceNo("");
      setInvoiceFile(null);
      setOpenFn(null);
      await invalidate();
    } finally {
      setBusyId(null);
    }
  };

  const onTabChange = (id: string) => {
    setTab(id as TabId);
    setSearch("");
    setStFilter("");
    setFnSearch("");
    setOpenFn(null);
    setInvoiceFile(null);
  };

  const openStatement = useMemo(
    () =>
      openFn
        ? (filteredFns.find((s) => s.referenceNumber === openFn) ??
          statements.find((s) => s.referenceNumber === openFn) ??
          null)
        : null,
    [openFn, filteredFns, statements],
  );

  const closeStatementModal = () => {
    setOpenFn(null);
    setInvoiceFile(null);
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Case Study.html `.kpi` */}
      <KpiBand className="mb-1">
        <KpiCell
          first
          icon={<CurrencyIcon />}
          iconClass="bg-gold-soft text-gold-d"
          label="إجمالي المستحق غير المفوتر"
          value={
            <span className="text-[20px] font-extrabold tabular-nums">
              {fmtSar(kpi.outstanding)}
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
              {fmtSar(kpi.pending)}
            </span>
          }
          sub="تعديلات تسعير تنتظر إفادتكم"
        />
        <KpiCell
          icon={<CardIcon />}
          iconClass="bg-navy-soft text-ink"
          label="جاهزة للفوترة"
          value={
            <span className="text-[20px] font-extrabold tabular-nums">
              {fmtSar(kpi.ready)}
            </span>
          }
          sub="تشمل المرحَّل — بانتظار كشف المحاسب"
        />
        <KpiCell
          last
          icon={<CurrencyIcon />}
          iconClass="bg-[color-mix(in_srgb,#3f8f5f_14%,transparent)] text-[#2f7a4d]"
          label="مفوترة / مدفوعة"
          value={
            <span className="text-[20px] font-extrabold tabular-nums">
              {fmtSar(kpi.paid)}
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

      {tab !== "statements" ? (
        <>
          {tab === "action" ? (
            <EngFeesSectionTitle
              title="الكشف المبدئي — بنود تتطلب إجراءكم"
              sub="تعديلات تسعير بانتظار إفادتكم، وتحفّظاتكم قيد المعالجة مع المشرف. الاستحقاق ينشأ بقبول الأخصائي بسعر جدول التسعير."
            />
          ) : (
            <EngFeesSectionTitle
              title="المعاملات الجاهزة للفوترة"
              sub="بنود مستحقة بانتظار كشف المحاسب نهاية الشهر — تشمل المرحَّلة من أشهر سابقة."
            />
          )}

          {/* `.toolbar` > `.filters` — separate from card */}
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
                    <>
                      <option value="pending_office">بانتظار إفادتكم</option>
                      <option value="dispute">تحفّظ على التسعير</option>
                    </>
                  ) : (
                    <>
                      <option value="ready">جاهز للفوترة</option>
                      <option value="carried">مرحَّل — متأخر</option>
                    </>
                  )}
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
                  <Th>تاريخ القبول</Th>
                  <Th>سعر الجدول</Th>
                  <Th>تعديل التسعير ومبرره</Th>
                  <Th>الصافي</Th>
                  <Th>الحالة</Th>
                  <Th>إجراء المكتب</Th>
                </Tr>
              </THead>
              <TBody>
                {feesPending && filteredFees.length === 0 ? (
                  <TableEmptyRow colSpan={7}>جاري التحميل…</TableEmptyRow>
                ) : filteredFees.length === 0 ? (
                  <TableEmptyRow colSpan={7}>لا توجد بنود مطابقة.</TableEmptyRow>
                ) : (
                  filteredFees.map((row) => {
                    const st = engFeeUiStatus(row);
                    const meta = statusMeta(st);
                    const { deed, region } = deedParts(row);
                    const ded = row.supervisorDiscountSar > 0;
                    const busy = busyId === row.workflowTaskId;
                    const objOpen = objectOpenId === row.workflowTaskId;
                    return (
                      <Tr key={row.workflowTaskId}>
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
                            row.accruedAtUtc ??
                              row.workSubmittedAtUtc ??
                              row.updatedAtUtc,
                          )}
                        </TdLtr>
                        <TdLtr valueClassName="text-[12.5px] text-text-2">
                          {fmtSar(row.agreedFeeSar)}
                        </TdLtr>
                        <Td>
                          {ded ? (
                            <span
                              className="inline-flex min-w-0 items-center gap-1.5"
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
                          {st === "pending_office" ? (
                            <div className="flex w-full flex-col gap-1.5">
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  disabled={
                                    busy || !row.canOfficeApproveDiscount
                                  }
                                  className="cursor-pointer whitespace-nowrap rounded-lg border-none bg-ink px-[11px] py-1 text-[11px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,.6)] disabled:opacity-50"
                                  onClick={() =>
                                    void act(row, "office-approve-discount")
                                  }
                                >
                                  قبول
                                </button>
                                <button
                                  type="button"
                                  disabled={busy || !row.canOfficeDispute}
                                  className="cursor-pointer whitespace-nowrap rounded-lg border border-[color-mix(in_srgb,#d9694f_40%,transparent)] bg-surface px-[11px] py-1 text-[11px] font-bold text-[#a5432e] disabled:opacity-50"
                                  onClick={() => {
                                    setObjectOpenId(
                                      objOpen ? null : row.workflowTaskId,
                                    );
                                    setObjectText("");
                                  }}
                                >
                                  تحفّظ
                                </button>
                              </div>
                              {objOpen ? (
                                <div>
                                  <textarea
                                    rows={2}
                                    value={objectText}
                                    onChange={(e) =>
                                      setObjectText(e.target.value)
                                    }
                                    placeholder="مبررات التحفّظ (إلزامي)…"
                                    className="w-full resize-y rounded-lg border border-border-md bg-surface-2 px-3 py-2 text-[11.5px] text-text outline-none"
                                  />
                                  <button
                                    type="button"
                                    disabled={busy || !objectText.trim()}
                                    className="mt-[5px] cursor-pointer rounded-lg border-none bg-ink px-3 py-[5px] text-[11px] font-bold text-white disabled:opacity-50"
                                    onClick={() => {
                                      if (!objectText.trim()) return;
                                      void act(row, "office-dispute", {
                                        reason: objectText.trim(),
                                      });
                                    }}
                                  >
                                    إرسال التحفّظ
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-[11px] text-text-3">
                              {st === "dispute"
                                ? "قيد المعالجة"
                                : "لا إجراء مطلوب"}
                            </span>
                          )}
                        </Td>
                      </Tr>
                    );
                  })
                )}
              </TBody>
            </Table>
          </TableFrame>
        </>
      ) : (
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

          <TableFrame>
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
                          {fmtSar(s.totalNetSar)}
                        </TdLtr>
                        <Td>
                          <StatusPill label={meta.label} style={meta.style} />
                        </Td>
                        <Td className="text-[11px] text-text-2">
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
                              <span className="truncate text-text-3">
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
                        </Td>
                      </Tr>
                    );
                  })
                )}
              </TBody>
            </Table>
            <div className="border-t border-border px-4 py-[11px] text-[12px] text-text-3">
              دورة الكشف: مسودة ← صادر ← محال للمالية ← مصروف. الفاتورة تصدر من
              البرنامج المحاسبي خارج النظام، ويُوثَّق الصرف هنا برقم الفاتورة
              وإيصال التحويل والتاريخ. البنود المتحفَّظ عليها تُعالَج بالتنسيق مع
              المشرف قبل إحالتها للمالية. اضغط صفاً لفتح تفاصيل الكشف.
            </div>
          </TableFrame>

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
      )}
    </div>
  );
}
