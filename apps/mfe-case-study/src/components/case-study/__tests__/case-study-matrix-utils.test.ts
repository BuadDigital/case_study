import { describe, expect, it } from "vitest";
import { ANSWER_YN, matrixAgreement } from "../case-study-matrix-utils";

describe("case-study matrix utils", () => {
  it("pairs the report's answer codes with Y/N/NA", () => {
    expect(ANSWER_YN).toEqual([
      ["A", "Y"],
      ["B", "N"],
      ["NA", "NA"],
    ]);
  });

  it("is pending without party answers", () => {
    expect(matrixAgreement({})).toEqual({ status: "pending", consensus: null });
  });

  it("agrees on the answer every party gave", () => {
    expect(matrixAgreement({ insp: "Y", eng: "Y", val: "Y" })).toEqual({ status: "consensus", consensus: "Y" });
    expect(matrixAgreement({ val: "NA" })).toEqual({ status: "consensus", consensus: "NA" });
  });

  it("is a conflict when the parties differ", () => {
    expect(matrixAgreement({ insp: "Y", eng: "N" })).toEqual({ status: "conflict", consensus: null });
  });
});
