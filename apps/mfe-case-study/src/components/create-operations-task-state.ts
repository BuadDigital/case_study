/**
 * Pure state behind `CreateOperationsTaskModal`: the form reducer, the
 * link-scope option builders, the delegation-letter row snapshots and the
 * validation + payload builder for `createOperationsTaskRecord`. No React,
 * no I/O — the clock arrives as a `now` argument so due dates stay testable.
 */
import type {
  CreateOperationsTaskRequest,
  OperationsTaskLetterRowDto,
} from "@platform/api-client";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import { pad2 } from "@platform/app-shared/format/date";
import { parseLocaleNumber } from "@platform/app-shared/format/number";
import {
  getEngineeringOffices,
  type DistributionAssignee,
} from "../lib/app-data/distribution-parties";
import { assigneesForOperationsTaskType } from "../lib/app-data/operations-task-assignees";
import {
  ENGINEERING_SURVEY_TASK_TYPE,
  OPERATIONS_TASK_TYPE_LABELS,
} from "../lib/app-data/operations-task-display";
import {
  formatPropertyDeedDisplay,
  showsCourtFields,
  type PoIntakeRecord,
} from "../lib/app-data/po-intake-data";

/**
 * «رفع مساحي» in «مهمة جديدة» (Omar 2026-11-11) — the one place the engineering office is added after
 * the distribution. It is not an operations task: it adds the office's own survey task to the
 * transaction (see `create-engineering-survey-task`), so the form asks for the office and the deed only.
 */
export { ENGINEERING_SURVEY_TASK_TYPE };

export const TASK_TYPES = ["general", "court_visit", ENGINEERING_SURVEY_TASK_TYPE] as const;

/** The types the viewer may create: «رفع مساحي» only for who may add the office (`canRedistributeParties`). */
export function taskTypesFor(canAddSurvey: boolean): readonly string[] {
  return canAddSurvey ? TASK_TYPES : TASK_TYPES.filter((t) => t !== ENGINEERING_SURVEY_TASK_TYPE);
}

/** Unified link scope for court visit and general task (includes general). */
export const LINK_SCOPES = [
  "work_order",
  "transaction",
  "multi",
  "general",
] as const;

export const PRIORITY_OFFSET_MS: Record<string, number> = {
  high: 4 * 3_600_000,
  medium: 12 * 3_600_000,
  low: 24 * 3_600_000,
};

const DEFAULT_TITLES: Record<string, string> = {
  court_visit: "زيارة محكمة",
  general: "مهمة عامة",
  [ENGINEERING_SURVEY_TASK_TYPE]: "رفع مساحي",
};

export const DUE_CHIPS = [
  ["today", "اليوم"],
  ["tomorrow", "غداً"],
  ["after", "بعد غد"],
] as const;
type DueChip = (typeof DUE_CHIPS)[number][0];
const DUE_CHIP_OFFSET_DAYS: Record<DueChip, number> = {
  today: 0,
  tomorrow: 1,
  after: 2,
};

export type CreateOperationsTaskPrefill = {
  type?: string;
  scope?: string;
  poNumber?: string;
  deed?: string;
  title?: string;
};

export function toLocalDateValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toLocalTimeValue(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Remounts the form when the prefill changes — the modal keys on this. */
export function createTaskPrefillKey(
  prefill: CreateOperationsTaskPrefill | null | undefined,
): string {
  return JSON.stringify([
    prefill?.type,
    prefill?.scope,
    prefill?.poNumber,
    prefill?.deed,
    prefill?.title,
  ]);
}

export function buildLetterRowsForPo(
  record: PoIntakeRecord,
): OperationsTaskLetterRowDto[] {
  return record.properties
    .filter((p) => !p.isRemoved && p.court.trim())
    .map((p) => ({
      po: record.poNumber.trim(),
      deed: formatPropertyDeedDisplay(p) || p.deedNumber.trim() || "—",
      owner: p.ownerName?.trim() || "—",
      request: p.requestNumber?.trim() || "—",
      court: p.court.trim(),
      circuit: p.circuit.trim() || "—",
    }));
}

function buildLetterRowsForDeeds(
  records: PoIntakeRecord[],
  selectedDeeds: string[],
): OperationsTaskLetterRowDto[] {
  const want = new Set(selectedDeeds);
  const rows: OperationsTaskLetterRowDto[] = [];
  for (const record of records) {
    for (const row of buildLetterRowsForPo(record)) {
      if (want.has(row.deed)) rows.push(row);
    }
  }
  return rows;
}

/** One-deed rows for scope=transaction (must still carry court for court_visit). */
export function buildLetterRowsForDeed(
  records: PoIntakeRecord[],
  poNumber: string,
  deed: string,
): OperationsTaskLetterRowDto[] {
  const po = poNumber.trim();
  const d = deed.trim();
  if (!po || !d) return [];
  return buildLetterRowsForDeeds(
    records.filter((r) => r.poNumber.trim() === po),
    [d],
  );
}

export function allDeedOptions(
  records: PoIntakeRecord[],
): { deed: string; po: string }[] {
  const out: { deed: string; po: string }[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    for (const p of record.properties) {
      if (p.isRemoved) continue;
      const deed = formatPropertyDeedDisplay(p) || p.deedNumber.trim();
      if (!deed || seen.has(deed)) continue;
      seen.add(deed);
      out.push({ deed, po: record.poNumber.trim() });
    }
  }
  return out;
}

export function deedOptions(record: PoIntakeRecord | undefined): string[] {
  if (!record) return [];
  return record.properties
    .filter((p) => !p.isRemoved)
    .map((p) => formatPropertyDeedDisplay(p) || p.deedNumber.trim())
    .filter(Boolean);
}

export function assigneesForType(
  type: string,
  staffUsers: StaffUser[],
): DistributionAssignee[] {
  // The survey goes to an engineering office only — the same list the distribution offers.
  if (type === ENGINEERING_SURVEY_TASK_TYPE) return getEngineeringOffices(staffUsers);
  return assigneesForOperationsTaskType(type, staffUsers);
}

/** The type a prefill asks for, when the viewer may create it; anything else is a general task. */
export function prefillType(
  prefill: CreateOperationsTaskPrefill | null | undefined,
  allowedTypes: readonly string[] = TASK_TYPES,
): string {
  const raw = prefill?.type?.trim() || "general";
  return allowedTypes.includes(raw) ? raw : "general";
}

export function defaultDueFields(now = Date.now()): {
  date: string;
  time: string;
} {
  const due = new Date(now + PRIORITY_OFFSET_MS.medium);
  return { date: toLocalDateValue(due), time: toLocalTimeValue(due) };
}

/** court_visit only lists work orders on a court path. */
export function poOptionsForType(
  poRecords: PoIntakeRecord[],
  type: string,
): PoIntakeRecord[] {
  if (type === "court_visit") {
    return poRecords.filter((r) => showsCourtFields(r.assignmentType));
  }
  return poRecords;
}

export function selectedPoRecord(
  poOptions: PoIntakeRecord[],
  poNumber: string,
): PoIntakeRecord | undefined {
  return poOptions.find((r) => r.poNumber.trim() === poNumber.trim());
}

export function selectedAssigneeUser(
  staffUsers: StaffUser[],
  assigneeId: string,
): StaffUser | undefined {
  return staffUsers.find(
    (u) => u.distributionAssigneeId?.trim() === assigneeId.trim(),
  );
}

/** Cooperator reviewers need a create-time visit fee; employees do not. */
export function needsVisitFeeFor(
  type: string,
  assigneeId: string,
  assigneeUser: Pick<StaffUser, "type"> | undefined,
): boolean {
  return (
    type === "court_visit" &&
    Boolean(assigneeId) &&
    assigneeUser?.type !== "internal"
  );
}

/**
 * Any other task may carry a fee agreed on it (2026-11-05) — optional, and only for a cooperator.
 *
 * How it works: not a court visit, an assignee picked, and that assignee not an internal employee.
 * Edge cases: an empty amount means a free task; the server refuses an employee's fee anyway.
 */
export function allowsAgreedTaskFeeFor(
  type: string,
  assigneeId: string,
  assigneeUser: Pick<StaffUser, "type"> | undefined,
): boolean {
  return (
    type !== "court_visit" &&
    Boolean(assigneeId) &&
    assigneeUser?.type !== "internal"
  );
}

/**
 * Keep a still-valid assignee; otherwise fall back to the first one (or clear
 * when none qualify). `null` = leave the selection untouched.
 * `pickFirst: false` (the survey's office) never chooses for the user: an assignee that no longer
 * qualifies is cleared and the field waits for a choice.
 */
export function resolveAssigneeSelection(
  assignees: DistributionAssignee[],
  assigneeId: string,
  staffLoading: boolean,
  pickFirst = true,
): { id: string; name: string } | null {
  if (staffLoading) return null;
  if (assignees.length === 0) return { id: "", name: "" };
  if (assignees.some((a) => a.id === assigneeId)) return null;
  if (!pickFirst) return assigneeId ? { id: "", name: "" } : null;
  const first = assignees[0]!;
  return { id: first.id, name: first.name };
}

export type CreateOperationsTaskForm = {
  type: string;
  scope: string;
  title: string;
  description: string;
  priority: string;
  poNumber: string;
  deed: string;
  selectedDeeds: string[];
  assigneeId: string;
  assigneeName: string;
  visitFeeAmountSar: string;
  dueDate: string;
  dueTime: string;
  dueChip: DueChip | null;
  /** «رفع مساحي» on a property the survey rule asks no survey for: why it is wanted. */
  surveyExceptionReason: string;
};

export function initialCreateOperationsTaskForm(
  prefill: CreateOperationsTaskPrefill | null | undefined,
  now = Date.now(),
  allowedTypes: readonly string[] = TASK_TYPES,
): CreateOperationsTaskForm {
  const due = defaultDueFields(now);
  const type = prefillType(prefill, allowedTypes);
  const deed = prefill?.deed?.trim() || "";
  return {
    type,
    // The survey is always on one deed.
    scope:
      type === ENGINEERING_SURVEY_TASK_TYPE ? "transaction" : prefill?.scope?.trim() || "work_order",
    title: prefill?.title?.trim() || DEFAULT_TITLES[type] || "مهمة",
    description: "",
    priority: "medium",
    poNumber: prefill?.poNumber?.trim() || "",
    deed,
    selectedDeeds: deed ? [deed] : [],
    assigneeId: "",
    assigneeName: "",
    visitFeeAmountSar: "",
    dueDate: due.date,
    dueTime: due.time,
    dueChip: null,
    surveyExceptionReason: "",
  };
}

export type CreateOperationsTaskAction =
  | { type: "set-type"; value: string }
  | { type: "set-scope"; value: string }
  | { type: "set-description"; value: string }
  | { type: "set-priority"; value: string; now: number }
  | { type: "apply-due-chip"; chip: DueChip; now: number }
  | { type: "set-due-date"; value: string }
  | { type: "set-due-time"; value: string }
  | { type: "set-po"; value: string }
  | { type: "set-deed"; value: string }
  | { type: "toggle-deed"; value: string }
  | { type: "set-assignee"; id: string; name: string }
  | { type: "set-visit-fee"; value: string }
  | { type: "set-survey-reason"; value: string };

export function createOperationsTaskReducer(
  state: CreateOperationsTaskForm,
  action: CreateOperationsTaskAction,
): CreateOperationsTaskForm {
  switch (action.type) {
    case "set-type":
      // HTML `tfType`: the title follows the type — there is no title field.
      // «رفع مساحي» is on one deed and its office is chosen, never carried over from another type.
      return {
        ...state,
        type: action.value,
        title: DEFAULT_TITLES[action.value] ?? "مهمة",
        ...(action.value === ENGINEERING_SURVEY_TASK_TYPE
          ? { scope: "transaction", assigneeId: "", assigneeName: "" }
          : {}),
      };
    case "set-scope":
      return { ...state, scope: action.value };
    case "set-description":
      return { ...state, description: action.value };
    case "set-priority": {
      // Priority proposes the due moment: now + offset, clearing any day chip.
      const due = new Date(
        action.now +
          (PRIORITY_OFFSET_MS[action.value] ?? PRIORITY_OFFSET_MS.medium),
      );
      return {
        ...state,
        priority: action.value,
        dueDate: toLocalDateValue(due),
        dueTime: toLocalTimeValue(due),
        dueChip: null,
      };
    }
    case "apply-due-chip": {
      // Day chips move the date only; the time of day is left as entered.
      const d = new Date(action.now);
      d.setDate(d.getDate() + DUE_CHIP_OFFSET_DAYS[action.chip]);
      return { ...state, dueDate: toLocalDateValue(d), dueChip: action.chip };
    }
    case "set-due-date":
      return { ...state, dueDate: action.value, dueChip: null };
    case "set-due-time":
      return { ...state, dueTime: action.value };
    case "set-po":
      return { ...state, poNumber: action.value, deed: "", selectedDeeds: [] };
    case "set-deed":
      return { ...state, deed: action.value };
    case "toggle-deed":
      return {
        ...state,
        selectedDeeds: state.selectedDeeds.includes(action.value)
          ? state.selectedDeeds.filter((d) => d !== action.value)
          : [...state.selectedDeeds, action.value],
      };
    case "set-assignee":
      if (
        state.assigneeId === action.id &&
        state.assigneeName === action.name
      ) {
        return state;
      }
      return { ...state, assigneeId: action.id, assigneeName: action.name };
    case "set-visit-fee":
      if (state.visitFeeAmountSar === action.value) return state;
      return { ...state, visitFeeAmountSar: action.value };
    case "set-survey-reason":
      return { ...state, surveyExceptionReason: action.value };
  }
}

/** Rows shown in the delegation-letter preview while the form is being filled. */
export function letterPreviewRows(
  form: Pick<
    CreateOperationsTaskForm,
    "type" | "scope" | "selectedDeeds" | "poNumber" | "deed"
  >,
  poOptions: PoIntakeRecord[],
): OperationsTaskLetterRowDto[] {
  if (form.type !== "court_visit") return [];
  if (form.scope === "multi" && form.selectedDeeds.length > 0) {
    return buildLetterRowsForDeeds(poOptions, form.selectedDeeds);
  }
  if (
    form.scope === "transaction" &&
    form.poNumber.trim() &&
    form.deed.trim()
  ) {
    return buildLetterRowsForDeed(poOptions, form.poNumber, form.deed);
  }
  const selectedPo = selectedPoRecord(poOptions, form.poNumber);
  if (!selectedPo) return [];
  return buildLetterRowsForPo(selectedPo);
}

/** Local date + time inputs → a Date; a missing time defaults to noon. */
export function parseDueAt(dueDate: string, dueTime: string): Date {
  const [y, mo, da] = dueDate.split("-").map(Number);
  const [hh, mm] = (dueTime || "12:00").split(":").map(Number);
  return new Date(y!, (mo ?? 1) - 1, da ?? 1, hh ?? 12, mm ?? 0);
}

type CreateOperationsTaskSubmission =
  | { ok: true; body: CreateOperationsTaskRequest }
  | { ok: false; error: string };

function invalid(error: string): CreateOperationsTaskSubmission {
  return { ok: false, error };
}

/** Validates the form top to bottom and builds the create request. */
export function buildCreateOperationsTaskSubmission(
  form: CreateOperationsTaskForm,
  {
    poOptions,
    needsVisitFee,
    allowsAgreedTaskFee,
    prefillTitle,
  }: {
    poOptions: PoIntakeRecord[];
    needsVisitFee: boolean;
    /** The optional agreed fee of a task that is not a court visit. */
    allowsAgreedTaskFee?: boolean;
    prefillTitle?: string | null;
  },
): CreateOperationsTaskSubmission {
  const { type, scope, poNumber, deed, selectedDeeds, assigneeId } = form;
  // HTML `tfSubmit`: title defaults to TASK_TYPES[type].label (no title field).
  const trimmedTitle = (
    prefillTitle?.trim() ||
    form.title.trim() ||
    OPERATIONS_TASK_TYPE_LABELS[type] ||
    ""
  ).trim();
  if (!type.trim()) return invalid("نوع المهمة مطلوب");
  if (!trimmedTitle) return invalid("العنوان مطلوب");
  if (!assigneeId.trim()) return invalid("المنفّذ مطلوب");

  let parsedVisitFee: number | undefined;
  if (needsVisitFee) {
    const raw = form.visitFeeAmountSar.trim();
    // «١٥٠» / «1,250» / «150 ريال» read the same as the server reads typed numbers.
    const amount = parseLocaleNumber(raw);
    if (!raw || !Number.isFinite(amount) || amount <= 0) {
      return invalid("مبلغ أتعاب الزيارة مطلوب للمتعاون");
    }
    parsedVisitFee = amount;
  } else if (allowsAgreedTaskFee && form.visitFeeAmountSar.trim()) {
    const amount = parseLocaleNumber(form.visitFeeAmountSar.trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      return invalid(
        "مبلغ أتعاب المهمة يجب أن يكون أكبر من صفر، أو اتركه فارغًا لمهمة بلا أتعاب",
      );
    }
    parsedVisitFee = amount;
  }

  const selectedPo = selectedPoRecord(poOptions, poNumber);
  let deedsPayload: string[] | undefined;
  let poPayload: string | undefined;
  let letterRows: OperationsTaskLetterRowDto[] | undefined;

  if (scope === "work_order") {
    const po = poNumber.trim();
    if (!po) return invalid("اختر أمر عمل");
    poPayload = po;
    if (type === "court_visit") {
      if (!selectedPo || !showsCourtFields(selectedPo.assignmentType)) {
        return invalid("نوع الإسناد لا يتطلب محاكم");
      }
      letterRows = buildLetterRowsForPo(selectedPo);
      if (letterRows.length === 0)
        return invalid("لا توجد عقارات بمحكمة مسجّلة");
      deedsPayload = letterRows.map((r) => r.deed);
    } else {
      deedsPayload = deedOptions(selectedPo);
    }
  } else if (scope === "transaction") {
    const po = poNumber.trim();
    const d = deed.trim();
    if (!po || !d) return invalid("اختر أمر عمل وصكاً واحداً");
    poPayload = po;
    deedsPayload = [d];
    if (type === "court_visit") {
      letterRows = buildLetterRowsForDeed(poOptions, po, d);
      if (letterRows.length === 0) {
        return invalid(
          "هذا الصك بلا محكمة مسجّلة — لا يمكن إنشاء صف خطاب التكليف. أكمل بيانات المحكمة في العقار ثم أعد المحاولة.",
        );
      }
    }
  } else if (scope === "multi") {
    if (selectedDeeds.length < 2) return invalid("اختر صكّين فأكثر");
    deedsPayload = selectedDeeds;
    const firstPo =
      allDeedOptions(poOptions).find((d) => selectedDeeds.includes(d.deed))
        ?.po || poNumber.trim();
    poPayload = firstPo || undefined;
    if (type === "court_visit") {
      letterRows = buildLetterRowsForDeeds(poOptions, selectedDeeds);
      if (letterRows.length < 2)
        return invalid("الصكوك المحددة يجب أن تحمل محكمة مسجّلة");
    }
  }

  if (!form.dueDate.trim()) return invalid("موعد الاستحقاق مطلوب");

  return {
    ok: true,
    body: {
      type,
      title: trimmedTitle,
      description: form.description.trim() || undefined,
      scope,
      poNumber: poPayload,
      deeds: deedsPayload,
      assigneeId: assigneeId.trim(),
      assigneeName: form.assigneeName.trim(),
      priority: form.priority,
      dueAtUtc: parseDueAt(form.dueDate, form.dueTime).toISOString(),
      letterRows,
      visitFeeAmountSar: parsedVisitFee,
    },
  };
}
