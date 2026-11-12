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
      activeTransactionNavForRole(["my-work", "active-survey"], "cdo").map((i) => i.id),
    ).toEqual(["active-survey"]);
  });

  // Omar 2026-11-12: the inspector's sidebar like the specialists' and the appraiser's.
  it("drops the inspector's «معاينة العقار» once he has «أعمالي», and keeps his fees", () => {
    expect(
      activeTransactionNavForRole(
        ["my-work", "po", "active-inspection", "party-fees"],
        "field-inspector",
      ).map((i) => i.id),
    ).toEqual(["party-fees"]);
  });

  it("keeps «معاينة العقار» for the inspector on a phone, where he does not hold «أعمالي»", () => {
    expect(
      activeTransactionNavForRole(["po", "active-inspection", "party-fees"], "field-inspector").map(
        (i) => i.id,
      ),
    ).toEqual(["active-inspection", "party-fees"]);
  });
});
