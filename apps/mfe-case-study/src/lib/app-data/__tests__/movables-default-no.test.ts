import { describe, expect, it } from "vitest";
import { withMovablesDefaultNo } from "../inspector-workspace-commands";
import { createInspectorWorkspaceDraft } from "../inspector-workspace-data";

const base = () =>
  createInspectorWorkspaceDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" });

describe("withMovablesDefaultNo", () => {
  it("makes an untouched «يوجد منقولات» a «لا»", () => {
    expect(withMovablesDefaultNo(base()).featureValues.movables).toBe("لا");
  });

  it("keeps an answer the inspector already gave", () => {
    const yes = { ...base(), featureValues: { movables: "نعم" } };
    expect(withMovablesDefaultNo(yes)).toBe(yes);
  });

  it("does not touch other features", () => {
    const draft = { ...base(), featureValues: { facade: "شمالية" } };
    expect(withMovablesDefaultNo(draft).featureValues).toEqual({
      facade: "شمالية",
      movables: "لا",
    });
  });
});
