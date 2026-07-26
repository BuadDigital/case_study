import { filterTasksForCaseStudy } from "@platform/app-shared/prototype/active-transactions";
import { filterTasksForPartyKind } from "@platform/app-shared/prototype/party-task-pages";
import type { PageId } from "@platform/types";
import type {
  FieldInspectionWorkspaceListItemDto,
  InspectorFeeRowDto,
  PendingBoursePropertyDto,
} from "@platform/api-client";
import { getCachedPartySubmission } from "@platform/app-shared/prototype/party-submission-api";
import { filterEngineeringSurveyListedTasks } from "@engineering-office/mfe/lib/engineering-survey-queue";
import { filterAppraiserListedTasks } from "@evaluator/mfe/lib/evaluator/evaluator-queue";
import {
  isDateOnlyTodayInRiyadh,
  isInstantTodayInRiyadh,
} from "./active-transactions-situation";
import { resolveRemainingTime } from "./my-task-row";
import type { PoIntakeRecord } from "./po-intake-data";
import {
  filterTasksForBourseInquiry,
  filterTasksForDistribution,
  filterTasksForPrimaryData,
} from "./transaction-filters";
import type { WorkflowTask } from "./tasks-storage";
import { isListedQueueTask, isTaskOnSuspendedProperty } from "./suspended-transactions-storage";

export type SituationTone = "blue" | "warn" | "green" | "red";

export type PageSituationCardDef = {
  key: string;
  label: string;
  sub: string;
  tone: SituationTone;
  href?: string;
  /** When `sar`, KPI value is formatted as currency (engineering fees). */
  valueFormat?: "count" | "sar";
};

export type PageSituationValues = Record<string, number | undefined>;

const SUB_ASSIGNED = "المسندة إليك";
const SUB_TODAY = "اليوم";

function workflowCards(openLabel: string): PageSituationCardDef[] {
  return [
    { key: "open", label: openLabel, sub: SUB_ASSIGNED, tone: "blue" },
    { key: "arrivedToday", label: "وردت اليوم", sub: SUB_TODAY, tone: "warn" },
    { key: "doneToday", label: "أنجزت اليوم", sub: SUB_TODAY, tone: "green" },
    { key: "overdue", label: "متأخرة", sub: "عن المهلة", tone: "red" },
  ];
}

function partyCards(submittedLabel = "مُرسَلة"): PageSituationCardDef[] {
  return [
    { key: "total", label: "إجمالي المهام", sub: SUB_ASSIGNED, tone: "blue" },
    { key: "inProgress", label: "قيد التنفيذ", sub: "مسودة أو جارية", tone: "warn" },
    {
      key: "submitted",
      label: submittedLabel,
      sub: "بانتظار الاعتماد",
      tone: "green",
    },
    { key: "returned", label: "مُعادة", sub: "للتصحيح", tone: "red" },
  ];
}

export const PAGE_SITUATION_CARDS: Partial<Record<PageId, PageSituationCardDef[]>> =
  {
    "active-primary-data": workflowCards("معاملات مفتوحة"),
    "bourse-inquiry": [
      {
        key: "pending",
        label: "صكوك بانتظار البورصة",
        sub: "لإكمال البيانات",
        tone: "blue",
      },
      { key: "arrivedToday", label: "وردت اليوم", sub: "من إنفاذ", tone: "warn" },
      {
        key: "completedToday",
        label: "أُكملت اليوم",
        sub: "بيانات البورصة",
        tone: "green",
      },
      { key: "obstructed", label: "تعذر", sub: "قيد المعالجة", tone: "red" },
    ],
    "active-distribution": workflowCards("بانتظار التوزيع"),
    "active-case-study": workflowCards("دراسات مفتوحة"),
    "valuation-coordination": partyCards(),
    "property-inspection": partyCards("مكتملة"),
    "property-appraisal": partyCards(),
    "active-survey": [
      {
        key: "waiting",
        label: "بانتظار البدء",
        sub: "تتطلب المباشرة",
        tone: "blue",
      },
      {
        key: "inProgress",
        label: "قيد التنفيذ",
        sub: "جارية الآن",
        tone: "warn",
      },
      {
        key: "submitted",
        label: "بانتظار الاعتماد",
        sub: "مكتملة لم يعتمدها الأخصائي بعد",
        tone: "green",
      },
      {
        key: "unbilled",
        label: "غير مفوترة",
        sub: "بانتظار إصدار الفاتورة",
        tone: "warn",
        href: "/party-fees",
      },
    ],
    /** HTML Case Study «الأتعاب والصرف» KPI vocabulary. */
    "party-fees": [
      {
        key: "total",
        label: "إجمالي المطالبات",
        sub: "سجلات الأتعاب",
        tone: "blue",
      },
      {
        key: "toSupervisor",
        label: "بانتظار موافقة",
        sub: "مكتب أو مشرف",
        tone: "warn",
      },
      {
        key: "atFinance",
        label: "جاهزة للفوترة",
        sub: "لدى المالية",
        tone: "green",
      },
      {
        key: "disbursed",
        label: "مفوترة / مدفوعة",
        sub: "أُغلقت مالياً",
        tone: "green",
      },
    ],
  };

export function pageSituationCards(pageId: PageId): PageSituationCardDef[] | null {
  return PAGE_SITUATION_CARDS[pageId] ?? null;
}

/** Rows visible in the queue table — same filters as ActiveTransactionQueueView.listed. */
export function listedTasksForPage(
  pageId: PageId,
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
): WorkflowTask[] {
  return filterTasksForPage(pageId, tasks, poByNumber).filter((t) =>
    isListedQueueTask(t),
  );
}

function openWorkflowTasks(tasks: WorkflowTask[]): WorkflowTask[] {
  return tasks.filter((t) => t.status === "open" || t.status === "blocked");
}

export function computeWorkflowPageSituation(
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
  now = new Date(),
): Pick<PageSituationValues, "open" | "arrivedToday" | "doneToday" | "overdue"> {
  const open = openWorkflowTasks(tasks);
  let arrivedToday = 0;
  let doneToday = 0;
  let overdue = 0;

  for (const task of tasks) {
    if (isInstantTodayInRiyadh(task.createdAt, now)) arrivedToday += 1;
    if (
      task.status === "completed" &&
      isInstantTodayInRiyadh(task.updatedAt, now)
    ) {
      doneToday += 1;
    }
  }

  for (const task of open) {
    const record = poByNumber.get(task.poNumber.trim());
    if (resolveRemainingTime(record?.dueDateAt ?? "", now).status === "overdue") {
      overdue += 1;
    }
  }

  return {
    open: open.length,
    arrivedToday,
    doneToday,
    overdue,
  };
}

export function computePartySubmissionSituation(
  tasks: WorkflowTask[],
  options?: {
    inspectionWorkspaces?: Map<string, FieldInspectionWorkspaceListItemDto>;
  },
): Pick<
  PageSituationValues,
  "total" | "inProgress" | "submitted" | "returned" | "waiting"
> {
  const open = openWorkflowTasks(tasks);
  let waiting = 0;
  let inProgress = 0;
  let submitted = 0;
  let returned = 0;

  for (const task of open) {
    const bucket = classifyPartyTask(task, options?.inspectionWorkspaces);
    if (bucket === "submitted") submitted += 1;
    else if (bucket === "returned") returned += 1;
    else if (bucket === "waiting") waiting += 1;
    else inProgress += 1;
  }

  return {
    total: open.length,
    waiting,
    inProgress,
    submitted,
    returned,
  };
}

function classifyPartyTask(
  task: WorkflowTask,
  inspectionWorkspaces?: Map<string, FieldInspectionWorkspaceListItemDto>,
): "waiting" | "in_progress" | "submitted" | "returned" {
  if (task.kind === "field-inspection") {
    const workspace = inspectionWorkspaces?.get(task.id);
    if (task.status === "completed" || workspace?.status === "submitted") {
      return "submitted";
    }
    if (workspace?.status === "reopened") return "returned";
    if (!workspace) return "waiting";
    return "in_progress";
  }

  const dto = getCachedPartySubmission(task.id);
  const status = dto?.status;
  if (status === "submitted" || task.status === "completed") return "submitted";
  if (status === "reopened") return "returned";
  if (!dto || status === "draft") {
    // Engineering survey: treat empty/new drafts as waiting to start.
    if (task.kind === "engineering-survey") {
      const hasProgress =
        Boolean(dto) &&
        ((typeof (dto.payload as { latitude?: string })?.latitude === "string" &&
          Boolean((dto.payload as { latitude?: string }).latitude?.trim())) ||
          (typeof (dto.payload as { surveyReportFileName?: string })
            ?.surveyReportFileName === "string" &&
            Boolean(
              (
                dto.payload as { surveyReportFileName?: string }
              ).surveyReportFileName?.trim(),
            )));
      if (!hasProgress) return "waiting";
    } else if (!dto) {
      return "waiting";
    }
  }
  return "in_progress";
}

export function computeBourseSituation(input: {
  pending: PendingBoursePropertyDto[];
  tasks: WorkflowTask[];
  poByNumber: Map<string, PoIntakeRecord>;
  obstructedCount: number;
  now?: Date;
}): Pick<
  PageSituationValues,
  "pending" | "arrivedToday" | "completedToday" | "obstructed"
> {
  const now = input.now ?? new Date();
  const pending = input.pending.length;
  const arrivedToday = input.pending.filter((item) =>
    isDateOnlyTodayInRiyadh(item.receivedFromEnfathAt, now),
  ).length;
  const completedToday = filterTasksForBourseInquiry(
    input.tasks,
    input.poByNumber,
  ).filter(
    (t) =>
      t.status === "completed" && isInstantTodayInRiyadh(t.updatedAt, now),
  ).length;

  return {
    pending,
    arrivedToday,
    completedToday,
    obstructed: input.obstructedCount,
  };
}

export function computeFeesPageSituation(
  rows: InspectorFeeRowDto[],
): Pick<
  PageSituationValues,
  "total" | "toSupervisor" | "atFinance" | "disbursed"
> {
  let toSupervisor = 0;
  let atFinance = 0;
  let disbursed = 0;

  for (const row of rows) {
    if (
      row.billingStatus === "sup-review" ||
      row.billingStatus === "office-review" ||
      row.billingStatus === "disputed"
    ) {
      toSupervisor += 1;
    }
    if (
      row.billingStatus === "at-finance" ||
      row.billingStatus === "deferred" ||
      row.billingStatus === "in-statement" ||
      row.billingStatus === "disb-req"
    ) {
      atFinance += 1;
    }
    if (row.billingStatus === "disbursed") disbursed += 1;
  }

  return {
    total: rows.length,
    toSupervisor,
    atFinance,
    disbursed,
  };
}

/** Case Study.html `renderEngFees` KPI sums (SAR) for المكتب الهندسي. */
export function computeEngineeringFeesSituation(
  rows: InspectorFeeRowDto[],
): Pick<
  PageSituationValues,
  "outstanding" | "pending" | "ready" | "paid"
> {
  let outstanding = 0;
  let pending = 0;
  let ready = 0;
  let paid = 0;

  for (const row of rows) {
    const net = Number(row.netFeeSar) || 0;
    if (row.billingStatus !== "disbursed") outstanding += net;
    if (row.billingStatus === "office-review") pending += net;
    else if (row.billingStatus === "disputed") pending += net;
    else if (
      row.billingStatus === "at-finance" ||
      row.billingStatus === "deferred" ||
      row.billingStatus === "in-statement" ||
      row.billingStatus === "disb-req"
    ) {
      ready += net;
    } else if (row.billingStatus === "disbursed") {
      paid += net;
    }
  }

  return { outstanding, pending, ready, paid };
}

/** Case Study.html engineering fees KPI band. */
export const ENGINEERING_FEES_SITUATION_CARDS: PageSituationCardDef[] = [
  {
    key: "outstanding",
    label: "إجمالي المستحق غير المفوتر",
    sub: "كل استحقاقاتكم التي لم تُصرف بعد",
    tone: "blue",
    valueFormat: "sar",
  },
  {
    key: "pending",
    label: "بانتظار إفادتكم",
    sub: "تعديلات تسعير تنتظر إفادتكم",
    tone: "warn",
    valueFormat: "sar",
  },
  {
    key: "ready",
    label: "جاهزة للفوترة",
    sub: "تشمل المرحَّل — بانتظار كشف المحاسب",
    tone: "blue",
    valueFormat: "sar",
  },
  {
    key: "paid",
    label: "مفوترة / مدفوعة",
    sub: "إجمالي الكشوف المصروفة الموثَّقة",
    tone: "green",
    valueFormat: "sar",
  },
];

export function computeUnbilledFeeCount(rows: InspectorFeeRowDto[]): number {
  return rows.filter(
    (r) =>
      r.billingStatus !== "disbursed" &&
      r.taskKind === "engineering-survey",
  ).length;
}

export function filterTasksForPage(
  pageId: PageId,
  tasks: WorkflowTask[],
  poByNumber: Map<string, PoIntakeRecord>,
): WorkflowTask[] {
  switch (pageId) {
    case "active-primary-data":
      return filterTasksForPrimaryData(tasks, poByNumber);
    case "active-distribution":
      return filterTasksForDistribution(tasks, poByNumber);
    case "active-case-study":
      return filterTasksForCaseStudy(tasks);
    case "bourse-inquiry":
      return filterTasksForBourseInquiry(tasks, poByNumber);
    case "government-review":
      return tasks.filter((t) => t.kind === "government-review");
    case "valuation-coordination":
      return filterTasksForPartyKind(tasks, "valuation-coordination");
    case "property-inspection":
      return filterTasksForPartyKind(tasks, "field-inspection");
    case "property-appraisal":
      return filterAppraiserListedTasks(
        filterTasksForPartyKind(tasks, "property-appraisal"),
      );
    case "active-survey":
      return filterEngineeringSurveyListedTasks(
        filterTasksForPartyKind(tasks, "engineering-survey"),
      );
    default:
      return tasks;
  }
}

export function computePageSituationValues(
  pageId: PageId,
  input: {
    tasks: WorkflowTask[];
    poByNumber: Map<string, PoIntakeRecord>;
    pendingBourse?: PendingBoursePropertyDto[];
    obstructedCount?: number;
    inspectionWorkspaces?: Map<string, FieldInspectionWorkspaceListItemDto>;
    unbilledFeeCount?: number;
    now?: Date;
  },
): PageSituationValues | null {
  const cards = pageSituationCards(pageId);
  if (!cards) return null;

  const scoped = listedTasksForPage(pageId, input.tasks, input.poByNumber);
  const workflowSituationTasks = filterTasksForPage(
    pageId,
    input.tasks,
    input.poByNumber,
  ).filter((t) => !isTaskOnSuspendedProperty(t));

  if (pageId === "bourse-inquiry") {
    return computeBourseSituation({
      pending: input.pendingBourse ?? [],
      tasks: input.tasks,
      poByNumber: input.poByNumber,
      obstructedCount: input.obstructedCount ?? 0,
      now: input.now,
    });
  }

  if (pageId === "active-survey") {
    const allSurvey = filterTasksForPartyKind(
      input.tasks,
      "engineering-survey",
    ).filter((t) => !isTaskOnSuspendedProperty(t));
    const open = openWorkflowTasks(allSurvey);
    let waiting = 0;
    let inProgress = 0;
    let submitted = 0;
    for (const task of allSurvey) {
      const bucket = classifyPartyTask(task);
      if (bucket === "submitted" || task.status === "completed") {
        submitted += 1;
        continue;
      }
      if (!open.includes(task)) continue;
      if (bucket === "waiting") waiting += 1;
      else if (bucket === "returned") inProgress += 1;
      else inProgress += 1;
    }
    return {
      waiting,
      inProgress,
      submitted,
      unbilled: input.unbilledFeeCount ?? 0,
    };
  }

  if (
    pageId === "valuation-coordination" ||
    pageId === "property-inspection" ||
    pageId === "property-appraisal"
  ) {
    return computePartySubmissionSituation(scoped, {
      inspectionWorkspaces: input.inspectionWorkspaces,
    });
  }

  return computeWorkflowPageSituation(
    workflowSituationTasks,
    input.poByNumber,
    input.now,
  );
}
