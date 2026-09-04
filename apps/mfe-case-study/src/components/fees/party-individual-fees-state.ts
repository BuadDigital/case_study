/**
 * Pure fee rules behind `PartyIndividualFeesHtmlScreen`: status buckets, lane
 * membership, per-variant copy, KPI totals and the list filters. No React, no
 * queries — the screen keeps JSX and the workflow hook keeps the writes.
 */
import type { StatusPillStyle } from "@platform/ui-kit";
import type {
  CourtVisitFeeReportRowDto,
  InspectorFeeRowDto,
  PartyBillingStatementDto,
} from "@platform/api-client";
import { fmtMax } from "@platform/app-shared/format/number";

export type IndividualFeesVariant = "field-inspection" | "court-visit";

export type TabId = "action" | "tracking" | "ready" | "statements" | "visit-fees" | "key-fees";

export type UiStatus =
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


export function fmtSar(n: number): string {
  return `${fmtMax(n || 0, 3)} ر.س`;
}


export function deedParts(row: InspectorFeeRowDto): { deed: string; region: string } {
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

export function statusMeta(st: UiStatus): { label: string; style: StatusPillStyle } {
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

export function statementMeta(s: PartyBillingStatementDto): {
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

export const COPY: Record<
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

/** Own lane only: individual payee + this party's taskKind (never vendor/eng). */
export function ownLaneStatements(
  raw: PartyBillingStatementDto[],
  variant: IndividualFeesVariant,
): PartyBillingStatementDto[] {
  return raw.filter((s) => {
    if (s.payeeType === "vendor") return false;
    const kind = (s.taskKind ?? "").trim();
    if (variant === "court-visit") {
      return kind === "court-visit" || kind === "government-review" || kind === "";
    }
    if (kind && kind !== variant) return false;
    return true;
  });
}

export type IndividualFeesKpi = {
  outstanding: number;
  actionSar: number;
  readySar: number;
  paidSar: number;
};

/** KPI band totals — visit charges for the reviewer lane, ledger rows otherwise. */
export function individualFeesKpi(input: {
  rows: InspectorFeeRowDto[];
  statements: PartyBillingStatementDto[];
  visitFees: CourtVisitFeeReportRowDto[];
  isCourtVisit: boolean;
}): IndividualFeesKpi {
  const { rows, statements, visitFees, isCourtVisit } = input;
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
}

/** Rows waiting on this party to submit them to the supervisor. */
export function actionFeeRows(rows: InspectorFeeRowDto[]): InspectorFeeRowDto[] {
  return rows.filter((r) => individualFeeUiStatus(r) === "needs_submit");
}

/** In-flight rows: draft work, at the supervisor, bounced back, or suspended. */
export function trackingFeeRows(rows: InspectorFeeRowDto[]): InspectorFeeRowDto[] {
  return rows.filter((r) => {
    const st = individualFeeUiStatus(r);
    return (
      st === "draft_work" ||
      st === "sup_review" ||
      st === "returned_to_party" ||
      st === "inquiry_to_party" ||
      st === "suspended"
    );
  });
}

/** Approved rows: with finance, listed on a payment order, or already paid. */
export function readyFeeRows(rows: InspectorFeeRowDto[]): InspectorFeeRowDto[] {
  return rows.filter((r) => {
    const st = individualFeeUiStatus(r);
    return st === "at_finance" || st === "listed" || st === "paid";
  });
}

/** Deed/region/PO text search plus the status dropdown. */
export function filterFeeRows(
  rows: InspectorFeeRowDto[],
  search: string,
  stFilter: string,
): InspectorFeeRowDto[] {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    const st = individualFeeUiStatus(row);
    if (stFilter && st !== stFilter) return false;
    if (!q) return true;
    const { deed, region } = deedParts(row);
    return `${deed} ${region} ${row.poNumber}`.toLowerCase().includes(q);
  });
}

/** Payment-order search — reference number or any line's property label. */
export function filterStatements(
  statements: PartyBillingStatementDto[],
  search: string,
): PartyBillingStatementDto[] {
  const q = search.trim().toLowerCase();
  if (!q) return statements;
  return statements.filter(
    (s) =>
      s.referenceNumber.toLowerCase().includes(q) ||
      s.lines.some((l) => (l.propertyLabel || "").toLowerCase().includes(q)),
  );
}
