import { describe, expect, it } from "vitest";
import { inspectorPreSubmitGate, inspectorSubmitStamp } from "../inspector-submit-gate";

const known = (keyAvailable: boolean) => ({ status: "known" as const, keyAvailable });
const unsigned = { clientDeclarationSigned: false, declarationPhoneSatisfied: false };
const phone = [{ phone: "0551234567" }];

/** 2026-11-04: the desktop submit runs the phone's gate and stamps the same fields. */
describe("inspectorPreSubmitGate — one gate for phone and desktop", () => {
  it("lets the inspection go with the known key answer, «no key» included", () => {
    expect(
      inspectorPreSubmitGate({
        draft: unsigned,
        role: "field-inspector",
        contacts: [],
        keyAvailability: known(false),
      }),
    ).toEqual({ ok: true, keyAvailable: false, hasPhone: false });
  });

  it.each(["loading", "error", "offline", "unavailable"] as const)(
    "holds the inspection while the key status is %s",
    (status) => {
      const gate = inspectorPreSubmitGate({
        draft: unsigned,
        role: "field-inspector",
        contacts: phone,
        keyAvailability: { status, keyAvailable: null },
      });
      expect(gate.ok).toBe(false);
      expect(!gate.ok && gate.reason).toMatch(/المفتاح/);
    },
  );

  it("refuses a signed declaration without any party phone", () => {
    const gate = inspectorPreSubmitGate({
      draft: { clientDeclarationSigned: true, declarationPhoneSatisfied: false },
      role: "field-inspector",
      contacts: [{ phone: "" }],
      keyAvailability: known(true),
    });
    expect(gate.ok).toBe(false);
    expect(!gate.ok && gate.reason).toMatch(/جوال/);
  });

  it("accepts a signed declaration once a phone was present at the signing", () => {
    const gate = inspectorPreSubmitGate({
      draft: { clientDeclarationSigned: true, declarationPhoneSatisfied: true },
      role: "field-inspector",
      contacts: [],
      keyAvailability: known(true),
    });
    expect(gate).toEqual({ ok: true, keyAvailable: true, hasPhone: false });
  });
});

describe("inspectorSubmitStamp", () => {
  it("sends the key answer and the declaration, keeping the phone flag once set", () => {
    expect(
      inspectorSubmitStamp(
        { vacantLand: false, clientDeclarationSigned: true, declarationPhoneSatisfied: false },
        { keyAvailable: true, hasPhone: true },
      ),
    ).toEqual({
      vacantLand: false,
      keyAvailable: true,
      clientDeclarationSigned: true,
      declarationPhoneSatisfied: true,
    });
    expect(
      inspectorSubmitStamp(
        { vacantLand: true, clientDeclarationSigned: false, declarationPhoneSatisfied: true },
        { keyAvailable: false, hasPhone: false },
      ),
    ).toEqual({
      vacantLand: true,
      keyAvailable: false,
      clientDeclarationSigned: false,
      declarationPhoneSatisfied: true,
    });
  });
});
