import { describe, expect, it } from "vitest";
import {
  emptyProperty,
  type AssignmentType,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import {
  allDeedOptions,
  buildCreateOperationsTaskSubmission,
  buildLetterRowsForDeed,
  buildLetterRowsForPo,
  createOperationsTaskReducer,
  createTaskPrefillKey,
  deedOptions,
  defaultDueFields,
  initialCreateOperationsTaskForm,
  letterPreviewRows,
  needsVisitFeeFor,
  parseDueAt,
  poOptionsForType,
  prefillType,
  resolveAssigneeSelection,
  type CreateOperationsTaskForm,
} from "../create-operations-task-state";

const NOW = new Date(2026, 8, 5, 9, 30).getTime();

function property(over: Partial<PoPropertyIntake>): PoPropertyIntake {
  return { ...emptyProperty(), ...over };
}

function record(
  poNumber: string,
  assignmentType: AssignmentType,
  properties: PoPropertyIntake[],
): PoIntakeRecord {
  return { id: poNumber, poNumber, assignmentType, properties } as unknown as PoIntakeRecord;
}

const courtPo = record("PO-1", "تنفيذ", [
  property({ id: "a", deedNumber: "111", court: "محكمة جدة", circuit: "3", ownerName: "سالم", requestNumber: "R-1" }),
  property({ id: "b", deedNumber: "222", court: "" }),
  property({ id: "c", deedNumber: "333", court: "محكمة مكة", isRemoved: true }),
]);
const privatePo = record("PO-2", "خاص" as AssignmentType, [
  property({ id: "d", deedNumber: "444", court: "محكمة الرياض" }),
]);
const records = [courtPo, privatePo];

function form(over: Partial<CreateOperationsTaskForm> = {}): CreateOperationsTaskForm {
  return {
    ...initialCreateOperationsTaskForm(null, NOW),
    assigneeId: "rev-1",
    assigneeName: "فراس",
    poNumber: "PO-1",
    ...over,
  };
}

describe("options and letter rows", () => {
  it("snapshots one letter row per property that still has a court", () => {
    expect(buildLetterRowsForPo(courtPo)).toEqual([
      { po: "PO-1", deed: "111", owner: "سالم", request: "R-1", court: "محكمة جدة", circuit: "3" },
    ]);
    expect(buildLetterRowsForDeed(records, "PO-1", "111")).toHaveLength(1);
    expect(buildLetterRowsForDeed(records, "PO-1", "222")).toEqual([]);
  });

  it("lists deeds without removed ones and de-duplicates across work orders", () => {
    expect(deedOptions(courtPo)).toEqual(["111", "222"]);
    expect(deedOptions(undefined)).toEqual([]);
    expect(allDeedOptions(records)).toEqual([
      { deed: "111", po: "PO-1" },
      { deed: "222", po: "PO-1" },
      { deed: "444", po: "PO-2" },
    ]);
  });

  it("court visits only offer work orders on the court path", () => {
    expect(poOptionsForType(records, "court_visit")).toEqual([courtPo]);
    expect(poOptionsForType(records, "general")).toBe(records);
  });

  it("previews rows per scope, and nothing for a general task", () => {
    expect(letterPreviewRows(form({ type: "general" }), records)).toEqual([]);
    expect(letterPreviewRows(form({ type: "court_visit", scope: "work_order" }), records)).toHaveLength(1);
    expect(
      letterPreviewRows(form({ type: "court_visit", scope: "multi", selectedDeeds: ["111", "444"] }), records),
    ).toHaveLength(2);
    expect(
      letterPreviewRows(form({ type: "court_visit", scope: "transaction", deed: "222" }), records),
    ).toEqual([]);
  });
});

describe("prefill, due fields and assignee selection", () => {
  it("normalises the prefill type and keys the form on the whole prefill", () => {
    expect(prefillType(undefined)).toBe("general");
    expect(prefillType({ type: "bogus" })).toBe("general");
    expect(prefillType({ type: " court_visit " })).toBe("court_visit");
    expect(createTaskPrefillKey({ type: "court_visit" })).not.toBe(createTaskPrefillKey(null));
    expect(createTaskPrefillKey({ deed: "1" })).toBe(createTaskPrefillKey({ deed: "1" }));
  });

  it("proposes now + 12h for the default medium priority", () => {
    expect(defaultDueFields(NOW)).toEqual({ date: "2026-09-05", time: "21:30" });
  });

  it("seeds the form from the prefill", () => {
    const seeded = initialCreateOperationsTaskForm(
      { type: "court_visit", scope: "transaction", poNumber: " PO-1 ", deed: " 111 " },
      NOW,
    );
    expect(seeded).toMatchObject({
      type: "court_visit",
      title: "زيارة محكمة",
      scope: "transaction",
      poNumber: "PO-1",
      deed: "111",
      selectedDeeds: ["111"],
      priority: "medium",
      dueChip: null,
    });
  });

  it("cooperator reviewers on a court visit need a fee; employees and general tasks do not", () => {
    expect(needsVisitFeeFor("court_visit", "rev-1", { type: "freelance" })).toBe(true);
    expect(needsVisitFeeFor("court_visit", "rev-1", undefined)).toBe(true);
    expect(needsVisitFeeFor("court_visit", "rev-1", { type: "internal" })).toBe(false);
    expect(needsVisitFeeFor("court_visit", "", { type: "freelance" })).toBe(false);
    expect(needsVisitFeeFor("general", "rev-1", { type: "freelance" })).toBe(false);
  });

  it("keeps a valid assignee, falls back to the first, clears when none, waits while loading", () => {
    const assignees = [{ id: "a", name: "أ" }, { id: "b", name: "ب" }];
    expect(resolveAssigneeSelection(assignees, "b", false)).toBeNull();
    expect(resolveAssigneeSelection(assignees, "zz", false)).toEqual({ id: "a", name: "أ" });
    expect(resolveAssigneeSelection([], "zz", false)).toEqual({ id: "", name: "" });
    expect(resolveAssigneeSelection([], "zz", true)).toBeNull();
  });
});

describe("createOperationsTaskReducer", () => {
  const initial = initialCreateOperationsTaskForm(null, NOW);

  it("re-titles on type change and resets the deed pickers on work-order change", () => {
    expect(createOperationsTaskReducer(initial, { type: "set-type", value: "court_visit" })).toMatchObject({
      type: "court_visit",
      title: "زيارة محكمة",
    });
    const withDeeds = { ...initial, deed: "111", selectedDeeds: ["111"] };
    expect(createOperationsTaskReducer(withDeeds, { type: "set-po", value: "PO-2" })).toMatchObject({
      poNumber: "PO-2",
      deed: "",
      selectedDeeds: [],
    });
    const toggled = createOperationsTaskReducer(withDeeds, { type: "toggle-deed", value: "222" });
    expect(toggled.selectedDeeds).toEqual(["111", "222"]);
    expect(createOperationsTaskReducer(toggled, { type: "toggle-deed", value: "111" }).selectedDeeds).toEqual(["222"]);
  });

  it("priority proposes date and time; day chips move the date only; a manual date clears the chip", () => {
    const high = createOperationsTaskReducer(initial, { type: "set-priority", value: "high", now: NOW });
    expect(high).toMatchObject({ priority: "high", dueDate: "2026-09-05", dueTime: "13:30", dueChip: null });
    const tomorrow = createOperationsTaskReducer(high, { type: "apply-due-chip", chip: "tomorrow", now: NOW });
    expect(tomorrow).toMatchObject({ dueDate: "2026-09-06", dueTime: "13:30", dueChip: "tomorrow" });
    expect(createOperationsTaskReducer(tomorrow, { type: "set-due-date", value: "2026-09-09" })).toMatchObject({
      dueDate: "2026-09-09",
      dueChip: null,
    });
  });

  it("returns the same state for no-op assignee and fee writes", () => {
    expect(createOperationsTaskReducer(initial, { type: "set-assignee", id: "", name: "" })).toBe(initial);
    expect(createOperationsTaskReducer(initial, { type: "set-visit-fee", value: "" })).toBe(initial);
    expect(createOperationsTaskReducer(initial, { type: "set-visit-fee", value: "350" }).visitFeeAmountSar).toBe("350");
  });
});

describe("buildCreateOperationsTaskSubmission", () => {
  const opts = { poOptions: records, needsVisitFee: false };

  it("reports the first missing field top to bottom", () => {
    expect(buildCreateOperationsTaskSubmission(form({ assigneeId: "" }), opts)).toEqual({ ok: false, error: "المنفّذ مطلوب" });
    expect(buildCreateOperationsTaskSubmission(form({ visitFeeAmountSar: "0" }), { ...opts, needsVisitFee: true })).toEqual({
      ok: false,
      error: "مبلغ أتعاب الزيارة مطلوب للمتعاون",
    });
    expect(buildCreateOperationsTaskSubmission(form({ poNumber: "" }), opts)).toEqual({ ok: false, error: "اختر أمر عمل" });
    expect(buildCreateOperationsTaskSubmission(form({ type: "court_visit", poNumber: "PO-2" }), opts)).toEqual({
      ok: false,
      error: "نوع الإسناد لا يتطلب محاكم",
    });
    expect(buildCreateOperationsTaskSubmission(form({ scope: "multi", selectedDeeds: ["111"] }), opts)).toEqual({
      ok: false,
      error: "اختر صكّين فأكثر",
    });
    expect(
      buildCreateOperationsTaskSubmission(form({ type: "court_visit", scope: "transaction", deed: "222" }), opts).ok,
    ).toBe(false);
    expect(buildCreateOperationsTaskSubmission(form({ dueDate: " " }), opts)).toEqual({ ok: false, error: "موعد الاستحقاق مطلوب" });
  });

  it("builds a court-visit work-order request with the letter snapshot and the stamped fee", () => {
    const result = buildCreateOperationsTaskSubmission(
      form({ type: "court_visit", title: "زيارة محكمة", visitFeeAmountSar: "1,350", description: " متابعة " }),
      { ...opts, needsVisitFee: true },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toMatchObject({
      type: "court_visit",
      title: "زيارة محكمة",
      description: "متابعة",
      scope: "work_order",
      poNumber: "PO-1",
      deeds: ["111"],
      assigneeId: "rev-1",
      assigneeName: "فراس",
      priority: "medium",
      visitFeeAmountSar: 1350,
      dueAtUtc: parseDueAt("2026-09-05", "21:30").toISOString(),
    });
    expect(result.body.letterRows).toHaveLength(1);
  });

  it("a general work order links every live deed; multi picks the first matching work order", () => {
    const general = buildCreateOperationsTaskSubmission(form({ description: "" }), opts);
    expect(general.ok && general.body).toMatchObject({ deeds: ["111", "222"], letterRows: undefined, description: undefined });
    const multi = buildCreateOperationsTaskSubmission(
      form({ scope: "multi", poNumber: "", selectedDeeds: ["444", "111"] }),
      opts,
    );
    expect(multi.ok && multi.body).toMatchObject({ poNumber: "PO-1", deeds: ["444", "111"] });
  });

  it("parses the local due inputs, defaulting the time to noon", () => {
    expect(parseDueAt("2026-09-05", "08:15")).toEqual(new Date(2026, 8, 5, 8, 15));
    expect(parseDueAt("2026-09-05", "")).toEqual(new Date(2026, 8, 5, 12, 0));
  });
});
