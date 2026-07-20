import type { StatusPillStyle } from "@platform/design-system";
import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import {
  buildPrimaryDataTableRow,
  findPropertyForTask,
} from "./my-task-row";
import type { PoIntakeRecord } from "./po-intake-data";
import {
  taskKindLabel,
  type WorkflowTask,
} from "./tasks-storage";
import { poPropertyDetailPath, poPropertiesPath } from "../po-routes";

/** Short phase labels matching Case Study.html `renderAllTransactions`. */
export function allTransactionsPhaseLabel(task: WorkflowTask): string {
  if (task.status === "completed" || task.phase === "done") return "مكتمل";
  if (task.kind === "government-review") return "المراجعة الحكومية";
  if (task.kind === "field-inspection") return "معاينة العقار";
  if (task.kind === "property-appraisal") return "تقييم العقار";
  if (task.kind === "valuation-coordination") return "استلام التقييم";
  if (task.kind === "engineering-survey") return "الرفع المساحي";
  if (task.phase === "enfath") return "البيانات الأولية";
  if (task.phase === "bourse") return "البورصة";
  if (task.phase === "distribution") return "التوزيع";
  if (task.phase === "case-study") return "دراسة الحالة";
  if (task.phase === "obstruction") return "تعذر";
  return taskKindLabel(task.kind);
}

export function allTransactionsPhaseStyle(task: WorkflowTask): StatusPillStyle {
  const label = allTransactionsPhaseLabel(task);
  if (label === "مكتمل") {
    return { base: "var(--success)", fg: "var(--success-text)" };
  }
  if (label === "البورصة" || label === "تعذر") {
    return { base: "var(--amber)", fg: "var(--amber-text)" };
  }
  if (label === "البيانات الأولية") {
    return { base: "#8a8d96", fg: "#696c75" };
  }
  // دراسة الحالة / التوزيع / المراجعة الحكومية / party stages
  return { base: "var(--gold)", fg: "var(--gold-d)" };
}

/** Deed cell: `صك {n}` as in Case Study.html. */
export function formatAllTransactionsDeedCell(deedOrSlot: string): string {
  const v = deedOrSlot.trim();
  if (!v || v === "—") return "—";
  if (v.startsWith("صك ")) return v;
  return `صك ${v}`;
}

export type AllTransactionsQueueRowMeta = {
  task: WorkflowTask;
  deed: string;
  deedCell: string;
  poNumber: string;
  assignmentType: string;
  city: string;
  district: string;
  phaseLabel: string;
  propertyId?: string;
};

export function buildAllTransactionsQueueRowMeta(
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
  now: Date,
): AllTransactionsQueueRowMeta[] {
  return tasks.map((task) => {
    const record = poByNumber.get(task.poNumber.trim());
    const property = findPropertyForTask(record, task);
    const row = buildPrimaryDataTableRow(task, property, record, now);
    const deed = row.propertySlot;
    return {
      task,
      deed,
      deedCell: formatAllTransactionsDeedCell(deed),
      poNumber: task.poNumber.trim(),
      assignmentType: row.assignmentType,
      city: row.city,
      district: row.district,
      phaseLabel: allTransactionsPhaseLabel(task),
      propertyId: property?.id ?? task.propertyId,
    };
  });
}

export function filterAllTransactionsQueueRows(
  rows: AllTransactionsQueueRowMeta[],
  filters: {
    search: string;
    statusFilter: string;
    typeFilter: string;
  },
): WorkflowTask[] {
  const q = filters.search.trim().toLowerCase();
  return rows
    .filter((row) => {
      if (filters.typeFilter && row.assignmentType !== filters.typeFilter) {
        return false;
      }
      if (filters.statusFilter && row.phaseLabel !== filters.statusFilter) {
        return false;
      }
      if (!q) return true;
      const hay = [
        row.deed,
        row.deedCell,
        row.poNumber,
        row.assignmentType,
        row.city,
        row.district,
        row.phaseLabel,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .map((row) => row.task);
}

export function uniqueSortedPoOrder(poNumbers: string[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const po of poNumbers) {
    const key = po.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    order.push(key);
  }
  return order;
}

export function buildAllTransactionsRowMoreItems(options: {
  task: WorkflowTask;
  propertyId?: string;
  openTask: () => void;
  router: { push: (href: string) => void };
}): RowMoreMenuItem[] {
  const po = options.task.poNumber.trim();
  const propertyId = options.propertyId?.trim();
  const propertyHref = propertyId
    ? poPropertyDetailPath(po, propertyId)
    : po
      ? poPropertiesPath(po)
      : null;
  const propertyBasicHref = propertyId
    ? poPropertyDetailPath(po, propertyId, "basic")
    : propertyHref;

  const items: RowMoreMenuItem[] = [
    {
      id: "open",
      label: "فتح المعاملة",
      onClick: options.openTask,
    },
  ];

  if (propertyHref) {
    items.push({
      id: "phase-log",
      label: "سجل المراحل",
      onClick: () => options.router.push(propertyHref),
    });
  }
  if (propertyBasicHref) {
    items.push({
      id: "property-data",
      label: "عرض بيانات العقار",
      onClick: () => options.router.push(propertyBasicHref),
    });
  }

  return items;
}
