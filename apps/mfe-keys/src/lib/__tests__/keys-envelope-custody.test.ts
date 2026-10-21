import { describe, expect, it } from "vitest";
import {
  envelopeHolderText,
  keyLocationLabel,
  otherKeysInEnvelope,
  type KeyEnvelopeAssignment,
} from "../keys-envelope-types";

function assignment(status: string, over: Partial<KeyEnvelopeAssignment> = {}): KeyEnvelopeAssignment {
  return { id: `${status}-${over.deedNumber ?? "D"}`, deedNumber: "D", status, ...over };
}

describe("envelopeHolderText (decision 2026-10-20)", () => {
  const base = { status: "assessor", court: "محكمة جدة", createdByName: "سالم" };

  it("names the holder by kind, with sensible fallbacks", () => {
    expect(envelopeHolderText({ ...base, holderKind: "internal_user", holderLabel: "أحمد" })).toBe("أحمد");
    expect(envelopeHolderText({ ...base, holderKind: "external", holderLabel: "شركة" })).toBe("طرف خارجي: شركة");
    expect(envelopeHolderText({ ...base, holderKind: "court", holderLabel: "" })).toBe("محكمة جدة");
    expect(envelopeHolderText({ ...base, holderKind: "reviewer", holderLabel: null })).toBe("سالم");
  });

  it("falls back to the custody status for rows before the holder existed", () => {
    expect(envelopeHolderText({ ...base, holderKind: undefined })).toBe("بعهدة المعاين");
  });
});

describe("otherKeysInEnvelope", () => {
  it("is the actual count minus the deeds that matched, never negative", () => {
    expect(
      otherKeysInEnvelope({
        keysCountActual: 5,
        assignments: [assignment("matched"), assignment("partial"), assignment("pending")],
      }),
    ).toBe(3);
    expect(otherKeysInEnvelope({ keysCountActual: 1, assignments: [assignment("matched"), assignment("matched", { deedNumber: "E" })] })).toBe(0);
  });
});

describe("keyLocationLabel", () => {
  it("names the place, with the holder when the key is with someone", () => {
    expect(keyLocationLabel("in_envelope")).toBe("في الظرف");
    expect(keyLocationLabel(undefined)).toBe("في الظرف");
    expect(keyLocationLabel("with_user", "أحمد")).toBe("عند أحمد");
    expect(keyLocationLabel("with_user", "")).toBe("عند مستخدم");
    expect(keyLocationLabel("returned_court")).toBe("أُعيد للمحكمة");
    expect(keyLocationLabel("missing")).toBe("مفقود");
  });
});
