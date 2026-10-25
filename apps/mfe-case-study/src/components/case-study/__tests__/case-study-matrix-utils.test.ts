import { describe, expect, it } from "vitest";
import { answerToYn, matrixAgreement, ynToAnswer } from "../case-study-matrix-utils";

describe("case-study matrix utils", () => {
  it("maps the report's answer codes to Y/N/NA and back", () => {
    expect(answerToYn("A")).toBe("Y");
    expect(answerToYn("B")).toBe("N");
    expect(answerToYn("NA")).toBe("NA");
    expect(answerToYn(null)).toBeNull();
    expect(ynToAnswer("Y")).toBe("A");
    expect(ynToAnswer("N")).toBe("B");
    expect(ynToAnswer("NA")).toBe("NA");
    expect(ynToAnswer(null)).toBeNull();
  });

  it("is pending without party answers", () => {
    expect(matrixAgreement({})).toEqual({ status: "pending", consensus: null });
  });

  it("agrees on the answer every party gave", () => {
    expect(matrixAgreement({ MA: "Y", EN: "Y", EV: "Y" })).toEqual({ status: "consensus", consensus: "Y" });
    expect(matrixAgreement({ EV: "NA" })).toEqual({ status: "consensus", consensus: "NA" });
  });

  it("is a conflict when the parties differ", () => {
    expect(matrixAgreement({ MA: "Y", EN: "N" })).toEqual({ status: "conflict", consensus: null });
  });
});
