import { describe, expect, it } from "vitest";
import { mergeEvaluatorDraftPatches } from "../evaluator-submission-commands";

describe("mergeEvaluatorDraftPatches", () => {
  it("keeps fields from both patches — a later report choice does not drop earlier notes", () => {
    const merged = mergeEvaluatorDraftPatches(
      { searchScopeNotes: "ملاحظات" },
      { valueBasis: "market" },
    );
    expect(merged).toEqual({ searchScopeNotes: "ملاحظات", valueBasis: "market" });
  });

  it("lets the later value win for the same field", () => {
    expect(
      mergeEvaluatorDraftPatches({ landValue: "100" }, { landValue: "200" }),
    ).toEqual({ landValue: "200" });
  });

  it("returns the patch as-is when nothing is pending", () => {
    const patch = { landValue: "1" };
    expect(mergeEvaluatorDraftPatches(null, patch)).toBe(patch);
  });
});
