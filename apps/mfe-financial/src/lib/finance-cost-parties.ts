/**
 * تجميع بيانات التكاليف حسب المستحق — لعرض قائمة المستحقين.
 */
import type {
  PartyBillingReadyLineDto,
  PartyBillingStatementDto,
} from "@platform/api-client";
import { resolvePartyName } from "@platform/app-shared/fees/party-fee-meta";
import type { StaffUser } from "@platform/app-shared/prototype/constants";

export type FinanceCostParty = {
  assigneeId: string;
  name: string;
  payeeType: "vendor" | "individual" | null;
  payeeTypeLabel: string;
  taskKindLabel: string;
  phone: string | null;
  /** مستحق مفتوح (جاهز) */
  dueSar: number;
  /** في مسيرات/أوامر غير مدفوعة */
  inStatementSar: number;
  paidSar: number;
  /** بنود جاهزة للصرف (عداد) */
  pendingLines: number;
  openStatements: number;
  /** إجمالي مستحق له الآن (مع ضريبة المورّد 15٪) */
  balanceSar: number;
};

const TASK_KIND_AR: Record<string, string> = {
  "field-inspection": "المعاين",
  "engineering-survey": "المكتب الهندسي",
  "government-review": "المراجع الحكومي",
  valuation: "المقيّم",
};

export function costTaxFactor(payeeType: "vendor" | "individual" | null): number {
  return payeeType === "vendor" ? 1.15 : 1;
}

export function applyCostTax(
  net: number,
  payeeType: "vendor" | "individual" | null,
): number {
  return Math.round(net * costTaxFactor(payeeType) * 100) / 100;
}

export function costTaskKindLabel(kind: string | null | undefined): string {
  if (!kind?.trim()) return "—";
  return TASK_KIND_AR[kind] ?? kind;
}

export function buildFinanceCostParties(input: {
  readyLines: PartyBillingReadyLineDto[];
  statements: PartyBillingStatementDto[];
  staffUsers: StaffUser[];
}): FinanceCostParty[] {
  const map = new Map<
    string,
    {
      payeeType: "vendor" | "individual" | null;
      payeeTypeLabel: string;
      taskKind: string | null;
      dueSar: number;
      inStatementSar: number;
      paidSar: number;
      pendingLines: number;
      openStatements: number;
    }
  >();

  const ensure = (id: string) => {
    let row = map.get(id);
    if (!row) {
      row = {
        payeeType: null,
        payeeTypeLabel: "",
        taskKind: null,
        dueSar: 0,
        inStatementSar: 0,
        paidSar: 0,
        pendingLines: 0,
        openStatements: 0,
      };
      map.set(id, row);
    }
    return row;
  };

  for (const line of input.readyLines) {
    const id = line.assigneeId?.trim() || "—";
    const row = ensure(id);
    row.dueSar += line.netFeeSar || 0;
    if ((line.netFeeSar || 0) > 0) row.pendingLines += 1;
    if (line.payeeType) {
      row.payeeType = line.payeeType;
      row.payeeTypeLabel = line.payeeTypeLabel || row.payeeTypeLabel;
    }
    if (line.taskKind) row.taskKind = line.taskKind;
  }

  for (const s of input.statements) {
    const id = s.assigneeId?.trim() || "—";
    const row = ensure(id);
    if (s.payeeType) {
      row.payeeType = s.payeeType;
      row.payeeTypeLabel =
        s.payeeTypeLabel || row.payeeTypeLabel || row.payeeType;
    }
    if (s.taskKind) row.taskKind = s.taskKind;
    if (s.status === "closed") {
      row.paidSar += s.totalNetSar || 0;
    } else if (s.status !== "cancelled") {
      row.inStatementSar += s.totalNetSar || 0;
      row.openStatements += 1;
    }
  }

  return [...map.entries()]
    .map(([assigneeId, row]) => {
      const openNet = row.dueSar + row.inStatementSar;
      return {
        assigneeId,
        name: resolvePartyName(assigneeId, input.staffUsers),
        payeeType: row.payeeType,
        payeeTypeLabel:
          row.payeeTypeLabel ||
          (row.payeeType === "individual" ? "فرد" : "مورّد"),
        taskKindLabel: costTaskKindLabel(row.taskKind),
        phone: null,
        dueSar: row.dueSar,
        inStatementSar: row.inStatementSar,
        paidSar: row.paidSar,
        pendingLines: row.pendingLines,
        openStatements: row.openStatements,
        balanceSar: applyCostTax(openNet, row.payeeType),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

export function statementDisplayTotal(s: {
  totalNetSar: number;
  payeeType: "vendor" | "individual" | string;
}): number {
  return applyCostTax(
    s.totalNetSar || 0,
    s.payeeType === "individual" ? "individual" : "vendor",
  );
}

export function daysSinceIsoCost(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

export function lineRefMain(line: {
  propertyLabel: string;
  poNumber: string;
  taskKind: string;
}): string {
  const label = (line.propertyLabel || "").trim();
  if (label) return label.split("—")[0]?.trim() || label;
  return line.poNumber || "—";
}

export function lineRefSub(line: {
  propertyLabel: string;
  poNumber: string;
  taskKind: string;
}): string {
  const parts: string[] = [];
  if (line.poNumber) parts.push(line.poNumber);
  const after = (line.propertyLabel || "").includes("—")
    ? line.propertyLabel.split("—").slice(1).join("—").trim()
    : "";
  if (after) parts.push(after);
  return parts.join(" · ") || costTaskKindLabel(line.taskKind);
}
