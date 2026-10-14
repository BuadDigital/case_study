import { describe, expect, it } from "vitest";
import { buildFromEvaluator } from "../property-detail-party-submission-builders";
import type { EvaluatorSubmissionSnapshot } from "../property-detail-party-submission-types";

function priceOf(evaluatorPrice: string): string | undefined {
  const submission = {
    status: "submitted",
    evaluatorPrice,
    evaluatorNotes: "",
    reportFileName: null,
    submittedAtUtc: null,
    checklist: {},
  } as unknown as EvaluatorSubmissionSnapshot;
  return buildFromEvaluator(submission).fields.find((f) => f.label === "سعر التقييم")?.value;
}

describe("buildFromEvaluator — «سعر التقييم»", () => {
  it("reads a price typed in Arabic digits like one typed in Latin digits", () => {
    const latin = priceOf("1250000");
    expect(latin).toBeTruthy();
    expect(priceOf("١٢٥٠٠٠٠")).toBe(latin);
    expect(priceOf("1,250,000")).toBe(latin);
  });

  it("drops an empty or non-positive price", () => {
    expect(priceOf("")).toBeUndefined();
    expect(priceOf("0")).toBeUndefined();
  });
});
