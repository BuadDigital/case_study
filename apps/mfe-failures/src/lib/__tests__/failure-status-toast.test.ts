import { describe, expect, it } from "vitest";
import { failureStatusErrorToast } from "../failure-status-toast";

const APPROVE = "تعذّر اعتماد التعذر — حاول مرة أخرى";

describe("failureStatusErrorToast", () => {
  it("leads with the action copy and appends the server detail", () => {
    expect(
      failureStatusErrorToast(APPROVE, "تعذّر الاتصال بالخادم — تحقق من تشغيل API"),
    ).toBe(`${APPROVE} (تعذّر الاتصال بالخادم — تحقق من تشغيل API)`);
  });

  it("keeps the action copy alone when there is no detail", () => {
    expect(failureStatusErrorToast(APPROVE)).toBe(APPROVE);
    expect(failureStatusErrorToast(APPROVE, "")).toBe(APPROVE);
    expect(failureStatusErrorToast(APPROVE, "   ")).toBe(APPROVE);
    expect(failureStatusErrorToast(APPROVE, undefined)).toBe(APPROVE);
    expect(failureStatusErrorToast(APPROVE, { kind: "network" })).toBe(APPROVE);
  });

  it("does not repeat a detail the action copy already carries", () => {
    expect(failureStatusErrorToast(APPROVE, APPROVE)).toBe(APPROVE);
    expect(failureStatusErrorToast(APPROVE, "حاول مرة أخرى")).toBe(APPROVE);
  });

  it("uses a thrown Error's message on the catch path", () => {
    expect(failureStatusErrorToast(APPROVE, new Error("boom"))).toBe(
      `${APPROVE} (boom)`,
    );
  });

  it("always contains the action copy, whatever the detail", () => {
    for (const detail of ["x", new Error("y"), null, 42, undefined]) {
      expect(failureStatusErrorToast(APPROVE, detail)).toContain(APPROVE);
    }
  });
});
