import { describe, expect, it } from "vitest";
import { emptyProperty } from "../../../app-data/po-intake-data";
import { validatePropertyEnfathFields } from "../property-deed-validation";

describe("validatePropertyEnfathFields — field policy", () => {
  const deedProperty = () => ({
    ...emptyProperty(),
    deedNumber: "1234567890",
    assignmentMandateNumber: "M-1",
    assignmentMandateDate: "2026-01-01",
    ownerName: "",
    delegationLetterFileNames: ["delegation.pdf"],
    assignmentDocFileNames: [],
  });

  const relaxedPolicy = { showsAssignmentDoc: false, requiresOwnerName: false };

  // 2026-11-15: قرار الإسناد is optional — some assignments come without it.
  it("requires اسم المالك by default but never قرار الإسناد", () => {
    const errors = validatePropertyEnfathFields(deedProperty(), "تنفيذ");
    expect(errors.assignmentDocFileNames).toBeUndefined();
    expect(errors.ownerName).toBeDefined();
  });

  it("skips قرار الإسناد and اسم المالك when the field policy relaxes them (e.g. Nabr)", () => {
    const errors = validatePropertyEnfathFields(deedProperty(), "تنفيذ", relaxedPolicy);
    expect(errors.assignmentDocFileNames).toBeUndefined();
    expect(errors.ownerName).toBeUndefined();
  });

  it("never requires خطاب التكليف (Omar 2026-11-16)", () => {
    const prop = { ...deedProperty(), delegationLetterFileNames: [] };
    const errors = validatePropertyEnfathFields(prop, "تنفيذ", relaxedPolicy);
    expect(errors.delegationLetterFileNames).toBeUndefined();
  });

  it("validates a stored bourse-inquiry row like any deed (no separate rules)", () => {
    const prop = { ...deedProperty(), identifierType: "bourse_inquiry" as const };
    const errors = validatePropertyEnfathFields(prop, "تنفيذ", relaxedPolicy);
    expect(errors.deedDate).toBeUndefined();
    expect(errors.delegationLetterFileNames).toBeUndefined();
  });
});
