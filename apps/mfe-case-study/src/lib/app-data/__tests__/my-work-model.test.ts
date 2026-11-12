import { describe, expect, it } from "vitest";
import type { ReportDraftState } from "@platform/app-shared/workflow/report-draft-state";
import type { WorkflowTask } from "../tasks";
import type { PoIntakeRecord } from "../po-intake-data";
import {
  appraiserStep,
  buildMyWork,
  defaultMyWorkStage,
  formatActionClock,
  inspectorStep,
  isCaseSpecialistGroup,
  isMyWorkLookupStage,
  myWorkDue,
  returnedLine,
  myWorkGroupsForPages,
  transactionProgress,
  type BuildMyWorkInput,
  type MyWorkStage,
} from "../my-work-model";

const NOW = new Date("2026-11-05T09:00:00+03:00");

function task(over: Partial<WorkflowTask>): WorkflowTask {
  return {
    id: "t",
    kind: "case-study-property",
    poNumber: "PO-1",
    propertyId: "p1",
    propertyOrdinal: 1,
    title: "",
    phase: "case-study",
    assigneeRole: "case-specialist",
    assigneeName: "",
    status: "open",
    deedNumber: "D-1",
    city: "الرياض",
    district: "النرجس",
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-02T00:00:00Z",
    ...over,
  } as WorkflowTask;
}

function input(over: Partial<BuildMyWorkInput>): BuildMyWorkInput {
  return {
    groups: ["co", "st", "rv"],
    mine: [],
    allTasks: [],
    poByNumber: new Map(),
    pendingBourse: [],
    draftState: () => undefined,
    now: NOW,
    ...over,
  };
}

describe("myWorkGroupsForPages", () => {
  it("shows each sub-role group only when one of its queue pages is held", () => {
    expect(myWorkGroupsForPages(["po", "active-receipt"])).toEqual(["co"]);
    expect(myWorkGroupsForPages(["active-case-study"])).toEqual(["st"]);
    expect(myWorkGroupsForPages(["system-upload"])).toEqual(["rv"]);
    expect(myWorkGroupsForPages(["po", "favorites"])).toEqual([]);
  });

  it("gives the appraiser his own group, from his queue page (Omar 2026-11-10)", () => {
    expect(myWorkGroupsForPages(["my-work", "po", "property-appraisal"])).toEqual(["ap"]);
  });

  it("gives the field inspector his own group, from his queue page (Omar 2026-11-12)", () => {
    expect(myWorkGroupsForPages(["my-work", "po", "active-inspection", "party-fees"])).toEqual(["fi"]);
  });

  it("tells a case specialist's sub-roles from the parties' own groups", () => {
    expect((["co", "st", "rv", "ap", "fi"] as const).filter(isCaseSpecialistGroup)).toEqual(["co", "st", "rv"]);
  });
});

describe("defaultMyWorkStage — the chip «أعمالي» opens on (Omar 2026-11-11)", () => {
  const rows = (...stages: MyWorkStage[]) => stages.map((stage) => ({ stage }));

  it("the appraiser opens on «التقييم» while a valuation is due", () => {
    expect(defaultMyWorkStage(["ap"], rows("approval", "valuation", "prework"))).toBe("valuation");
  });

  it("moves to the next stage with an action once the valuations are done", () => {
    expect(defaultMyWorkStage(["ap"], rows("approval", "prework", "handed"))).toBe("approval");
    expect(defaultMyWorkStage(["ap"], rows("correction", "approval"))).toBe("correction");
  });

  it("falls back to the role's first chip when nothing is due — even with no rows", () => {
    expect(defaultMyWorkStage(["ap"], [])).toBe("valuation");
    // Advance work and handed-over lookups ask nothing of him: they do not draw the selection.
    expect(defaultMyWorkStage(["ap"], rows("prework", "handed"))).toBe("valuation");
    expect(defaultMyWorkStage(["co"], [])).toBe("intake");
    expect(defaultMyWorkStage(["rv"], [])).toBe("review");
  });

  it("follows the chips' order for the specialists, across the groups a viewer holds", () => {
    expect(defaultMyWorkStage(["co"], rows("follow"))).toBe("follow");
    expect(defaultMyWorkStage(["rv"], rows("upload", "deposit"))).toBe("deposit");
    expect(defaultMyWorkStage(["co", "st", "rv"], rows("upload", "study"))).toBe("study");
    // Rows of a group the viewer does not hold are not his chips.
    expect(defaultMyWorkStage(["rv"], rows("study"))).toBe("review");
  });

  it("no group → no chip", () => {
    expect(defaultMyWorkStage([], rows("study"))).toBeNull();
  });
});

describe("myWorkDue", () => {
  it("reads the PO deadline as late / soon / ok", () => {
    expect(myWorkDue("2026-11-01", NOW).due).toBe("late");
    expect(myWorkDue("2026-11-05", NOW)).toEqual({
      due: "soon",
      dueText: "تنتهي اليوم",
    });
    expect(myWorkDue("2026-11-06", NOW)).toEqual({
      due: "soon",
      dueText: "تنتهي غدًا",
    });
    expect(myWorkDue("2026-11-10", NOW).due).toBe("ok");
    expect(myWorkDue(undefined, NOW)).toEqual({ due: "none", dueText: "—" });
  });
});

// Omar 2026-11-08: coordination's two rows — «إدخال المعاملة» (one per deed) and «متابعة الأطراف».
describe("buildMyWork — coordination", () => {
  const parent = task({ id: "cs", transactionReceived: false });
  const child = (
    kind: WorkflowTask["kind"],
    status: WorkflowTask["status"],
    packageAccepted?: boolean,
  ) =>
    task({
      id: `${kind}-${status}`,
      kind,
      parentTaskId: "cs",
      status,
      assigneeRole: "field-inspector",
      packageAccepted,
    });

  it("lists one «إدخال المعاملة» row per deed, wherever its intake stands, opening its section", () => {
    const primary = task({ id: "a", phase: "enfath", propertyId: undefined });
    const distribution = task({ id: "b", phase: "distribution", propertyId: "p2" });
    const { items } = buildMyWork(
      input({
        groups: ["co"],
        mine: [primary, distribution],
        allTasks: [primary, distribution],
        poByNumber: new Map([["PO-1", { poNumber: "PO-1", properties: [] } as unknown as PoIntakeRecord]]),
      }),
    );
    expect(items.map((i) => [i.stage, i.action, i.reason, i.href])).toEqual([
      ["intake", "إدخال المعاملة", "البيانات الأولية ← · البورصة · التوزيع", "/po/PO-1/task/a/coordination"],
      [
        "intake",
        "إدخال المعاملة",
        "البيانات الأولية ✓ · البورصة ✓ · التوزيع ←",
        "/po/PO-1/property/p2/coordination#work-distribution",
      ],
    ]);
  });

  it("follows a distributed transaction until it is sent, naming the party it waits for", () => {
    const all = [
      parent,
      child("field-inspection", "completed"),
      child("engineering-survey", "open"),
    ];
    const { items } = buildMyWork(
      input({ groups: ["co"], mine: [parent], allTasks: all }),
    );
    expect(items.map((i) => [i.stage, i.action, i.reason])).toEqual([
      ["follow", "متابعة الأطراف", "بانتظار: المكتب الهندسي"],
    ]);
    expect(transactionProgress(parent, all, () => undefined)).toEqual({
      stage: "متابعة الأطراف",
      waitingOn: "المكتب الهندسي",
    });
  });

  it("asks coordination to accept and send once every party delivered", () => {
    const all = [
      parent,
      child("field-inspection", "completed"),
      child("engineering-survey", "completed"),
    ];
    const { items } = buildMyWork(
      input({ groups: ["co"], mine: [parent], allTasks: all }),
    );
    expect(items.map((i) => [i.stage, i.href])).toEqual([
      ["follow", "/po/PO-1/property/p1/coordination#work-inspector"],
    ]);
    expect(transactionProgress(parent, all, () => undefined)).toEqual({
      stage: "متابعة الأطراف",
      waitingOn: "التنسيق",
    });
  });

  // A→Z 2026-11-09: the cancelled transaction's row stayed, reading «لم تُوزَّع على الأطراف بعد».
  it("drops a cancelled transaction from the follow-up", () => {
    const cancelled = task({ ...parent, status: "cancelled" });
    const all = [cancelled, child("field-inspection", "cancelled"), child("engineering-survey", "cancelled")];
    expect(buildMyWork(input({ groups: ["co"], mine: [cancelled], allTasks: all })).items).toEqual([]);
  });

  it("ignores a cancelled party", () => {
    const all = [
      parent,
      child("field-inspection", "completed"),
      child("engineering-survey", "cancelled"),
    ];
    expect(
      buildMyWork(input({ groups: ["co"], mine: [parent], allTasks: all }))
        .items.map((i) => i.reason),
    ).toEqual(["سلّم الأطراف وقُبلت مخرجاتهم — أرسل المعاملة للدراسة"]);
  });

  // A→Z 2026-11-09: a delivered package waiting for the coordinator's acceptance is named — it used
  // to read «بانتظار: المكتب الهندسي» only, hiding the inspection the coordinator had to accept.
  it("names a delivered package awaiting acceptance and opens its section", () => {
    const all = [
      parent,
      child("field-inspection", "completed", false),
      child("engineering-survey", "open"),
    ];
    const { items } = buildMyWork(input({ groups: ["co"], mine: [parent], allTasks: all }));
    expect(items.map((i) => [i.reason, i.href])).toEqual([
      [
        "بانتظار: المكتب الهندسي · بانتظار قبولك: مخرجات المعاين",
        "/po/PO-1/property/p1/coordination#work-inspector",
      ],
    ]);
  });

  it("opens the office's section when only the survey waits for acceptance", () => {
    const all = [
      parent,
      child("field-inspection", "completed", true),
      child("engineering-survey", "completed", false),
    ];
    const { items } = buildMyWork(input({ groups: ["co"], mine: [parent], allTasks: all }));
    expect(items.map((i) => [i.reason, i.href])).toEqual([
      ["بانتظار قبولك: مخرجات المكتب الهندسي", "/po/PO-1/property/p1/coordination#work-survey"],
    ]);
  });
});

// Omar 2026-11-08: review has ONE row per sent transaction, its verbs and its line.
describe("buildMyWork — review's single row", () => {
  const issued = task({
    id: "cs",
    phase: "done",
    status: "completed",
    studyReportIssued: true,
    reviewState: "handed",
  });
  const appraisal = (over: Partial<WorkflowTask> = {}) =>
    task({
      id: "apr",
      kind: "property-appraisal",
      assigneeRole: "real-estate-appraiser",
      ...over,
    });
  const draft = (state: ReportDraftState | undefined) => () => state;
  const rows = (over: Partial<BuildMyWorkInput>) =>
    buildMyWork(input({ groups: ["rv"], ...over })).items.map((i) => [i.stage, i.action, i.reason]);

  it("asks review to approve a sent study while the appraiser still works", () => {
    const all = [issued, appraisal()];
    expect(rows({ mine: [issued], allTasks: all })).toEqual([
      ["review", "اعتماد الدراسة", "الدراسة ← · القيمة … · المسودة · الإيداع · التجهيز · الرفع"],
    ]);
    expect(buildMyWork(input({ mine: [issued], allTasks: all })).items[0]?.href).toBe(
      "/po/PO-1/property/p1/work#work-study",
    );
    expect(transactionProgress(issued, all, () => undefined)).toEqual({
      stage: "مراجعة الدراسة",
      waitingOn: "المراجع والمقيّم",
    });
  });

  it("carries both verbs when the study and the value wait for review", () => {
    const all = [issued, appraisal({ appraisalPackageStatus: "submitted" })];
    expect(rows({ mine: [issued], allTasks: all }).map((r) => r[1])).toEqual([
      "اعتماد الدراسة · قبول القيمة",
    ]);
  });

  it("asks review to issue the draft once the study is approved and the value accepted", () => {
    const approved = task({ ...issued, reviewState: "approved" });
    const all = [approved, appraisal({ appraisalPackageStatus: "submitted", appraisalValueAccepted: true })];
    expect(rows({ mine: [approved], allTasks: all })).toEqual([
      ["review", "إصدار المسودة للمقيّم", "الدراسة ✓ · القيمة ✓ · المسودة ← · الإيداع · التجهيز · الرفع"],
    ]);
  });

  it("lists nothing while the appraiser approves the sent draft", () => {
    const all = [issued, appraisal({ appraisalPackageStatus: "submitted" })];
    const sent = draft({ status: "sent", reportStage: "draft" });
    expect(rows({ mine: [issued], allTasks: all, draftState: sent })).toEqual([]);
    expect(transactionProgress(issued, all, sent)).toEqual({
      stage: "اعتماد المسودة",
      waitingOn: "المقيّم",
    });
  });

  it("asks for the deposit once the appraiser approved, never the study", () => {
    const all = [issued, appraisal({ appraisalPackageStatus: "submitted" })];
    const approved = draft({ status: "approved", reportStage: "draft" });
    expect(rows({ mine: [issued], allTasks: all, draftState: approved }).map((r) => r[0])).toEqual([
      "deposit",
    ]);
    expect(buildMyWork(input({ groups: ["st"], mine: [issued], allTasks: all, draftState: approved })).items).toEqual(
      [],
    );
  });

  it("asks to prepare a deposited deed, then to upload it once prepared", () => {
    const all = [issued, appraisal({ status: "completed" })];
    expect(rows({ mine: [issued], allTasks: all }).map((r) => [r[0], r[1]])).toEqual([
      ["upload", "تجهيز المعاملة للرفع"],
    ]);
    const ready = task({ ...issued, readyForUpload: true });
    const items = buildMyWork(input({ groups: ["rv"], mine: [ready], allTasks: [ready, appraisal({ status: "completed" })] })).items;
    expect(items.map((i) => [i.stage, i.action, i.href])).toEqual([
      ["upload", "الرفع على إنفاذ", "/po/PO-1/property/p1/work#work-upload"],
    ]);
  });

  it("keeps a folded deed out until the holder's valuation is deposited", () => {
    const folded = task({
      ...issued,
      id: "cs2",
      propertyId: "p2",
      transactionStudyHolderPropertyId: "p1",
    });
    expect(rows({ mine: [folded], allTasks: [folded, appraisal({ appraisalPackageStatus: "submitted" })] })).toEqual([]);
    expect(rows({ mine: [folded], allTasks: [folded, appraisal({ status: "completed" })] }).map((r) => r[1])).toEqual([
      "تجهيز المعاملة للرفع",
    ]);
  });

  it("gives the study only its own study row", () => {
    const received = task({ id: "open-study", transactionReceived: true });
    expect(
      buildMyWork(input({ groups: ["st"], mine: [received, issued], allTasks: [received, issued, appraisal()] })).items.map(
        (i) => [i.stage, i.action],
      ),
    ).toEqual([["study", "دراسة العقار"]]);
  });
});

describe("buildMyWork — order", () => {
  it("lists late rows first, then soon, then the oldest", () => {
    const po = (n: string, due: string) =>
      [n, { poNumber: n, dueDateAt: due } as PoIntakeRecord] as const;
    const a = task({
      id: "a",
      poNumber: "A",
      transactionReceived: true,
      lastStepAtUtc: "2026-11-03T00:00:00Z",
    });
    const b = task({
      id: "b",
      poNumber: "B",
      transactionReceived: true,
      lastStepAtUtc: "2026-11-01T00:00:00Z",
    });
    const c = task({
      id: "c",
      poNumber: "C",
      transactionReceived: true,
      lastStepAtUtc: "2026-11-04T00:00:00Z",
    });
    const { items } = buildMyWork(
      input({
        groups: ["st"],
        mine: [a, b, c],
        allTasks: [a, b, c],
        poByNumber: new Map([
          po("A", "2026-11-20"),
          po("B", "2026-11-20"),
          po("C", "2026-11-01"),
        ]),
      }),
    );
    expect(items.map((i) => i.poNumber)).toEqual(["C", "B", "A"]);
  });
});

describe("buildMyWork — when the action arrived", () => {
  it("is the deed's latest milestone, not the task's last save", () => {
    const t = task({
      transactionReceived: true,
      lastStepAtUtc: "2026-11-03T08:00:00Z",
      updatedAt: "2026-11-04T10:00:00Z",
    });
    const { items } = buildMyWork(input({ groups: ["st"], mine: [t], allTasks: [t] }));
    expect(items[0]!.arrivedIso).toBe("2026-11-03T08:00:00Z");
  });

  it("takes the task's creation when the latest milestone is older (a date-only PO receipt)", () => {
    const t = task({
      transactionReceived: true,
      lastStepAtUtc: "2026-10-31T00:00:00Z",
      createdAt: "2026-11-01T00:00:00Z",
    });
    const { items } = buildMyWork(input({ groups: ["st"], mine: [t], allTasks: [t] }));
    expect(items[0]!.arrivedIso).toBe("2026-11-01T00:00:00Z");
  });

  it("falls back to the task's creation when the deed has no milestone", () => {
    const t = task({ transactionReceived: true, updatedAt: "2026-11-04T10:00:00Z" });
    const { items } = buildMyWork(input({ groups: ["st"], mine: [t], allTasks: [t] }));
    expect(items[0]!.arrivedIso).toBe("2026-11-01T00:00:00Z");
  });

  it("carries the PO's receipt and due dates and its description", () => {
    const t = task({ transactionReceived: true });
    const po = {
      poNumber: "PO-1",
      receivedFromEnfathAt: "2026-10-30",
      dueDateAt: "2026-11-20",
      workOrderDescription: " تقييم عقارات التنفيذ ",
    } as PoIntakeRecord;
    const { items } = buildMyWork(
      input({ groups: ["st"], mine: [t], allTasks: [t], poByNumber: new Map([["PO-1", po]]) }),
    );
    expect(items[0]).toMatchObject({
      receivedIso: "2026-10-30",
      dueIso: "2026-11-20",
      poDescription: "تقييم عقارات التنفيذ",
    });
  });
});

describe("formatActionClock", () => {
  const at = "2026-11-08T10:00:00Z";
  const after = (seconds: number) => Date.parse(at) + seconds * 1000;
  it.each([
    [0, "0ث"],
    [45, "45ث"],
    [12 * 60 + 5, "12د 05ث"],
    [3 * 3600 + 20 * 60 + 9, "3س 20د"],
    [4 * 86_400 + 6 * 3600, "4ي 06س"],
  ])("%i seconds → %s", (seconds, text) => {
    expect(formatActionClock(at, after(seconds))).toBe(text);
  });

  it("reads a time slightly in the future as zero, and an unreadable one as «—»", () => {
    expect(formatActionClock(at, after(-3))).toBe("0ث");
    expect(formatActionClock("", after(5))).toBe("—");
  });
});

describe("transactionProgress", () => {
  it("is null once the transaction is no longer live", () => {
    expect(
      transactionProgress(task({ status: "cancelled" }), [], () => undefined),
    ).toBeNull();
    expect(
      transactionProgress(
        task({ propertyHandedOverToEnfaz: true }),
        [],
        () => undefined,
      ),
    ).toBeNull();
  });

  it("names coordination for the early phases and the study once received", () => {
    expect(
      transactionProgress(task({ phase: "bourse" }), [], () => undefined)
        ?.stage,
    ).toBe("استعلام البورصة");
    expect(
      transactionProgress(
        task({ transactionReceived: true }),
        [],
        () => undefined,
      ),
    ).toEqual({
      stage: "دراسة العقار",
      waitingOn: "دارس العقار",
    });
  });
});

// Omar 2026-11-05: «إعادة فتح المعاملة» — reopened rows are marked (no reply row since 2026-11-08).
describe("buildMyWork — reopenings", () => {
  const deed = task({ id: "cs", phase: "done", status: "completed", studyReportIssued: true, reviewState: "handed" });
  const reopening = (status: "open" | "awaiting_reply") => ({
    propertyId: "p1",
    status,
    source: "enfaz" as const,
    enfazReference: "ENF-9",
    reason: "ملاحظة إنفاذ على القيمة",
    openedAtUtc: "2026-11-04T08:00:00Z",
    uploadedAgainAtUtc: status === "awaiting_reply" ? "2026-11-05T05:00:00Z" : null,
  });

  it("marks the reopened transaction's rows and adds no row of its own", () => {
    const appraisal = task({
      id: "apr",
      kind: "property-appraisal",
      assigneeRole: "real-estate-appraiser",
      appraisalPackageStatus: "submitted",
    });
    const { items } = buildMyWork(
      input({ mine: [deed], allTasks: [deed, appraisal], reopenings: [reopening("open")] }),
    );
    expect(items.map((i) => [i.stage, i.reopened])).toEqual([["review", true]]);
    expect(items[0]!.reason.startsWith("سبب الإعادة: ملاحظة إنفاذ على القيمة — ")).toBe(true);
  });

  // A→Z 2026-11-09: the reopened study row read «معاملة واردة من التنسيق» under «معادة للدراسة».
  it("puts the reopening's reason on the study row instead of the incoming line", () => {
    const study = task({ id: "cs2", transactionReceived: true });
    const { items } = buildMyWork(
      input({ groups: ["st"], mine: [study], allTasks: [study], reopenings: [reopening("open")] }),
    );
    expect(items.map((i) => [i.reopened, i.reason])).toEqual([[true, "سبب الإعادة: ملاحظة إنفاذ على القيمة"]]);
  });
});

/** An appraisal task, as the appraiser's own list holds it. */
function appraisal(over: Partial<WorkflowTask> = {}): WorkflowTask {
  return task({
    id: "a1",
    kind: "property-appraisal",
    assigneeRole: "real-estate-appraiser",
    studyReportIssued: false,
    ...over,
  });
}

const draft = (over: Partial<ReportDraftState>): ReportDraftState => ({
  status: "none",
  reportStage: "draft",
  progressPct: 0,
  ...over,
});

describe("appraiserStep — what the appraiser owes (Omar 2026-11-10)", () => {
  it("owes a valuation once the study is issued: to start it, then to finish and hand it over", () => {
    expect(appraiserStep(appraisal({ studyReportIssued: true }), undefined)).toMatchObject({
      stage: "valuation",
      action: "بدء التقييم",
      reason: "تقييم جديد — الدراسة صدرت",
    });
    expect(appraiserStep(appraisal({ studyReportIssued: true }), draft({ progressPct: 65 }))).toMatchObject({
      stage: "valuation",
      action: "متابعة التقييم",
      reason: "قيد التقييم — الدراسة صدرت — جاهز للتسليم",
    });
  });

  // 2026-11-11: it carried the same tag and chip as a due valuation — only the small line differed.
  it("tells advance work apart while the study is not issued: enterable, nothing due", () => {
    expect(appraiserStep(appraisal(), draft({}))).toMatchObject({
      stage: "prework",
      action: "إعداد مسبق",
      reason: "يمكن بدء التقييم كمسودة — الدراسة لم تصدر بعد، والتسليم بعد صدورها",
    });
    expect(appraiserStep(appraisal(), draft({ progressPct: 30 }))).toMatchObject({
      stage: "prework",
      action: "إعداد مسبق",
      reason: "مسودة قيد الإعداد — الدراسة لم تصدر بعد، والتسليم بعد صدورها",
    });
  });

  it("returns a reopened package as a correction, whatever the draft says", () => {
    expect(appraiserStep(appraisal({ appraisalPackageStatus: "reopened" }), undefined)).toMatchObject({
      stage: "correction",
      action: "تصحيح التقييم",
    });
  });

  it("makes a handed-over valuation his only while a draft waits for his approval", () => {
    const handed = appraisal({ appraisalPackageStatus: "submitted" });
    expect(appraiserStep(handed, draft({ status: "sent" }))).toMatchObject({
      stage: "approval",
      action: "اعتماد مسودة التقرير",
    });
    // What waits for someone else is a lookup row, not his work: no draft yet, one being prepared, an approved one.
    expect(appraiserStep(handed, undefined)).toMatchObject({
      stage: "handed",
      reason: "سُلِّم التقييم — بانتظار المراجعة",
    });
    expect(appraiserStep(handed, draft({ status: "preparing" })).stage).toBe("handed");
    expect(appraiserStep(handed, draft({ status: "approved", reportStage: "deposit_issued" }))).toMatchObject({
      stage: "handed",
      reason: "معتمد — بانتظار رمز الإيداع",
    });
    expect(appraiserStep(handed, draft({ status: "approved", reportStage: "final_issued" }))).toMatchObject({
      stage: "handed",
      reason: "صدر التقرير النهائي",
    });
  });
});

describe("buildMyWork — the appraiser's rows (Omar 2026-11-10)", () => {
  const rows = (tasks: WorkflowTask[], states: Record<string, ReportDraftState> = {}) =>
    buildMyWork(
      input({
        groups: ["ap"],
        mine: tasks,
        allTasks: tasks,
        draftState: (id) => states[id],
      }),
    ).items;

  it("makes one row per valuation, opening his page", () => {
    const [row] = rows([appraisal({ id: "a9", studyReportIssued: true })]);
    expect(row).toMatchObject({ group: "ap", stage: "valuation", action: "بدء التقييم", href: "/property-appraisal/a9" });
  });

  it("lists what is due first, then the advance work, then what he handed over", () => {
    const out = rows([
      appraisal({ id: "h1", propertyId: "p3", appraisalPackageStatus: "submitted" }),
      appraisal({ id: "w1", propertyId: "p2" }),
      appraisal({ id: "d1", propertyId: "p1", studyReportIssued: true }),
    ]);
    expect(out.map((r) => [r.taskId, r.stage])).toEqual([
      ["d1", "valuation"],
      ["w1", "prework"],
      ["h1", "handed"],
    ]);
    expect(out[1]).toMatchObject({ action: "إعداد مسبق", href: "/property-appraisal/w1" });
  });

  it("opens a draft waiting for approval on the report window", () => {
    const t = appraisal({ id: "a9", appraisalPackageStatus: "submitted" });
    const [row] = rows([t], { p1: draft({ status: "sent" }) });
    expect(row).toMatchObject({ stage: "approval", href: "/property-appraisal/a9?report=1" });
  });

  it("lists a handed-over valuation under its own stage, neutral and after the work waiting for him", () => {
    const handed = appraisal({ id: "h1", propertyId: "p2", appraisalPackageStatus: "submitted" });
    const mine = appraisal({ id: "m1", propertyId: "p1", studyReportIssued: true });
    const out = rows([handed, mine]);
    expect(out.map((r) => [r.taskId, r.stage, r.due])).toEqual([
      ["m1", "valuation", expect.any(String)],
      ["h1", "handed", "none"],
    ]);
    expect(out[1]).toMatchObject({ action: "تم التسليم", href: "/property-appraisal/h1" });
  });

  it("leaves out cancelled, completed and folded valuations and other kinds of task", () => {
    expect(
      rows([
        appraisal({ id: "c", status: "cancelled" }),
        appraisal({ id: "d", status: "completed" }),
        appraisal({ id: "f", transactionStudyHolderPropertyId: "other-deed" }),
        task({ id: "s" }),
      ]),
    ).toEqual([]);
  });

  it("adds nothing for someone without the appraiser's group", () => {
    const t = appraisal();
    expect(buildMyWork(input({ groups: ["st"], mine: [t], allTasks: [t] })).items).toEqual([]);
  });
});

describe("returnedLine — why work came back (A→Z 2026-11-09)", () => {
  it("names a study returned to the study with its reason", () => {
    expect(
      returnedLine(
        {
          lastStepKey: "case-study-report:t1:reopened:2026-11-08T14:56:37Z",
          lastStepDetail: "أسامة الصالحي — وصف المكونات لا يذكر الملحق الأرضي",
        },
        "study",
      ),
    ).toBe("أُعيدت للدراسة: وصف المكونات لا يذكر الملحق الأرضي");
  });

  it("names a draft the appraiser returned with his reason", () => {
    expect(
      returnedLine(
        {
          lastStepKey: "valuation:v1:returned-to-reviewer:639297466704568511",
          lastStepDetail: "عبدالله الكثيري — رقم رخصة البناء يحتاج تأكيداً",
        },
        "draft",
      ),
    ).toBe("أعادها المقيّم: رقم رخصة البناء يحتاج تأكيداً");
  });

  it("is null for any other latest step, and the label alone without a detail", () => {
    expect(returnedLine({ lastStepKey: "party:p:submitted:1" }, "study")).toBeNull();
    expect(returnedLine({ lastStepKey: "case-study-report:t:reopened:x" }, "draft")).toBeNull();
    expect(returnedLine({ lastStepKey: "case-study-report:t:reopened:x" }, "study")).toBe("أُعيدت للدراسة");
  });

  it("puts the return on the study row instead of «معاملة واردة من التنسيق»", () => {
    const t = task({
      transactionReceived: true,
      lastStepKey: "case-study-report:t:reopened:x",
      lastStepDetail: "أسامة — أكمل وصف الملحق",
    });
    const { items } = buildMyWork(input({ groups: ["st"], mine: [t], allTasks: [t] }));
    expect(items[0]!.reason).toBe("أُعيدت للدراسة: أكمل وصف الملحق");
  });
});

describe("inspectorStep — what an inspection needs from the inspector (Omar 2026-11-12)", () => {
  const open = { status: "open" } as const;

  it("is a new inspection until he enters something, then one in progress", () => {
    expect(inspectorStep(open, undefined)).toMatchObject({ stage: "inspection", action: "بدء المعاينة" });
    expect(inspectorStep(open, { status: "", started: false })).toMatchObject({ action: "بدء المعاينة" });
    expect(inspectorStep(open, { status: "draft", started: true })).toMatchObject({
      stage: "inspection",
      action: "متابعة المعاينة",
    });
  });

  it("is a correction once the package is returned to him", () => {
    expect(inspectorStep(open, { status: "reopened", started: true })).toMatchObject({
      stage: "inspection-correction",
      action: "تصحيح المعاينة",
    });
  });

  it("is sent once the package is submitted or the task completed, and says whether it was accepted", () => {
    expect(inspectorStep(open, { status: "submitted", started: true })).toMatchObject({
      stage: "inspection-sent",
      reason: "أُرسلت المعاينة — بانتظار قبول التنسيق",
    });
    expect(inspectorStep({ status: "completed" }, undefined).stage).toBe("inspection-sent");
    expect(inspectorStep({ status: "completed", packageAccepted: true }, undefined).reason).toBe(
      "قبل التنسيق مخرجات المعاينة",
    );
  });
});

describe("buildMyWork — the field inspector's rows (Omar 2026-11-12)", () => {
  const inspection = (over: Partial<WorkflowTask>) =>
    task({ kind: "field-inspection", assigneeRole: "field-inspector", ...over });
  const rows = (tasks: WorkflowTask[], packages: Record<string, { status: string; started: boolean }> = {}) =>
    buildMyWork(
      input({ groups: ["fi"], mine: tasks, allTasks: tasks, inspectionPackage: (id) => packages[id] }),
    ).items;

  it("makes one row per inspection, opening his page", () => {
    const [row] = rows([inspection({ id: "i9" })]);
    expect(row).toMatchObject({
      group: "fi",
      stage: "inspection",
      action: "بدء المعاينة",
      href: "/active-inspection/i9",
    });
  });

  it("lists what he owes first, then what he sent — neutral, the latest first", () => {
    const out = rows(
      [
        inspection({ id: "s-old", status: "completed", createdAt: "2026-10-01T00:00:00Z" }),
        inspection({ id: "s-new", status: "completed", createdAt: "2026-10-20T00:00:00Z" }),
        inspection({ id: "back" }),
        inspection({ id: "todo" }),
      ],
      { back: { status: "reopened", started: true } },
    );
    expect(out.map((r) => [r.taskId, r.stage])).toEqual([
      ["back", "inspection-correction"],
      ["todo", "inspection"],
      ["s-new", "inspection-sent"],
      ["s-old", "inspection-sent"],
    ]);
    expect(out.filter((r) => r.stage === "inspection-sent").every((r) => r.due === "none")).toBe(true);
  });

  it("drops a sent inspection once its transaction is over, and keeps what he still owes on it", () => {
    const tasks = [
      inspection({ id: "sent-live", propertyId: "live", status: "completed" }),
      inspection({ id: "sent-over", propertyId: "over", status: "completed" }),
      inspection({ id: "todo-over", propertyId: "over2" }),
    ];
    const out = buildMyWork(
      input({
        groups: ["fi"],
        mine: tasks,
        allTasks: tasks,
        transactionFinished: (propertyId) => propertyId.startsWith("over"),
      }),
    ).items;
    expect(out.map((r) => r.taskId)).toEqual(["todo-over", "sent-live"]);
  });

  it("keeps a sent inspection while nothing says its transaction is over", () => {
    expect(rows([inspection({ id: "s", status: "completed" })]).map((r) => r.taskId)).toEqual(["s"]);
  });

  it("leaves out a cancelled inspection and other kinds of task", () => {
    expect(rows([inspection({ id: "x", status: "cancelled" }), task({ id: "cs" })])).toEqual([]);
  });

  it("opens on the stage that holds work for him, never on «المرسلة»", () => {
    const stages = (...s: MyWorkStage[]) => s.map((stage) => ({ stage }));
    expect(defaultMyWorkStage(["fi"], stages("inspection-sent", "inspection-correction"))).toBe(
      "inspection-correction",
    );
    expect(defaultMyWorkStage(["fi"], stages("inspection-sent"))).toBe("inspection");
    expect(isMyWorkLookupStage("inspection-sent")).toBe(true);
    expect(isMyWorkLookupStage("handed")).toBe(true);
    expect(isMyWorkLookupStage("inspection")).toBe(false);
  });
});
