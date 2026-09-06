import { describe, expect, it } from "vitest";
import {
  allowsCompleteOutcome,
  buildCloseTaskSubmission,
  buildOperationsTaskRowMenu,
  buildStatusPatchBody,
  closeModalDefaults,
  closeModalTitles,
  emptyQueueMessage,
  INITIAL_OPERATIONS_TASK_QUERY,
  isOperationsTaskOverdue,
  keysRegisterPathForTask,
  localDueParts,
  needsEnvelopeRegistration,
  normalizeCourtVisitContacts,
  operationsTaskCardLinkMeta,
  operationsTaskCardTone,
  operationsTaskCountdownLabel,
  operationsTaskDetailActions,
  operationsTaskLinkChip,
  operationsTaskQueryReducer,
  operationsTaskReceiptCell,
  operationsTaskTimerTick,
  toggleSelectedId,
  toggleVisibleActiveSelection,
  toOperationsTaskListQuery,
  visibleOperationsTasks,
  type CloseTaskForm,
  type OperationsTaskQueryState,
} from "../operations-tasks-view-state";
import type { OperationsTask } from "../../lib/app-data/operations-tasks-model";

describe("operationsTaskQueryReducer", () => {
  it("stores each filter and keeps identity when the value is unchanged", () => {
    const state = INITIAL_OPERATIONS_TASK_QUERY;
    expect(
      operationsTaskQueryReducer(state, { type: "search", value: "PO-1" })
        .search,
    ).toBe("PO-1");
    expect(
      operationsTaskQueryReducer(state, { type: "status", value: "paused" })
        .statusFilter,
    ).toBe("paused");
    expect(
      operationsTaskQueryReducer(state, { type: "scope", value: "work_order" })
        .scopeFilter,
    ).toBe("work_order");
    expect(
      operationsTaskQueryReducer(state, {
        type: "taskType",
        value: "court_visit",
      }).typeFilter,
    ).toBe("court_visit");
    expect(
      operationsTaskQueryReducer(state, { type: "showAll", value: true })
        .showAll,
    ).toBe(true);

    expect(operationsTaskQueryReducer(state, { type: "search", value: "" })).toBe(
      state,
    );
    expect(
      operationsTaskQueryReducer(state, { type: "showAll", value: false }),
    ).toBe(state);
  });
});

describe("toOperationsTaskListQuery", () => {
  const base: OperationsTaskQueryState = INITIAL_OPERATIONS_TASK_QUERY;

  it("asks for the active rows only while the 'show all' toggle is off", () => {
    expect(
      toOperationsTaskListQuery(base, { excludeFailurePaused: false }),
    ).toEqual({ activeOnly: true, sort: "queue", dir: "desc" });
  });

  it("drops activeOnly once 'show all' is on", () => {
    expect(
      toOperationsTaskListQuery(
        { ...base, showAll: true },
        { excludeFailurePaused: false },
      ),
    ).not.toHaveProperty("activeOnly");
  });

  it("drops activeOnly when an explicit status is picked — the two would fight", () => {
    const query = toOperationsTaskListQuery(
      { ...base, statusFilter: "completed" },
      { excludeFailurePaused: false },
    );
    expect(query).not.toHaveProperty("activeOnly");
    expect(query.status).toBe("completed");
  });

  it("sends the executor scope and the failure-pause exclusion", () => {
    expect(
      toOperationsTaskListQuery(base, {
        assigneeId: "assignee-7",
        excludeFailurePaused: true,
      }),
    ).toMatchObject({ assigneeId: "assignee-7", excludeFailurePaused: true });
  });

  it("sends scope, type and the debounced search term", () => {
    expect(
      toOperationsTaskListQuery(
        {
          ...base,
          scopeFilter: "transaction",
          typeFilter: "court_visit",
          search: "typing",
        },
        { excludeFailurePaused: false, search: "  settled  " },
      ),
    ).toMatchObject({
      scope: "transaction",
      type: "court_visit",
      q: "settled",
    });
  });

  it("omits a blank search", () => {
    expect(
      toOperationsTaskListQuery(
        { ...base, search: "   " },
        { excludeFailurePaused: false },
      ),
    ).not.toHaveProperty("q");
  });

  it("always asks for the screen's own band order", () => {
    expect(
      toOperationsTaskListQuery(base, { excludeFailurePaused: false }),
    ).toMatchObject({ sort: "queue", dir: "desc" });
  });
});

describe("visibleOperationsTasks", () => {
  function task(over: Partial<OperationsTask> = {}): OperationsTask {
    return {
      id: "1",
      displayId: "OPS-1",
      title: "زيارة محكمة",
      type: "court_visit",
      scope: "transaction",
      status: "created",
      assigneeId: "a1",
      assigneeName: "سالم",
      deeds: ["310107029844"],
      createdAt: "2026-01-01T00:00:00.000Z",
      ...over,
    } as OperationsTask;
  }

  it("no longer re-filters the page by the search term — `q` matched deeds server-side", () => {
    // Before pagination-contract §3 this row was dropped unless the client
    // re-matched `t.deeds.join(" ")`; the endpoint answers the deed term now.
    const rows = [task()];
    expect(
      visibleOperationsTasks(rows, {
        statusFilter: "",
        scopeFilter: "",
        showAll: true,
      }),
    ).toEqual(rows);
  });

  it("still applies status, scope and the active-only toggle to a stale page", () => {
    const rows = [
      task({ id: "1", status: "created" }),
      task({ id: "2", status: "completed" }),
      task({ id: "3", status: "created", scope: "general" }),
    ];
    expect(
      visibleOperationsTasks(rows, {
        statusFilter: "",
        scopeFilter: "transaction",
        showAll: false,
      }).map((t) => t.id),
    ).toEqual(["1"]);
  });

  it("orders by the status band, newest first inside a band", () => {
    const rows = [
      task({ id: "paused", status: "paused" }),
      task({ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }),
      task({ id: "new", createdAt: "2026-02-01T00:00:00.000Z" }),
      task({ id: "done", status: "completed" }),
    ];
    expect(
      visibleOperationsTasks(rows, {
        statusFilter: "",
        scopeFilter: "",
        showAll: true,
      }).map((t) => t.id),
    ).toEqual(["new", "old", "paused", "done"]);
  });
});

const opsTask = (over: Partial<OperationsTask> = {}): OperationsTask =>
  ({
    id: "t1",
    type: "general",
    status: "created",
    scope: "transaction",
    assigneeId: "a1",
    assigneeName: "Amal",
    letterRows: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as OperationsTask;

const closeForm = (over: Partial<CloseTaskForm> = {}): CloseTaskForm => ({
  closeOutcome: "completed",
  cancelReason: "",
  closeText: "",
  closeFiles: [],
  courtKind: "",
  courtOtherText: "",
  courtStatement: "",
  courtPerDeed: {},
  courtContacts: [],
  creditAssigneeId: "",
  creditAssigneeName: "",
  ...over,
});

describe("localDueParts", () => {
  it("splits a valid due into date and time, else blank date and noon", () => {
    const parts = localDueParts("2026-03-04T10:30:00.000Z");
    expect(parts.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parts.time).toMatch(/^\d{2}:\d{2}$/);
    expect(localDueParts(null)).toEqual({ date: "", time: "12:00" });
    expect(localDueParts("not a date")).toEqual({ date: "", time: "12:00" });
  });
});

describe("keysRegisterPathForTask", () => {
  it("links to the keys register with the first letter request and the task", () => {
    expect(
      keysRegisterPathForTask({
        id: "t9",
        letterRows: [{ request: " REQ-1 " }] as OperationsTask["letterRows"],
      }),
    ).toBe("/keys?register=1&request=REQ-1&task=t9");
    expect(keysRegisterPathForTask({ id: "t9", letterRows: [] })).toBe(
      "/keys?register=1&task=t9",
    );
  });
});

describe("closeModalDefaults", () => {
  it("cancels for a creator on an unstarted task and credits the original assignee", () => {
    const task = opsTask({
      status: "created",
      originalAssigneeId: " o1 ",
      originalAssigneeName: "Omar",
    });
    expect(closeModalDefaults(task, true)).toEqual({
      closeOutcome: "cancelled",
      creditAssigneeId: "o1",
      creditAssigneeName: "Omar",
    });
    expect(closeModalDefaults(task, false).closeOutcome).toBe("completed");
    expect(
      closeModalDefaults(opsTask({ status: "in_progress" }), true),
    ).toEqual({
      closeOutcome: "completed",
      creditAssigneeId: "a1",
      creditAssigneeName: "Amal",
    });
  });
});

describe("buildStatusPatchBody", () => {
  it("only carries the completion and cancellation extras for their status", () => {
    expect(buildStatusPatchBody({ status: "in_progress" })).toEqual({
      status: "in_progress",
    });
    expect(
      buildStatusPatchBody({
        status: "completed",
        courtVisitResult: { kind: "none" },
        credit: { assigneeId: " c1 ", assigneeName: " " },
      }),
    ).toEqual({
      status: "completed",
      courtVisitResult: { kind: "none" },
      creditAssigneeId: "c1",
      creditAssigneeName: undefined,
    });
    expect(
      buildStatusPatchBody({ status: "cancelled", cancelReason: " why " }),
    ).toEqual({ status: "cancelled", cancelReason: "why" });
    expect(
      buildStatusPatchBody({
        status: "cancelled",
        courtVisitResult: { kind: "none" },
      }),
    ).toEqual({ status: "cancelled", cancelReason: undefined });
  });
});

describe("normalizeCourtVisitContacts", () => {
  it("trims, defaults the scope and drops rows without a name or phone", () => {
    expect(
      normalizeCourtVisitContacts([
        { scope: "", name: " Sara ", role: "", phone: "", note: " n " },
        { scope: "po", name: "", phone: " 05 ", role: " r ", note: "" },
        { scope: "", name: " ", phone: " ", role: "", note: "" },
      ]),
    ).toEqual([
      { scope: "property", name: "Sara", role: null, phone: null, note: "n" },
      { scope: "po", name: "", role: "r", phone: "05", note: null },
    ]);
  });
});

describe("buildCloseTaskSubmission", () => {
  it("cancelling needs a creator and a reason", () => {
    expect(
      buildCloseTaskSubmission(
        opsTask(),
        closeForm({ closeOutcome: "cancelled", cancelReason: "x" }),
        false,
      ),
    ).toEqual({ ok: false, error: "الإلغاء متاح للمنشئ أو المشرف فقط" });
    expect(
      buildCloseTaskSubmission(
        opsTask(),
        closeForm({ closeOutcome: "cancelled", cancelReason: "  " }),
        true,
      ),
    ).toEqual({ ok: false, error: "سبب الإلغاء مطلوب" });
    expect(
      buildCloseTaskSubmission(
        opsTask(),
        closeForm({ closeOutcome: "cancelled", cancelReason: "late" }),
        true,
      ),
    ).toEqual({
      ok: true,
      submission: { status: "cancelled", cancelReason: "late" },
    });
  });

  it("a plain close carries the comment and files, and credit only for a reassigned task", () => {
    const form = closeForm({ closeText: "done", creditAssigneeId: "c1" });
    expect(buildCloseTaskSubmission(opsTask(), form, true)).toEqual({
      ok: true,
      submission: {
        status: "completed",
        closeComment: "done",
        files: [],
        credit: undefined,
      },
    });
    const reassigned = opsTask({ originalAssigneeId: "o1" });
    expect(
      buildCloseTaskSubmission(reassigned, closeForm(), true),
    ).toEqual({ ok: false, error: "اختر من يحصل على مسؤولية التنفيذ" });
    expect(
      buildCloseTaskSubmission(
        reassigned,
        closeForm({ creditAssigneeId: "c1", creditAssigneeName: "C" }),
        true,
      ),
    ).toMatchObject({
      ok: true,
      submission: { credit: { assigneeId: "c1", assigneeName: "C" } },
    });
  });

  it("a court visit needs the keys outcome, its detail and contacts", () => {
    const court = opsTask({ type: "court_visit" });
    expect(buildCloseTaskSubmission(court, closeForm(), false)).toEqual({
      ok: false,
      error: "اختر موقف المفاتيح لدى المحكمة",
    });
    expect(
      buildCloseTaskSubmission(court, closeForm({ courtKind: "other" }), false),
    ).toEqual({ ok: false, error: "يلزم توضيح النتيجة عند اختيار «أخرى»" });
    expect(
      buildCloseTaskSubmission(
        court,
        closeForm({ courtKind: "other_party" }),
        false,
      ),
    ).toEqual({
      ok: false,
      error:
        "يلزم إدخال جهة اتصال واحدة على الأقل عندما يكون الظرف عند طرف آخر",
    });
    expect(
      buildCloseTaskSubmission(
        court,
        closeForm({
          courtKind: "received",
          courtStatement: " ok ",
          courtPerDeed: { "D-1": " text ", "D-2": " " },
        }),
        false,
      ),
    ).toEqual({
      ok: true,
      submission: {
        status: "completed",
        closeComment: "",
        files: [],
        courtVisitResult: {
          kind: "received",
          other: null,
          statement: "ok",
          perDeed: [{ deed: "D-1", text: "text" }],
          contacts: [],
        },
        credit: undefined,
      },
    });
  });
});

describe("buildOperationsTaskRowMenu", () => {
  const handlers = {
    showDetail: () => {},
    markInProgress: () => {},
    closeTask: () => {},
    registerEnvelope: () => {},
    pauseTask: () => {},
    remindTask: () => {},
    changePriority: () => {},
    reassignTask: () => {},
  };
  const ids = (items: { id: string }[]) => items.map((i) => i.id);

  it("gives the assignee receipt and close, and a creator the management items", () => {
    const task = opsTask({ status: "created" });
    expect(
      ids(
        buildOperationsTaskRowMenu(
          task,
          { canCreate: false, canRemind: false, reviewerAccount: { assigneeId: "a1" } },
          handlers,
        ),
      ),
    ).toEqual(["detail", "start"]);
    expect(
      ids(
        buildOperationsTaskRowMenu(
          task,
          { canCreate: true, canRemind: true, reviewerAccount: null },
          handlers,
        ),
      ),
    ).toEqual(["detail", "complete", "pause", "remind", "prio", "reassign"]);
    expect(
      ids(
        buildOperationsTaskRowMenu(
          opsTask({ status: "paused" }),
          { canCreate: true, canRemind: true, reviewerAccount: null },
          handlers,
        ),
      ),
    // A paused task is not "active" — no reminder / priority / reassign.
    ).toEqual(["detail", "complete", "resume"]);
  });

  it("offers envelope registration and the letter for a received court visit", () => {
    const task = opsTask({
      type: "court_visit",
      status: "completed",
      courtVisitResult: { kind: "received" },
      letterRows: [{ request: "R" }] as OperationsTask["letterRows"],
    });
    expect(
      ids(
        buildOperationsTaskRowMenu(
          task,
          { canCreate: false, canRemind: false, reviewerAccount: null },
          handlers,
        ),
      ),
    ).toEqual(["detail", "register-envelope", "letter"]);
  });
});

describe("mobile card rules", () => {
  it("picks the card tone from status, priority and lateness", () => {
    expect(operationsTaskCardTone(opsTask({ status: "completed" }), false)).toBe("done");
    expect(operationsTaskCardTone(opsTask({ status: "cancelled" }), true)).toBe("done");
    expect(
      operationsTaskCardTone(opsTask({ status: "created", priority: "high" }), false),
    ).toBe("returned");
    expect(
      operationsTaskCardTone(opsTask({ status: "created", priority: "low" }), true),
    ).toBe("returned");
    expect(
      operationsTaskCardTone(opsTask({ status: "in_progress", priority: "low" }), false),
    ).toBe("pending");
    expect(
      operationsTaskCardTone(opsTask({ status: "paused", priority: "medium" }), false),
    ).toBe("pending");
    expect(
      operationsTaskCardTone(opsTask({ status: "created", priority: "low" }), false),
    ).toBe("new");
  });

  it("labels the countdown only while it is ticking", () => {
    expect(operationsTaskCountdownLabel({ txt: "2 س", over: false })).toBe("2 س");
    expect(operationsTaskCountdownLabel({ txt: "1 س", over: true })).toBe("متأخرة");
    expect(operationsTaskCountdownLabel({ txt: "—", over: false })).toBeUndefined();
    expect(operationsTaskCountdownLabel({ txt: "متوقفة", over: false })).toBeUndefined();

    expect(operationsTaskTimerTick({ txt: "—", over: false })).toBeNull();
    expect(operationsTaskTimerTick({ txt: "متوقفة", over: false })).toBeNull();
    expect(operationsTaskTimerTick({ txt: "3 د", over: false })).toEqual({
      label: "3 د",
      overdue: false,
    });
    expect(operationsTaskTimerTick({ txt: "3 د", over: true })).toEqual({
      label: "متأخرة",
      overdue: true,
    });
  });

  it("shows the assignee, else the link, else the scope as the third chip", () => {
    expect(operationsTaskCardLinkMeta(opsTask({ assigneeName: " Amal " }))).toEqual({
      text: "Amal",
      kind: "place",
    });
    expect(
      operationsTaskCardLinkMeta(
        opsTask({ assigneeName: "", assigneeId: "", scope: "transaction", deeds: ["D-9"] }),
      ),
    ).toEqual({ text: "صك D-9", kind: "plain" });
    expect(
      operationsTaskCardLinkMeta(
        opsTask({ assigneeName: "", assigneeId: "", scope: "work_order", poNumber: "" }),
      ),
    ).toEqual({ text: "أمر عمل", kind: "plain" });
  });

  it("toggles one id and the visible active band without touching other ids", () => {
    expect(toggleSelectedId({ a: true }, "b", true)).toEqual({ a: true, b: true });
    expect(toggleSelectedId({ a: true, b: true }, "a", false)).toEqual({ b: true });

    const visible = [
      opsTask({ id: "v1", status: "created" }),
      opsTask({ id: "v2", status: "in_progress" }),
      opsTask({ id: "v3", status: "completed" }),
    ];
    expect(toggleVisibleActiveSelection({ other: true }, visible, true)).toEqual({
      other: true,
      v1: true,
      v2: true,
    });
    expect(
      toggleVisibleActiveSelection({ other: true, v1: true, v3: true }, visible, false),
    ).toEqual({ other: true, v3: true });
  });

  it("names the empty queue per viewer", () => {
    expect(emptyQueueMessage(true)).toBe("لا توجد مهام مسندة إليك.");
    expect(emptyQueueMessage(false)).toBe("لا توجد مهام مطابقة.");
  });
});

describe("detail panel rules", () => {
  it("builds the scope / link chip", () => {
    expect(operationsTaskLinkChip(opsTask({ scope: "general" }))).toBe(
      "غير مرتبطة — مهمة مستقلة",
    );
    expect(
      operationsTaskLinkChip(opsTask({ scope: "transaction", deeds: ["D-1"] })),
    ).toBe("معاملة · صك D-1");
  });

  it("flags overdue only for open, unpaused tasks", () => {
    const past = "2026-01-01T00:00:00.000Z";
    const now = new Date("2026-01-02T00:00:00.000Z").getTime();
    expect(isOperationsTaskOverdue(opsTask({ status: "in_progress", dueAt: past }), now)).toBe(true);
    expect(isOperationsTaskOverdue(opsTask({ status: "paused", dueAt: past }), now)).toBe(false);
    expect(isOperationsTaskOverdue(opsTask({ status: "completed", dueAt: past }), now)).toBe(false);
    expect(
      isOperationsTaskOverdue(
        opsTask({ status: "created", dueAt: "2026-01-03T00:00:00.000Z" }),
        now,
      ),
    ).toBe(false);
  });

  it("resolves the receipt slot", () => {
    expect(operationsTaskReceiptCell(opsTask({ status: "completed" }), true)).toEqual({
      kind: "hidden",
    });
    expect(operationsTaskReceiptCell(opsTask({ status: "created" }), true)).toEqual({
      kind: "confirm",
    });
    expect(operationsTaskReceiptCell(opsTask({ status: "created" }), false)).toEqual({
      kind: "label",
      text: "بانتظار المنفّذ",
      confirmed: false,
    });
    expect(
      operationsTaskReceiptCell(
        opsTask({ status: "in_progress", receiptConfirmedAt: "2026-01-01T00:00:00.000Z" }),
        false,
      ),
    ).toEqual({ kind: "label", text: "✓ مؤكَّد", confirmed: true });
  });

  it("offers the footer actions the row menu would", () => {
    expect(
      operationsTaskDetailActions(opsTask({ status: "in_progress" }), {
        isAssignee: true,
        canCreate: false,
      }),
    ).toEqual({
      close: true,
      pause: false,
      resume: false,
      reassign: false,
      changePriority: false,
    });
    expect(
      operationsTaskDetailActions(opsTask({ status: "created" }), {
        isAssignee: false,
        canCreate: true,
      }),
    ).toEqual({
      close: true,
      pause: true,
      resume: false,
      reassign: true,
      changePriority: true,
    });
    expect(
      operationsTaskDetailActions(opsTask({ status: "paused" }), {
        isAssignee: false,
        canCreate: true,
      }),
    ).toEqual({
      close: true,
      pause: false,
      resume: true,
      reassign: false,
      changePriority: false,
    });
    expect(
      operationsTaskDetailActions(opsTask({ status: "completed" }), {
        isAssignee: true,
        canCreate: true,
      }),
    ).toEqual({
      close: false,
      pause: false,
      resume: false,
      reassign: false,
      changePriority: false,
    });
  });

  it("asks for envelope registration only for a received, completed, unlinked court visit", () => {
    const received = opsTask({
      type: "court_visit",
      status: "completed",
      courtVisitResult: { kind: "received" },
    });
    expect(needsEnvelopeRegistration(received)).toBe(true);
    expect(needsEnvelopeRegistration({ ...received, linkedEnvelopeId: "env-1" })).toBe(false);
    expect(needsEnvelopeRegistration({ ...received, status: "in_progress" })).toBe(false);
    expect(needsEnvelopeRegistration({ ...received, type: "general" })).toBe(false);
  });
});

describe("close modal chrome", () => {
  it("allows the completed outcome only once the task was started", () => {
    expect(allowsCompleteOutcome("in_progress")).toBe(true);
    expect(allowsCompleteOutcome("paused")).toBe(true);
    expect(allowsCompleteOutcome("created")).toBe(false);
    expect(allowsCompleteOutcome(undefined)).toBe(false);
  });

  it("titles the modal per outcome", () => {
    expect(closeModalTitles("cancelled")).toEqual({
      title: "إلغاء المهمة",
      subtitle: "صلاحية منشئ المهمة — يتطلب سبباً إلزامياً",
    });
    expect(closeModalTitles("completed").title).toBe("إغلاق المهمة — منجزة");
  });
});
