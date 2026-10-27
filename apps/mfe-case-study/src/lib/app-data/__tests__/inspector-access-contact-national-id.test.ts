import { describe, expect, it } from "vitest";
import { createInspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import { validateInspectorWorkspace } from "../inspector-workspace-validation";

function errorsFor(accessContactNationalId: string) {
  const base = createInspectorWorkspaceDraft({ taskId: "t", propertyId: "p", poNumber: "po" });
  return validateInspectorWorkspace({ ...base, accessContactNationalId } as never, {});
}

describe("the access contact's national id is optional (Omar 2026-10-27)", () => {
  it("an empty id raises no error", () => {
    expect(errorsFor("").accessContactNationalId).toBeUndefined();
    expect(errorsFor("   ").accessContactNationalId).toBeUndefined();
  });

  it("a valid id raises no error", () => {
    expect(errorsFor("1098765432").accessContactNationalId).toBeUndefined();
  });

  it("an id that is typed but malformed is still rejected", () => {
    expect(errorsFor("123").accessContactNationalId).toBeTruthy();
  });
});
