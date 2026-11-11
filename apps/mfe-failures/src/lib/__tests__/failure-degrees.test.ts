import { describe, expect, it } from "vitest";
import type { RoleId } from "@platform/types";
import {
  canRaiseInternalFailure,
  canRecordFinalFailure,
  defaultRaiseSeverity,
  failureDegreesFor,
  failureReasonRequired,
  raiseSeveritiesForRole,
} from "../failure-degrees";

const UPPER: RoleId[] = ["case-specialist", "section-supervisor", "cdo"];
const LOWER: RoleId[] = [
  "field-inspector",
  "engineering-office",
  "real-estate-appraiser",
  "general-manager",
  "financial-officer",
  "government-reviewer",
];

describe("failure degrees by role (Omar 2026-11-11)", () => {
  it("lets the case specialist, the supervisor and the CDO raise internal and record the final failure", () => {
    for (const role of UPPER) {
      expect(canRecordFinalFailure(role)).toBe(true);
      expect(canRaiseInternalFailure(role)).toBe(true);
      expect(raiseSeveritiesForRole(role)).toEqual(["suspected", "internal"]);
      expect(defaultRaiseSeverity(role)).toBe("internal");
      expect(failureDegreesFor(role, null)).toEqual(["suspected", "internal", "final"]);
    }
  });

  it("leaves every other role the possible failure only", () => {
    for (const role of LOWER) {
      expect(canRecordFinalFailure(role)).toBe(false);
      expect(canRaiseInternalFailure(role)).toBe(false);
      expect(raiseSeveritiesForRole(role)).toEqual(["suspected"]);
      expect(defaultRaiseSeverity(role)).toBe("suspected");
      expect(failureDegreesFor(role, null)).toEqual(["suspected"]);
    }
  });

  it("offers only the final degree on a deed that already carries an open failure", () => {
    expect(failureDegreesFor("case-specialist", "internal")).toEqual(["final"]);
    expect(failureDegreesFor("section-supervisor", "review")).toEqual(["final"]);
    expect(failureDegreesFor("field-inspector", "internal")).toEqual([]);
  });

  it("offers nothing once the failure is final", () => {
    expect(failureDegreesFor("case-specialist", "approved")).toEqual([]);
    expect(failureDegreesFor("cdo", "approved")).toEqual([]);
  });

  it("requires a reason for the internal and the final failure only", () => {
    expect(failureReasonRequired("suspected")).toBe(false);
    expect(failureReasonRequired("internal")).toBe(true);
    expect(failureReasonRequired("final")).toBe(true);
  });
});
