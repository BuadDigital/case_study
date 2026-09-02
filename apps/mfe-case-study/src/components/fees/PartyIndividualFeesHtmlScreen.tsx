"use client";

/**
 * Party fees shell (same module shape as EngFeesHtmlScreen: KPI → tabs → table | docs)
 * with a per-role slot. Each party only sees its lane:
 *   - field-inspection  → inspector: submit-to-supervisor, individual voucher, no invoice
 *   - court-visit → reviewer: visit fees (CourtVisitFeeCharges) + payment orders + keys
 *     (no ledger/supervisor-submit path — product dropped government-review workflow)
 * Never share eng (vendor) actions or statements across variants.
 */

import { Fragment, useCallback, useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cn,
  KpiBand,
  KpiCell,
  QueueTableHint,
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
} from "@platform/app-shared/app-data/party-billing-statements-api";
import { sortInspectorFeeRowsNewestFirst } from "@platform/app-shared/fees/party-fee-meta";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { KeyEnvelopeFeesPanel } from "./KeyEnvelopeFeesPanelSlot";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import { useCourtVisitFeesQuery } from "../../query/operations-tasks-queries";
import { EngFeesHtmlTabs, EngFeesSectionTitle } from "./EngFeesHtmlTabs";
import { CourtVisitFeesPanel } from "./CourtVisitFeesPanel";
import { ymd as formatYmd } from "@platform/app-shared/format/date";
import { fmtMax } from "@platform/app-shared/format/number";
import {
  opsFldControl,
  opsFilters,
  opsListCount,
  opsToolbar,
} from "../../lib/app-data/ops-tasks-tw";
export type IndividualFeesVariant = "field-inspection" | "court-visit";

type TabId = "action" | "tracking" | "ready" | "statements" | "visit-fees" | "key-fees";

type UiStatus =
  | "needs_submit"
  | "draft_work"
  | "returned_to_party"
  | "returned_to_supervisor"
  | "inquiry_to_party"
  | "inquiry_at_supervisor"
  | "sup_review"
  | "at_finance"
  | "listed"
  | "paid"
  | "suspended"
  | "other";

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
    return {
      deed: a.trim() || label,
      region: rest.join(sep).trim() || row.poNumber || "—",
    };
  }
  return { deed: label || "—", region: row.poNumber || "—" };
}

/**
 * Individual-party status bucket (not eng office-review).
 * `returned` / `inquiry` are NOT "work pending" — that was a misleading label for
 * finance/supervisor loops (e.g. returnTo=supervisor).
 */
export function individualFeeUiStatus(row: InspectorFeeRowDto): UiStatus {
  if (row.canSubmitToSupervisor) return "needs_submit";
  const returnTo = (row.returnTo ?? "").trim().toLowerCase();
  switch (row.billingStatus) {
    case "draft":
      return "draft_work";
    case "returned":
      if (returnTo === "supervisor") return "returned_to_supervisor";
      if (returnTo === "office" || returnTo === "party") return "returned_to_party";
      return "returned_to_party";
    case "inquiry":
      if (returnTo === "supervisor") return "inquiry_at_supervisor";
      return "inquiry_to_party";
    case "sup-review":
      return "sup_review";
    case "at-finance":
    case "deferred":
    case "disb-req":
      return "at_finance";
    case "in-statement":
      return "listed";
    case "disbursed":
      return "paid";
    case "suspended":
      return "suspended";
    default:
      return "other";
  }
}

/**
 * Finance → supervisor bounce is the supervisor queue (PartyFeesWorkspace returnedToSup),
 * not the individual party's action/tracking lane.
 */
export function isSupervisorOnlyFeeStatus(st: UiStatus): boolean {
  return st === "returned_to_supervisor" || st === "inquiry_at_supervisor";
}

/**
 * Rows that belong on the individual party's fees screen.
 * Supervisor-only returns are handled on the supervisor workspace.
 */
export function isIndividualPartyFeeLaneRow(row: InspectorFeeRowDto): boolean {
  return !isSupervisorOnlyFeeStatus(individualFeeUiStatus(row));
}

function statusMeta(st: UiStatus): { label: string; style: StatusPillStyle } {
  const map: Record<UiStatus, { label: string; style: StatusPillStyle }> = {
    needs_submit: {
      label: "جاهز للرفع للمشرف",
      style: { base: "#d9a441", fg: "#8a5e14" },
    },
    draft_work: {
      label: "بانتظار إنجاز العمل",
      style: { base: "#6b7c8f", fg: "#4a5568" },
    },
    returned_to_party: {
      label: "مُعاد إليكم",
      style: { base: "#d9a441", fg: "#8a5e14" },
    },
    returned_to_supervisor: {
      label: "أعادته المالية للمشرف",
      style: { base: "#22406e", fg: "#102B4E" },
    },
    inquiry_to_party: {
      label: "استفسار بانتظار ردكم",
      style: { base: "#d9a441", fg: "#8a5e14" },
    },
    inquiry_at_supervisor: {
      label: "استفسار عند المشرف",
      style: { base: "#22406e", fg: "#102B4E" },
    },
    sup_review: {
      label: "عند المشرف",
      style: { base: "#22406e", fg: "#102B4E" },
    },
    at_finance: {
      label: "لدى المالية",
      style: { base: "var(--ink)", fg: "var(--ink)" },
    },
    listed: {
      label: "في أمر صرف",
      style: { base: "#d9a441", fg: "#8a5e14" },
    },
    paid: {
      label: "مصروف / مدفوع",
      style: { base: "#3f8f5f", fg: "#2f7a4d" },
    },
    suspended: {
      label: "موقوف",
      style: { base: "#d9694f", fg: "#a5432e" },
    },
    other: {
      label: "—",
      style: { base: "#6b7c8f", fg: "#4a5568" },
    },
  };
  return map[st];
}

function statementMeta(s: PartyBillingStatementDto): {
  label: string;
  style: StatusPillStyle;
} {
  if (s.status === "closed") {
    return {
      label: s.statusLabel || "مدفوع",
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

const COPY: Record<
  IndividualFeesVariant,
  {
    roleLabel: string;
    actionTitle: string;
    actionSub: string;
    trackingTitle: string;
    trackingSub: string;
    readyTitle: string;
    readySub: string;
    statementsLabel: string;
    statementsFooter: string;
    outstandingSub: string;
    actionKpiLabel: string;
    actionKpiSub: string;
    readyKpiLabel: string;
    readyKpiSub: string;
    paidKpiLabel: string;
    paidKpiSub: string;
    actionCol: string;
    dateCol: string;
  }
> = {
  "field-inspection": {
    roleLabel: "المعاين",
    actionTitle: "أتعاب معاينة بانتظار رفعكم",
    actionSub:
      "بعد إنجاز المعاينة ارفع البند للمشرف. الصرف لاحقاً من المالية بأمر صرف (فرد) — بلا فاتورة مورّد.",
    trackingTitle: "قيد الإجراء",
    trackingSub: "مسودات العمل، الاعتماد عند المشرف، المعاد/الاستفسار إليكم، والموقوف.",
    readyTitle: "لدى المالية",
    readySub:
      "اعتمدها المشرف — أوامر الصرف من شاشة التكاليف. تظهر هنا المتابعة فقط.",
    statementsLabel: "أوامر الصرف الصادرة",
    statementsFooter:
      "دورة الفرد: رفع للمشرف ← اعتماد ← أمر صرف ← توثيق الصرف (سند + تحويل + إيصال). لا يُطلب منكم رفع فاتورة.",
    outstandingSub: "كل استحقاقاتكم التي لم تُصرف بعد",
    actionKpiLabel: "بانتظار رفعكم",
    actionKpiSub: "عمل مكتمل جاهز للرفع للمشرف",
    readyKpiLabel: "لدى المالية",
    readyKpiSub: "بعد الاعتماد — قبل الإقفال",
    paidKpiLabel: "مصروف / مدفوع",
    paidKpiSub: "أُغلق بعد توثيق الصرف",
    actionCol: "إجراءكم",
    dateCol: "تاريخ الإنجاز",
  },
  "court-visit": {
    roleLabel: "المراجع الحكومي",
    actionTitle: "أتعاب الزيارة",
    actionSub:
      "تُستحق أتعاب الزيارة عند إنجاز مهمة زيارة المحكمة (متعاون). المالية تصرفها كفرد من التكاليف.",
    trackingTitle: "—",
    trackingSub: "—",
    readyTitle: "لدى المالية",
    readySub: "بنود زيارة مفتوحة بانتظار أمر صرف من المالية.",
    statementsLabel: "أوامر الصرف الصادرة",
    statementsFooter:
      "دورة الزيارة: إنجاز → جاهز في التكاليف → أمر صرف فرد → توثيق الصرف (بدون فاتورة مورّد).",
    outstandingSub: "أتعاب زيارة غير مصروفة",
    actionKpiLabel: "مفتوحة",
    actionKpiSub: "بانتظار الصرف",
    readyKpiLabel: "في مسير/أمر",
    readyKpiSub: "مُدرجة ولم تُقفل بعد",
    paidKpiLabel: "مصروف",
    paidKpiSub: "مقفلة ومدفوعة",
    actionCol: "—",
    dateCol: "تاريخ الاستحقاق",
  },
};

export function PartyIndividualFeesHtmlScreen({
  assigneeId,
  variant,
}: {
  assigneeId?: string;
  variant: IndividualFeesVariant;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { hasCapability } = useAppAccess();
  const copy = COPY[variant];
  const isCourtVisit = variant === "court-visit";
  const showVisitKey = isCourtVisit;

  const [tab, setTab] = useState<TabId>(
    isCourtVisit ? "visit-fees" : "action",
  );
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [stFilter, setStFilter] = useState("");
  const [fnSearch, setFnSearch] = useState("");
  const [openFn, setOpenFn] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Inspector: ledger path. Reviewer: CourtVisitFeeCharges only (no court-visit taskKind on the ledger).
  const { data: summary, isPending: feesPending } = useInspectorFeesQuery(
    {
      assigneeId,
      submittedOnly: false,
      taskKind: "field-inspection",
    },
    { enabled: Boolean(assigneeId) && variant === "field-inspection" },
  );

  const { data: visitFees = [] } = useCourtVisitFeesQuery({
    creditAssigneeId: assigneeId,
    enabled: Boolean(assigneeId) && isCourtVisit,
  });

  const rows = useMemo(
    () =>
      variant === "field-inspection"
        ? sortInspectorFeeRowsNewestFirst(summary?.rows ?? []).filter(
            isIndividualPartyFeeLaneRow,
          )
        : [],
    [summary?.rows, variant],
  );

  const { data: statementsRaw = [] } = useQuery({
    queryKey: [
      ...appDataKeys.all,
      "party-billing",
      "statements",
      assigneeId ?? "none",
      "issued+",
      variant,
      "individual-lane",
    ],
    queryFn: () =>
      loadPartyBillingStatements({
        assigneeId,
        issuedOrLaterOnly: true,
      }),
    enabled: Boolean(assigneeId),
  });

  /** Own lane only: individual payee + this party's taskKind (never vendor/eng). */
  const statements = useMemo(
    () =>
      statementsRaw.filter((s) => {
        if (s.payeeType === "vendor") return false;
        const kind = (s.taskKind ?? "").trim();
        if (variant === "court-visit") {
          return (
            kind === "court-visit" ||
            kind === "government-review" ||
            kind === ""
          );
        }
        if (kind && kind !== variant) return false;
        return true;
      }),
    [statementsRaw, variant],
  );

  const kpi = useMemo(() => {
    if (isCourtVisit) {
      let openSar = 0;
      let settledSar = 0;
      for (const row of visitFees) {
        const amt = Number(row.amountSar) || 0;
        if (row.status === "settled") settledSar += amt;
        else openSar += amt;
      }
      const closedPaid = statements
        .filter((s) => s.status === "closed")
        .reduce((sum, s) => sum + (Number(s.totalNetSar) || 0), 0);
      const openStmts = statements
        .filter((s) => s.status !== "closed" && s.status !== "cancelled")
        .reduce((sum, s) => sum + (Number(s.totalNetSar) || 0), 0);
      return {
        outstanding: openSar + openStmts,
        actionSar: openSar,
        readySar: openStmts,
        paidSar: closedPaid > 0 ? closedPaid : settledSar,
      };
    }

    let outstanding = 0;
    let actionSar = 0;
    let readySar = 0;
    let paidSar = 0;
    for (const row of rows) {
      const net = Number(row.netFeeSar) || 0;
      const st = individualFeeUiStatus(row);
      if (st !== "paid") outstanding += net;
      if (st === "needs_submit") actionSar += net;
      if (st === "at_finance" || st === "listed") readySar += net;
      if (st === "paid") paidSar += net;
    }
    const closedPaid = statements
      .filter((s) => s.status === "closed")
      .reduce((sum, s) => sum + (Number(s.totalNetSar) || 0), 0);
    return {
      outstanding,
      actionSar,
      readySar,
      paidSar: closedPaid > 0 ? closedPaid : paidSar,
    };
  }, [rows, statements, isCourtVisit, visitFees]);

  const actionRows = useMemo(
    () => rows.filter((r) => individualFeeUiStatus(r) === "needs_submit"),
    [rows],
  );
  const trackingRows = useMemo(
    () =>
      rows.filter((r) => {
        const st = individualFeeUiStatus(r);
        return (
          st === "draft_work" ||
          st === "sup_review" ||
          st === "returned_to_party" ||
          st === "inquiry_to_party" ||
          st === "suspended"
        );
      }),
    [rows],
  );
  const readyRows = useMemo(
    () =>
      rows.filter((r) => {
        const st = individualFeeUiStatus(r);
        return st === "at_finance" || st === "listed" || st === "paid";
      }),
    [rows],
  );

  const feeBucketRows =
    tab === "action"
      ? actionRows
      : tab === "tracking"
        ? trackingRows
        : tab === "ready"
          ? readyRows
          : [];

  const filteredFees = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return feeBucketRows.filter((row) => {
      const st = individualFeeUiStatus(row);
      if (stFilter && st !== stFilter) return false;
      if (!q) return true;
      const { deed, region } = deedParts(row);
      return `${deed} ${region} ${row.poNumber}`.toLowerCase().includes(q);
    });
  }, [feeBucketRows, deferredSearch, stFilter]);

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
      showToast(
        action === "submit-to-supervisor"
          ? "رُفع للمشرف بنجاح"
          : "تم تنفيذ الإجراء",
        "success",
      );
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

  const tabs = isCourtVisit
    ? [
        {
          id: "visit-fees" as const,
          label: "أتعاب الزيارة",
          count: visitFees.filter((r) => r.status !== "settled").length,
        },
        {
          id: "statements" as const,
          label: copy.statementsLabel,
          count: statements.length,
        },
        { id: "key-fees" as const, label: "أتعاب استلام المفاتيح" },
      ]
    : [
        {
          id: "action",
          label: "رفع للمشرف",
          count: actionRows.length,
          countWarnWhenActive: true,
        },
        {
          id: "tracking",
          label: "قيد الإجراء",
          count: trackingRows.length,
        },
        {
          id: "ready",
          label: "لدى المالية",
          count: readyRows.filter((r) => {
            const st = individualFeeUiStatus(r);
            return st === "at_finance" || st === "listed";
          }).length,
        },
        {
          id: "statements",
          label: copy.statementsLabel,
          count: statements.length,
        },
      ];

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
