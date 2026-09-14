import { describe, expect, it } from "vitest";
import { propertyFieldAutosaveKey } from "../property-field-autosave";

describe("propertyFieldAutosaveKey", () => {
  it("keys each صك by po + property id so drafts never collide", () => {
    expect(propertyFieldAutosaveKey(" PO-1 ", " aaa ")).toBe("PO-1|aaa");
    expect(propertyFieldAutosaveKey("PO-1", "prop-a")).not.toBe(
      propertyFieldAutosaveKey("PO-1", "prop-b"),
    );
    expect(propertyFieldAutosaveKey("PO-1", "prop-a")).not.toBe(
      propertyFieldAutosaveKey("PO-2", "prop-a"),
    );
  });
});
