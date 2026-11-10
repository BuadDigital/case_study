import { describe, expect, it } from "vitest";
import { evaluatorSections, evaluatorSectionsStep } from "../evaluator-window-tabs";
import { currentWorkScreen } from "../valuation-work/lib/shell-state";

describe("the appraiser's page sections", () => {
  it("lists the summary first and drops the screen of an approach that is off", () => {
    expect(evaluatorSections({ market: true, cost: true }).map((s) => s.id)).toEqual([
      "summary",
      "basic",
      "market",
      "cost",
      "final",
      "review",
    ]);
    expect(evaluatorSections({ market: true, cost: false }).map((s) => s.id)).toEqual([
      "summary",
      "basic",
      "market",
      "final",
      "review",
    ]);
  });

  it("reads the summary together with the approaches, as the first step", () => {
    const [summary, basic] = evaluatorSections({ market: false, cost: false });
    expect(summary?.step).toBe(basic?.step);
    expect(evaluatorSectionsStep(null, false)).toBe(basic?.step);
  });

  it("puts a handed-over valuation past every section", () => {
    const steps = evaluatorSections({ market: true, cost: true }).map((s) => s.step);
    expect(evaluatorSectionsStep("review", true)).toBeGreaterThan(Math.max(...steps));
  });
});

describe("currentWorkScreen", () => {
  const started = {
    settingsSaved: true,
    marketEnabled: true,
    marketDone: false,
    costEnabled: true,
    costDone: false,
    finalDone: false,
  };

  it("stays on the approaches until the valuation starts", () => {
    expect(currentWorkScreen({ ...started, settingsSaved: false, marketDone: true })).toBe("basic");
  });

  it("walks the enabled approaches in order, then the final opinion, then the review", () => {
    expect(currentWorkScreen(started)).toBe("market");
    expect(currentWorkScreen({ ...started, marketDone: true })).toBe("cost");
    expect(currentWorkScreen({ ...started, marketDone: true, costDone: true })).toBe("final");
    expect(
      currentWorkScreen({ ...started, marketDone: true, costDone: true, finalDone: true }),
    ).toBe("review");
  });

  it("skips an approach that is off", () => {
    expect(currentWorkScreen({ ...started, marketEnabled: false })).toBe("cost");
    expect(currentWorkScreen({ ...started, marketDone: true, costEnabled: false })).toBe("final");
  });
});
