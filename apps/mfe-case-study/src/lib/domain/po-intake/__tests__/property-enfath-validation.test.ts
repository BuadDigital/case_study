import { describe, expect, it } from "vitest";
import { emptyProperty } from "../../../app-data/po-intake-data";
import { validatePropertyEnfathFields } from "../property-enfath-validation";

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

  const relaxedPolicy = { requiresAssignmentDoc: false, requiresOwnerName: false };

  it("requires قرار الإسناد and اسم المالك by default", () => {
    const errors = validatePropertyEnfathFields(deedProperty(), "تنفيذ");
    expect(errors.assignmentDocFileNames).toBe("قرار الإسناد مطلوب");
    expect(errors.ownerName).toBeDefined();
  });

  it("skips قرار الإسناد and اسم المالك when the field policy relaxes them (e.g. Nabr)", () => {
    const errors = validatePropertyEnfathFields(deedProperty(), "تنفيذ", relaxedPolicy);
    expect(errors.assignmentDocFileNames).toBeUndefined();
    expect(errors.ownerName).toBeUndefined();
  });

  it("skips the same fields for a bourse-inquiry property under a relaxed policy", () => {
    const prop = {
      ...deedProperty(),
      identifierType: "bourse_inquiry" as const,
      deedDate: "2026-01-01",
    };
    const errors = validatePropertyEnfathFields(prop, "تنفيذ", relaxedPolicy);
    expect(errors.assignmentDocFileNames).toBeUndefined();
    expect(errors.ownerName).toBeUndefined();
  });
});
