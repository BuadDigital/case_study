import type {
  EnfazTrackingRowDto,
  PartyBillingReadyLineDto,
  PartyBillingStatementDto,
} from "@platform/api-client";
import {
  buildFinanceHref,
  type FinanceNavTarget,
  type RevenueStage,
} from "./finance-nav";
import {
  groupRowsByPo,
  resolveRevenueStage,
} from "./finance-revenue-stages";
import { statementDisplayTotal } from "./finance-cost-parties";

export type FinanceMyTaskKind =
  | "revenue_match"
  | "revenue_invoice"
  | "revenue_collect"
  | "cost_create_statement"
  | "cost_issue_statement"
  | "cost_match_invoice"
  | "cost_close_statement";

export type FinanceMyTaskDomain = "revenue" | "costs";

/** صف مهامي — مطابق لأعمدة تصميم الحزمة + بطاقات KPI */
export type FinanceMyTask = {
  id: string;
  kind: FinanceMyTaskKind;
  domain: FinanceMyTaskDomain;
  /** عنوان الإجراء المطلوب */
  title: string;
  /** المرجع (PO / فاتورة / رقم مسير) */
  reference: string;
  /** الجهة / المعاملة — سطر فرعي تحت المرجع أو عمود منفصل */
  subject: string;
  amountSar: number;
  /** ما يلزم لإتمامه */
  requirement: string;
  /** ينتقل إلى */
  movesTo: string;
  ageDays: number | null;
  /** سطر ثانٍ تحت العمر (مثال: فاتورة 2026-01-15) */
  ageNote: string | null;
  href: string;
  /** فتح الإجراء / فتح الحساب */
  openLabel: string;
  /** ربط بمسير/أمر صرف عند فتح منبثق من مهامي */
  statementId?: string | null;
};

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function formatDateNote(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString("en-GB");
}

function href(target: FinanceNavTarget): string {
  return buildFinanceHref(target);
}

const REVENUE_META: Record<
  "eligible" | "billing_assistant" | "awaiting_collection" | "stopped",
  {
    kind: FinanceMyTaskKind;
    title: string;
    requirement: string;
    movesTo: string;
  }
> = {
  eligible: {
    kind: "revenue_match",
    title: "مطابقة الأتعاب",
    requirement: "تأكيد بنود التقييم · الرفع · المفاتيح",
    movesTo: "مساعد الفوترة",
  },
  billing_assistant: {
    kind: "revenue_invoice",
    title: "تسجيل الفاتورة ورفعها على إنفاذ",
    requirement: "رقم الفاتورة + مرفق إلزامي",
    movesTo: "بانتظار التحصيل",
  },
  awaiting_collection: {
    kind: "revenue_collect",
    title: "تسجيل التحويل عند وروده",
    requirement: "مبلغ التحويل (جزئي أو كامل)",
    movesTo: "محصّلة",
  },
  stopped: {
    kind: "revenue_collect",
    title: "استدعاء ومتابعة التحصيل",
    requirement: "متابعة مركز التصفية أو تسجيل التحويل",
    movesTo: "بانتظار التحصيل / محصّلة",
  },
};

export function buildRevenueMyTasks(
  tracking: EnfazTrackingRowDto[],
): FinanceMyTask[] {
  const actionable = tracking.filter((r) => {
    const stage = resolveRevenueStage(r);
    return (
      stage === "eligible" ||
      stage === "billing_assistant" ||
      stage === "awaiting_collection" ||
      stage === "stopped"
    );
  });

  const byStage = new Map<RevenueStage, EnfazTrackingRowDto[]>();
  for (const row of actionable) {
    const stage = resolveRevenueStage(row);
    const list = byStage.get(stage) ?? [];
    list.push(row);
    byStage.set(stage, list);
  }

  const tasks: FinanceMyTask[] = [];

  for (const stage of [
    "eligible",
    "billing_assistant",
    "awaiting_collection",
    "stopped",
  ] as const) {
    const rows = byStage.get(stage) ?? [];
    for (const { poNumber, rows: group } of groupRowsByPo(rows)) {
      const meta = REVENUE_META[stage];
      const ages = group
        .map((r) => daysSince(r.invoiceIssuedAtUtc ?? r.completedAtUtc))
        .filter((d): d is number => d != null);
      const ageDays = ages.length ? Math.max(...ages) : null;
      const overdue = group.some((r) => r.isOverdue) || stage === "stopped";
      const fee = group.reduce((s, r) => s + (r.enfazFeeSar || 0), 0);
      const inv = group.find((r) => r.invoiceNumber)?.invoiceNumber;
      const invDate = group.find((r) => r.invoiceIssuedAtUtc)?.invoiceIssuedAtUtc;
      const deedLabel =
        group.length === 1
          ? group[0].deedNumber || group[0].propertyLabel
          : `${group.length} معاملة`;

      const title =
        stage === "awaiting_collection" || stage === "stopped"
          ? inv
            ? `${meta.title} (${group.length} معاملة)`
            : meta.title
          : meta.title;

      tasks.push({
        id: `rev-${stage}-${poNumber}`,
        kind: meta.kind,
        domain: "revenue",
        title,
        reference: inv?.trim() || poNumber,
        subject: inv ? poNumber : deedLabel,
        amountSar: fee,
        requirement: meta.requirement,
        movesTo: meta.movesTo,
        ageDays: overdue ? ageDays ?? 30 : ageDays,
        ageNote: formatDateNote(invDate ?? group[0]?.completedAtUtc),
        href: href({
          area: "revenue",
          stage,
          po: poNumber,
        }),
        openLabel: "فتح الإجراء",
      });
    }
  }

  return tasks;
}

export function buildCostMyTasks(input: {
  readyLines: PartyBillingReadyLineDto[];
  statements: PartyBillingStatementDto[];
}): FinanceMyTask[] {
  const tasks: FinanceMyTask[] = [];

  if (input.readyLines.length > 0) {
    const byAssignee = new Map<string, PartyBillingReadyLineDto[]>();
    for (const line of input.readyLines) {
      const key = line.assigneeId?.trim() || "—";
      const list = byAssignee.get(key) ?? [];
      list.push(line);
      byAssignee.set(key, list);
    }
    for (const [assigneeId, lines] of byAssignee) {
      const net = lines.reduce((s, l) => s + l.netFeeSar, 0);
      const isVendor = lines.some((l) => l.payeeType === "vendor");
      const total = isVendor
        ? statementDisplayTotal({ totalNetSar: net, payeeType: "vendor" })
        : net;
      const ages = lines
        .map((l) => daysSince(l.accruedAtUtc ?? l.updatedAtUtc))
        .filter((d): d is number => d != null);
      tasks.push({
        id: `cost-dues-${assigneeId}`,
        kind: "cost_create_statement",
        domain: "costs",
        title: isVendor
          ? `تجهيز مسير صرف (${lines.length} بند)`
          : `إصدار أمر صرف (${lines.length} بند)`,
        reference: assigneeId === "—" ? "—" : assigneeId.slice(0, 12),
        subject: lines[0]?.propertyLabel || `${lines.length} بند`,
        amountSar: total,
        requirement: isVendor
          ? "اختيار البنود الجاهزة وتجهيز المسير"
          : "تجميع البنود في أمر صرف واحد",
        movesTo: isVendor ? "مسير مُعد — لدى المالية" : "أمر صرف — بانتظار الصرف",
        ageDays: ages.length ? Math.max(...ages) : null,
        ageNote: formatDateNote(lines[0]?.accruedAtUtc ?? lines[0]?.updatedAtUtc),
        href: href({
          area: "costs",
          section: "dues",
          party: assigneeId === "—" ? null : assigneeId,
        }),
        openLabel: "فتح الحساب",
      });
    }
  }

  for (const s of input.statements) {
    const baseRef = s.referenceNumber;
    const baseHref = href({
      area: "costs",
      section: "statements",
      statement: s.id,
      party: s.assigneeId || null,
    });
    const payee = s.payeeTypeLabel || "مستحق";
    const amount = statementDisplayTotal(s);

    if (s.status === "draft") {
      tasks.push({
        id: `cost-issue-${s.id}`,
        kind: "cost_issue_statement",
        domain: "costs",
        title:
          s.payeeType === "individual"
            ? "إصدار أمر الصرف"
            : "تحويل المسير للمكتب لإصدار الفاتورة",
        reference: baseRef,
        subject: payee,
        amountSar: amount,
        requirement:
          s.payeeType === "individual"
            ? "اعتماد أمر الصرف للأفراد"
            : "إرسال المسير للمكتب (القيمة مقفلة)",
        movesTo:
          s.payeeType === "individual"
            ? "بانتظار توثيق الصرف"
            : "بانتظار فاتورة المورّد",
        ageDays: daysSince(s.createdAtUtc),
        ageNote: formatDateNote(s.createdAtUtc),
        href: baseHref,
        openLabel: "فتح الإجراء",
        statementId: s.id,
      });
    } else if (s.status === "invoice_received") {
      // بعد إقرار المطابقة: يخرج من مهامي — توثيق الصرف من التكاليف فقط.
      if (s.vendorInvoiceMatched) {
        continue;
      }
      tasks.push({
        id: `cost-match-${s.id}`,
        kind: "cost_match_invoice",
        domain: "costs",
        title: "مطابقة فاتورة المورّد وقيدها",
        reference: baseRef,
        subject: payee,
        amountSar: amount,
        requirement: `مراجعة فاتورة ${s.vendorInvoiceNumber ?? "—"} (مقفلة على المسير)`,
        movesTo: "التكاليف · توثيق الصرف",
        ageDays: daysSince(s.vendorInvoiceSubmittedAtUtc ?? s.issuedAtUtc),
        ageNote: formatDateNote(s.vendorInvoiceSubmittedAtUtc ?? s.issuedAtUtc),
        href: baseHref,
        openLabel: "فتح الإجراء",
        statementId: s.id,
      });
    } else if (s.status === "issued" && s.payeeType === "individual") {
      // فرد: لا فاتورة — أمر صرف مباشر (مرجع منطق 4.2)
      tasks.push({
        id: `cost-close-${s.id}`,
        kind: "cost_close_statement",
        domain: "costs",
        title: "توثيق الصرف ورفع إيصال التحويل",
        reference: baseRef,
        subject: payee,
        amountSar: amount,
        requirement: "سند صرف + مرجع تحويل + إيصال",
        movesTo: "مدفوع",
        ageDays: daysSince(s.issuedAtUtc ?? s.createdAtUtc),
        ageNote: formatDateNote(s.issuedAtUtc ?? s.createdAtUtc),
        href: baseHref,
        openLabel: "فتح الإجراء",
        statementId: s.id,
      });
    }
    // issued + vendor: بانتظار المكتب — ليس إجراء مالية (بوابة المكتب / مرجع §5)
  }

  return tasks;
}

export function buildFinanceMyTasks(input: {
  tracking: EnfazTrackingRowDto[];
  readyLines: PartyBillingReadyLineDto[];
  statements: PartyBillingStatementDto[];
}): FinanceMyTask[] {
  const tasks = [
    ...buildRevenueMyTasks(input.tracking),
    ...buildCostMyTasks({
      readyLines: input.readyLines,
      statements: input.statements,
    }),
  ];

  return tasks.sort((a, b) => {
    const aa = a.ageDays ?? -1;
    const bb = b.ageDays ?? -1;
    if (aa >= 0 && bb >= 0 && aa !== bb) return bb - aa;
    if (aa >= 0 && bb < 0) return -1;
    if (aa < 0 && bb >= 0) return 1;
    return a.title.localeCompare(b.title, "ar");
  });
}

/** بطاقات KPI لمهامي — مطابقة اللقطة */
export function buildFinanceMyTasksKpis(tasks: FinanceMyTask[]) {
  const match = tasks.filter((t) => t.kind === "revenue_match");
  const collect = tasks.filter((t) => t.kind === "revenue_collect");
  const docs = tasks.filter(
    (t) =>
      t.kind === "cost_create_statement" ||
      t.kind === "cost_issue_statement" ||
      t.kind === "cost_match_invoice",
  );
  const close = tasks.filter((t) => t.kind === "cost_close_statement");
  const collectAmt = collect.reduce((s, t) => s + t.amountSar, 0);

  return {
    matchCount: match.length,
    collectCount: collect.length,
    collectAmountSar: collectAmt,
    docsCount: docs.length,
    closeCount: close.length,
  };
}
