import { describe, expect, it } from "vitest";
import {
  applyValuationReportLiveFill,
  buildValuationReportLiveFill,
  filterSpecialAssumptionBullets,
} from "../valuation-report-live-fill";
import {
  createEvaluatorDraft,
  emptyReportChoices,
} from "../evaluator-window-data";

describe("filterSpecialAssumptionBullets", () => {
  it("returns null when library is empty (keep template)", () => {
    expect(filterSpecialAssumptionBullets([], [])).toBeNull();
    expect(filterSpecialAssumptionBullets(null, [true])).toBeNull();
  });

  it("defaults missing toggles to on and drops unchecked", () => {
    expect(
      filterSpecialAssumptionBullets(["أ", "ب", "ج"], [true, false]),
    ).toEqual(["أ", "ج"]);
    expect(filterSpecialAssumptionBullets(["أ", "ب"], [])).toEqual(["أ", "ب"]);
  });

  it("returns empty array when all unchecked", () => {
    expect(
      filterSpecialAssumptionBullets(["أ", "ب"], [false, false]),
    ).toEqual([]);
  });
});

describe("§29 special assumption live fill", () => {
  it("prints only checked assumptions from the org library", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    draft.reportChoices = {
      ...emptyReportChoices(),
      specialAssumptionOn: [true, false, true],
    };
    const fill = buildValuationReportLiveFill({
      draft,
      specialAssumptionLibrary: ["افتراض 1", "افتراض 2", "افتراض 3"],
    });
    expect(fill.specialAssumptionBullets).toEqual(["افتراض 1", "افتراض 3"]);

    const dom = new DOMParser().parseFromString(
      `<!DOCTYPE html><html><body>
        <section data-sec="29">
          <ul><li>قديم أ</li><li>قديم ب</li><li>قديم ج</li><li>قديم د</li></ul>
        </section>
      </body></html>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    expect(
      [...dom.querySelectorAll('[data-sec="29"] li')].map((li) => li.textContent),
    ).toEqual(["افتراض 1", "افتراض 3"]);
  });

  it("clears the list when every toggle is off", () => {
    const draft = createEvaluatorDraft({
      taskId: "t1",
      propertyId: "p1",
      poNumber: "PO-1",
    });
    draft.reportChoices = {
      ...emptyReportChoices(),
      specialAssumptionOn: [false, false],
    };
    const fill = buildValuationReportLiveFill({
      draft,
      specialAssumptionLibrary: ["أ", "ب"],
    });
    expect(fill.specialAssumptionBullets).toEqual([]);

    const dom = new DOMParser().parseFromString(
      `<section data-sec="29"><ul><li>قديم</li></ul></section>`,
      "text/html",
    );
    applyValuationReportLiveFill(dom, fill);
    expect(dom.querySelectorAll('[data-sec="29"] li')).toHaveLength(0);
  });
});
