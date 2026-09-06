import { describe, expect, it } from "vitest";
import {
  MATCHED_DEFAULT_NOTE,
  applyCourtAccessOption,
  attachmentTileTitle,
  buildCourtAccessBody,
  courtAccessAttachmentRemoved,
  courtAccessAttachmentUploaded,
  courtAccessSavedMessage,
  deliverSuccessMessage,
  findPendingHandoff,
  initialCourtAccessDraft,
  receiveHolderLabel,
  receiveSuccessMessage,
  validateMatchResult,
  type CourtAccessDraft,
} from "../key-envelope-dialogs-state";
import type {
  KeyEnvelopeHandoff,
  KeyEnvelopeRow,
  PropertyCourtAccessRow,
} from "../../lib/keys-envelope-types";

function handoff(over: Partial<KeyEnvelopeHandoff>): KeyEnvelopeHandoff {
  return {
    id: "h1",
    kind: "internal",
    fromParty: "clerk",
    toParty: "inspector",
    status: "confirmed",
    createdByName: "clerk",
    createdAtUtc: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function envelope(handoffs: KeyEnvelopeHandoff[]): KeyEnvelopeRow {
  return {
    id: "e1",
    requestNumber: "REQ-1",
    court: "محكمة",
    circuit: "دائرة",
    keysCountLabeled: 1,
    keysCountActual: 1,
    countMismatch: false,
    receiveScenario: "court",
    status: "assessor",
    feeGenerated: false,
    createdByName: "clerk",
    createdAtUtc: "2026-01-01T00:00:00Z",
    assignments: [],
    handoffs,
    timeline: [],
    linkedProperties: [],
  };
}

function draft(over: Partial<CourtAccessDraft> = {}): CourtAccessDraft {
  return { ...initialCourtAccessDraft(), ...over };
}

describe("validateMatchResult", () => {
  it("requires a tile", () => {
    expect(validateMatchResult("", "")).toEqual({
      ok: false,
      error: "اختر نتيجة المطابقة أولاً.",
    });
  });

  it("requires a note for anything but a full match", () => {
    const result = validateMatchResult("partial", "   ");
    expect(result.ok).toBe(false);
    expect(validateMatchResult("partial", " شقة 3 ")).toEqual({
      ok: true,
      status: "partial",
      note: "شقة 3",
    });
  });

  it("stores the field-confirmation wording for a full match", () => {
    expect(validateMatchResult("matched", "ignored")).toEqual({
      ok: true,
      status: "matched",
      note: MATCHED_DEFAULT_NOTE,
    });
  });
});

describe("receive dialog", () => {
  it("finds the latest pending handoff", () => {
    const env = envelope([
      handoff({ id: "old", status: "pending_confirm" }),
      handoff({ id: "done" }),
      handoff({ id: "new", status: "pending_confirm" }),
    ]);
    expect(findPendingHandoff(env)?.id).toBe("new");
    expect(findPendingHandoff(envelope([handoff({})]))).toBeUndefined();
  });

  it("labels the holder from the pending handoff, then the last handoff", () => {
    const pending = handoff({ status: "pending_confirm", toParty: "أحمد" });
    expect(receiveHolderLabel(envelope([pending]), pending)).toBe("أحمد");
    const last = envelope([handoff({ toParty: "سارة" })]);
    expect(receiveHolderLabel(last, undefined)).toBe("سارة");
  });

  it("falls back to «الطرف الحالي» when no holder is known", () => {
    expect(receiveHolderLabel(envelope([]), undefined)).toBe("الطرف الحالي");
  });
});

describe("toast copy", () => {
  it("renders the three success messages", () => {
    expect(receiveSuccessMessage("REQ-1")).toBe("تم تأكيد استلام الظرف REQ-1.");
    expect(deliverSuccessMessage("external", "REQ-1")).toBe(
      "تم تسجيل «تسليم خارجي» على الظرف REQ-1.",
    );
    expect(courtAccessSavedMessage("123")).toBe("تم تحديث مسار الدخول لصك 123.");
  });
});

describe("attachmentTileTitle", () => {
  const labels = { replace: "استبدال", upload: "رفع" };

  it("prefers the freshly uploaded name, then replace, then upload", () => {
    expect(attachmentTileTitle("a.pdf", "id", labels)).toBe("تم الإرفاق: a.pdf");
    expect(attachmentTileTitle("", "id", labels)).toBe("استبدال");
    expect(attachmentTileTitle("", null, labels)).toBe("رفع");
    expect(attachmentTileTitle("", undefined, labels)).toBe("رفع");
  });
});

describe("court access draft", () => {
  const saved: PropertyCourtAccessRow = {
    id: "r1",
    propertyId: "p1",
    poNumber: "PO-1",
    deedNumber: "123",
    requestNumber: "REQ-1",
    hasEnablingLetter: true,
    enablingLetterAttachmentId: "en-1",
    hasEvictionNotice: false,
    evictionNoticeAttachmentId: null,
    studyHoldStatus: "enabled_no_key",
    contactPhones: "0500",
    notes: "n",
    updatedByName: "x",
    updatedAtUtc: "2026-01-01T00:00:00Z",
  };

  it("seeds the draft from the saved row without a file name", () => {
    expect(initialCourtAccessDraft(saved)).toEqual({
      hasEnablingLetter: true,
      enablingLetterId: "en-1",
      enablingLetterName: "",
      hasEvictionNotice: false,
      evictionNoticeId: null,
      evictionNoticeName: "",
      contactPhones: "0500",
      notes: "n",
    });
    expect(initialCourtAccessDraft().contactPhones).toBe("");
  });

  it("«لا يوجد» clears both attachments", () => {
    const start = draft({
      hasEnablingLetter: true,
      enablingLetterId: "en",
      hasEvictionNotice: true,
      evictionNoticeId: "ev",
      contactPhones: "keep",
    });
    const next = applyCourtAccessOption("none", start);
    expect(next.pickFile).toBeUndefined();
    expect(next.draft).toMatchObject({
      hasEnablingLetter: false,
      enablingLetterId: null,
      hasEvictionNotice: false,
      evictionNoticeId: null,
      contactPhones: "keep",
    });
  });

  it("«تمكين» drops the eviction notice and asks for a file when none is attached", () => {
    const next = applyCourtAccessOption(
      "enabling",
      draft({ hasEvictionNotice: true, evictionNoticeId: "ev" }),
    );
    expect(next.pickFile).toBe("enabling");
    expect(next.draft.hasEvictionNotice).toBe(false);
    expect(next.draft.evictionNoticeId).toBeNull();
    expect(next.draft.hasEnablingLetter).toBe(false);
  });

  it("«تمكين» re-flags an already attached letter without a picker", () => {
    const next = applyCourtAccessOption(
      "enabling",
      draft({ hasEnablingLetter: false, enablingLetterId: "en" }),
    );
    expect(next.pickFile).toBeUndefined();
    expect(next.draft.hasEnablingLetter).toBe(true);
  });

  it("«محظر إخلاء» keeps the enabling letter and asks for a file when needed", () => {
    const withLetter = draft({ hasEnablingLetter: true, enablingLetterId: "en" });
    const ask = applyCourtAccessOption("eviction", withLetter);
    expect(ask.pickFile).toBe("eviction");
    expect(ask.draft).toBe(withLetter);
    const flag = applyCourtAccessOption(
      "eviction",
      draft({ evictionNoticeId: "ev" }),
    );
    expect(flag.pickFile).toBeUndefined();
    expect(flag.draft.hasEvictionNotice).toBe(true);
  });

  it("records and removes uploads per kind", () => {
    const up = courtAccessAttachmentUploaded(draft(), "eviction", "ev", "n.pdf");
    expect(up).toMatchObject({
      hasEvictionNotice: true,
      evictionNoticeId: "ev",
      evictionNoticeName: "n.pdf",
    });
    expect(courtAccessAttachmentRemoved(up, "eviction")).toMatchObject({
      hasEvictionNotice: false,
      evictionNoticeId: null,
      evictionNoticeName: "",
    });
    const en = courtAccessAttachmentUploaded(draft(), "enabling", "en", "l.pdf");
    expect(en.enablingLetterName).toBe("l.pdf");
    expect(courtAccessAttachmentRemoved(en, "enabling").enablingLetterId).toBeNull();
  });

  it("builds the body: new id wins, saved id kept only while flagged", () => {
    const kept = buildCourtAccessBody(
      "p1",
      draft({ hasEnablingLetter: true, enablingLetterId: null, notes: " x " }),
      saved,
    );
    expect(kept).toEqual({
      propertyId: "p1",
      hasEnablingLetter: true,
      enablingLetterAttachmentId: "en-1",
      hasEvictionNotice: false,
      evictionNoticeAttachmentId: null,
      contactPhones: null,
      notes: "x",
    });
    const replaced = buildCourtAccessBody(
      "p1",
      draft({ hasEnablingLetter: true, enablingLetterId: "en-2" }),
      saved,
    );
    expect(replaced.enablingLetterAttachmentId).toBe("en-2");
    const cleared = buildCourtAccessBody(
      "p1",
      draft({ hasEnablingLetter: false, enablingLetterId: null }),
      saved,
    );
    expect(cleared.enablingLetterAttachmentId).toBeNull();
  });
});
