"use client";

/**
 * Faithful port of Case Study.html `renderEngFees()` for المكتب الهندسي.
 * Layout: KPI → tabs → (secT + toolbar + card) | statements.
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KpiBand, KpiCell, StatusPill, cn, useToast } from "@platform/design-system";
import type { StatusPillStyle } from "@platform/design-system";
import {
  type InspectorFeeAction,
  type InspectorFeeRowDto,
  type PartyBillingStatementDto,
} from "@platform/api-client";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { runInspectorFeeTransition } from "@platform/app-shared/prototype/inspector-fees-api";
import {
  loadPartyBillingStatements,
  openPartyBillingAttachment,
  runSubmitVendorInvoice,
  uploadPartyBillingVendorInvoice,
} from "@platform/app-shared/prototype/party-billing-statements-api";
import { sortInspectorFeeRowsNewestFirst } from "@platform/app-shared/fees/party-fee-meta";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import {
  computeEngineeringFeesSituation,
} from "../../lib/prototype/active-transaction-page-situation";
import { engFeeUiStatus } from "./EngOfficeFeesBillingTable";
import { EngFeesHtmlTabs, EngFeesSectionTitle } from "./EngFeesHtmlTabs";
import { VendorInvoicePdfField } from "./VendorInvoicePdfField";

type TabId = "action" | "ready" | "statements";

const FEE_COLS =
  "minmax(125px,1.1fr) minmax(85px,.8fr) minmax(85px,.8fr) minmax(170px,1.5fr) minmax(90px,.8fr) minmax(140px,1fr) 130px";

function fmtSar(n: number): string {
  return `${Number(n || 0).toLocaleString("en-US")} ر.س`;
}

function formatYmd(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
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
      ...prototypeKeys.all,
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
    const q = search.trim().toLowerCase();
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
  }, [rows, tab, search, stFilter]);

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
    await queryClient.invalidateQueries({
      queryKey: [...prototypeKeys.all, "inspector-fees"],
    });
    await queryClient.invalidateQueries({
      queryKey: [...prototypeKeys.all, "party-billing"],
    });
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
      if (!result) {
        showToast("تعذّر تنفيذ الإجراء — حاول مرة أخرى", "error");
        return;
      }
      await invalidate();
      setObjectOpenId(null);
      setObjectText("");
    } finally {
      setBusyId(null);
    }
  };

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
      showToast(`رُفعت الفاتورة — ${fmtSar(s.totalNetSar)}`, "success");
      setInvoiceNo("");
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
  };

  return (
    <div className="px-[30px] pb-11 pt-[26px]">
      {/* Case Study.html `.kpi` */}
      <KpiBand className="mb-6">
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
        className="!mb-4 !mt-0"
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
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
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
                  className="w-[248px] max-w-full rounded-lg border border-border-md bg-surface py-2 pe-3.5 ps-[38px] text-[13px] text-text outline-none transition-[border-color,box-shadow] focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)]"
                />
              </div>
              <div className="relative flex items-center">
                <select
                  value={stFilter}
                  onChange={(e) => setStFilter(e.target.value)}
                  aria-label="تصفية الحالة"
                  className="cursor-pointer appearance-none rounded-lg border border-border-md bg-surface py-2 pe-[34px] ps-3.5 text-[13px] text-text outline-none"
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
              <span className="ms-auto rounded-full bg-gold-soft px-3 py-[5px] text-[12px] font-bold text-gold-d">
                {filteredFees.length} بند
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            <div className="overflow-x-auto">
              <div className="min-w-[920px]">
                <div
                  className="grid border-b-2 border-gold bg-surface-2"
                  style={{ gridTemplateColumns: FEE_COLS }}
                >
                  {[
                    "الصك",
                    "تاريخ القبول",
                    "سعر الجدول",
                    "تعديل التسعير ومبرره",
                    "الصافي",
                    "الحالة",
                    "إجراء المكتب",
                  ].map((h) => (
                    <div
                      key={h}
                      className="flex min-w-0 items-center justify-center overflow-hidden px-4 py-3.5 text-center text-[12px] font-bold text-heading"
                    >
                      {h}
                    </div>
                  ))}
                </div>

                {feesPending && filteredFees.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[13px] text-text-3">
                    جاري التحميل…
                  </div>
                ) : filteredFees.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[13px] text-text-3">
                    لا توجد بنود مطابقة.
                  </div>
                ) : (
                  filteredFees.map((row) => {
                    const st = engFeeUiStatus(row);
                    const meta = statusMeta(st);
                    const { deed, region } = deedParts(row);
                    const ded = row.supervisorDiscountSar > 0;
                    const busy = busyId === row.workflowTaskId;
                    const objOpen = objectOpenId === row.workflowTaskId;
                    return (
                      <div
                        key={row.workflowTaskId}
                        className="grid min-h-[38px] items-center border-b border-border transition-colors hover:bg-[var(--row-hover,#faf6ee)]"
                        style={{ gridTemplateColumns: FEE_COLS }}
                      >
                        <div className="flex min-w-0 items-center overflow-hidden px-3.5 py-1.5">
                          <div className="flex flex-col gap-0.5">
                            <span
                              dir="ltr"
                              className="text-end text-[13px] font-bold text-gold-d"
                            >
                              {deed}
                            </span>
                            <span className="text-[11px] text-text-3">
                              {region}
                            </span>
                          </div>
                        </div>
                        <div
                          dir="ltr"
                          className="flex min-w-0 items-center px-3.5 py-1.5 text-[12px] text-text-2"
                        >
                          {formatYmd(
                            row.accruedAtUtc ??
                              row.workSubmittedAtUtc ??
                              row.updatedAtUtc,
                          )}
                        </div>
                        <div className="flex min-w-0 items-center px-3.5 py-1.5 text-[12.5px] text-text-2">
                          {fmtSar(row.agreedFeeSar)}
                        </div>
                        <div className="flex min-w-0 items-center overflow-hidden px-3.5 py-1.5">
                          {ded ? (
                            <span
                              className="inline-flex min-w-0 items-center gap-1.5"
                              title={row.discountReason ?? undefined}
                            >
                              <span className="shrink-0 text-[12.5px] font-bold text-[#a5432e]">
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
                        </div>
                        <div className="flex min-w-0 items-center px-3.5 py-1.5 text-[13px] font-bold text-heading">
                          {fmtSar(row.netFeeSar)}
                        </div>
                        <div className="flex min-w-0 items-center px-3.5 py-1.5">
                          <StatusPill label={meta.label} style={meta.style} />
                        </div>
                        <div className="flex min-w-0 items-center overflow-visible px-3.5 py-1.5">
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
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
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

          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
            <div className="overflow-x-auto">
              <div className="min-w-[820px]">
                <div
                  className="grid border-b-2 border-gold bg-surface-2"
                  style={{
                    gridTemplateColumns:
                      "minmax(150px,1.2fr) minmax(90px,.8fr) minmax(70px,.6fr) minmax(90px,.8fr) minmax(110px,1fr) minmax(170px,1.4fr)",
                  }}
                >
                  {[
                    "رقم الكشف",
                    "تاريخ الإصدار",
                    "المعاملات",
                    "الإجمالي",
                    "الحالة",
                    "الصرف",
                  ].map((h) => (
                    <div
                      key={h}
                      className="flex items-center justify-center px-4 py-3.5 text-center text-[12px] font-bold text-heading"
                    >
                      {h}
                    </div>
                  ))}
                </div>

                {filteredFns.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[13px] text-text-3">
                    لا توجد كشوف مطابقة.
                  </div>
                ) : (
                  filteredFns.map((s) => {
                    const open = openFn === s.referenceNumber;
                    const meta = statementMeta(s);
                    return (
                      <div key={s.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            setOpenFn(open ? null : s.referenceNumber)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setOpenFn(open ? null : s.referenceNumber);
                            }
                          }}
                          className={cn(
                            "grid min-h-11 cursor-pointer items-center border-b border-border transition-colors",
                            open && "bg-[var(--row-hover,#faf6ee)]",
                            "hover:bg-[var(--row-hover,#faf6ee)]",
                          )}
                          style={{
                            gridTemplateColumns:
                              "minmax(150px,1.2fr) minmax(90px,.8fr) minmax(70px,.6fr) minmax(90px,.8fr) minmax(110px,1fr) minmax(170px,1.4fr)",
                          }}
                        >
                          <div className="flex items-center px-4 py-3.5">
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
                          </div>
                          <div
                            dir="ltr"
                            className="flex items-center px-4 py-3.5 text-[12px] text-text-2"
                          >
                            {formatYmd(s.issuedAtUtc ?? s.createdAtUtc)}
                          </div>
                          <div className="flex items-center px-4 py-3.5 text-[12.5px]">
                            {s.lines.length} معاملات
                          </div>
                          <div className="flex items-center px-4 py-3.5 text-[13px] font-bold text-heading">
                            {fmtSar(s.totalNetSar)}
                          </div>
                          <div className="flex items-center px-4 py-3.5">
                            <StatusPill
                              label={meta.label}
                              style={meta.style}
                            />
                          </div>
                          <div className="flex items-center px-4 py-3.5 text-[11px] text-text-2">
                            {s.status === "closed" && s.paidAtUtc ? (
                              <span className="inline-flex min-w-0 flex-col gap-px">
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
                                  {s.transferReceiptRef ||
                                    "إيصال التحويل"}
                                  {s.transferReference
                                    ? ` · مرجع ${s.transferReference}`
                                    : ""}
                                </span>
                              </span>
                            ) : (
                              "بانتظار الصرف"
                            )}
                          </div>
                        </div>

                        {open ? (
                          <div className="border-b border-border bg-surface-2 px-[18px] py-3">
                            <div className="mb-2 text-[11.5px] font-bold text-text-2">
                              معاملات الكشف {s.referenceNumber}
                            </div>
                            <div className="grid gap-1.5">
                              {s.lines.map((line) => (
                                <div
                                  key={line.id}
                                  className="grid items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px]"
                                  style={{
                                    gridTemplateColumns:
                                      "minmax(115px,1fr) minmax(105px,1.1fr) minmax(95px,.9fr) minmax(85px,.8fr) minmax(145px,1.4fr) minmax(85px,.8fr)",
                                  }}
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
                                  <span className="text-text-2">
                                    {fmtSar(line.netFeeSar)}
                                  </span>
                                  <span className="text-[11px] text-text-3">
                                    بسعر الجدول
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
                                className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-surface p-3"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="text-[12px] font-semibold">
                                  رفع فاتورة مطابقة للمسير (القيمة مقفلة{" "}
                                  {fmtSar(s.totalNetSar)})
                                </div>
                                <label className="text-[12px] text-text-2">
                                  رقم الفاتورة *
                                  <input
                                    className="mt-1 w-full rounded-lg border border-border-md bg-surface px-3 py-2 text-[13px]"
                                    value={invoiceNo}
                                    onChange={(e) =>
                                      setInvoiceNo(e.target.value)
                                    }
                                    dir="ltr"
                                  />
                                </label>
                                <label className="text-[12px] text-text-2">
                                  تاريخ الفاتورة
                                  <input
                                    type="date"
                                    className="mt-1 w-full rounded-lg border border-border-md bg-surface px-3 py-2 text-[13px]"
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
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="border-t border-border px-4 py-[11px] text-[12px] text-text-3">
              دورة الكشف: مسودة ← صادر ← محال للمالية ← مصروف. الفاتورة تصدر من
              البرنامج المحاسبي خارج النظام، ويُوثَّق الصرف هنا برقم الفاتورة
              وإيصال التحويل والتاريخ. البنود المتحفَّظ عليها تُعالَج بالتنسيق مع
              المشرف قبل إحالتها للمالية.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
