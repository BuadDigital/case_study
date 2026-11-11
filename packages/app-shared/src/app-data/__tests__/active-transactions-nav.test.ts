import { describe, expect, it } from "vitest";
import { activeTransactionNavForRole } from "../active-transactions";

describe("activeTransactionNavForRole", () => {
  it("drops the case-study stage queues for a role that has «أعمالي»", () => {
    const ids = activeTransactionNavForRole(
      ["my-work", "active-primary-data", "active-receipt", "system-upload", "party-fees"],
      "section-supervisor",
    ).map((i) => i.id);
    expect(ids).toEqual(["party-fees"]);
  });

  it("drops the appraiser's «تقييم العقار» once he has «أعمالي», and keeps it without", () => {
    expect(
      activeTransactionNavForRole(["my-work", "po", "property-appraisal"], "real-estate-appraiser"),
    ).toEqual([]);
    expect(
      activeTransactionNavForRole(["po", "property-appraisal"], "real-estate-appraiser").map((i) => i.id),
    ).toEqual(["property-appraisal"]);
  });

  it("keeps the stage queues for a role without «أعمالي» and the party queues for everyone", () => {
    expect(activeTransactionNavForRole(["active-receipt"], "case-specialist").map((i) => i.id)).toEqual([
      "active-receipt",
    ]);
    expect(
      activeTransactionNavForRole(["my-work", "active-inspection"], "cdo").map((i) => i.id),
    ).toEqual(["active-inspection"]);
  });
});
