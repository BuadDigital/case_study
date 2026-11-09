import { describe, expect, it } from "vitest";
import {
  surveyFreezeLiftReasonError,
  surveyFreezeLiftView,
  surveyFreezeLiftedText,
} from "../survey-freeze-lift-state";
import { staffAccessOf } from "@platform/app-shared/app-data/case-specialist-sub-roles";

describe("surveyFreezeLiftView", () => {
  const active = { status: "internal" as const, surveyFreezeLiftedAt: null };

  it("offers the lift to the case specialist on an active, not yet lifted failure", () => {
    expect(surveyFreezeLiftView(staffAccessOf("case-specialist"), active)).toBe("lift");
  });

  it("offers nothing to anyone else", () => {
    for (const role of [
      "section-supervisor",
      "general-manager",
      "engineering-office",
      "real-estate-appraiser",
    ] as const) {
      expect(surveyFreezeLiftView(staffAccessOf(role), active)).toBe("none");
    }
  });

  it("shows the lifted line once lifted — to every role", () => {
    const lifted = { status: "internal" as const, surveyFreezeLiftedAt: "2026-10-02T08:00:00Z" };
    expect(surveyFreezeLiftView(staffAccessOf("case-specialist"), lifted)).toBe("lifted");
    expect(surveyFreezeLiftView(staffAccessOf("engineering-office"), lifted)).toBe("lifted");
  });

  it("offers nothing on a closed failure", () => {
    expect(
      surveyFreezeLiftView(staffAccessOf("case-specialist"), { status: "resolved", surveyFreezeLiftedAt: null }),
    ).toBe("none");
    expect(
      surveyFreezeLiftView(staffAccessOf("case-specialist"), { status: "suspended", surveyFreezeLiftedAt: null }),
    ).toBe("none");
  });
});

describe("surveyFreezeLiftReasonError", () => {
  it("requires a reason of at least 10 characters", () => {
    expect(surveyFreezeLiftReasonError("")).not.toBeNull();
    expect(surveyFreezeLiftReasonError("قصير")).not.toBeNull();
    expect(surveyFreezeLiftReasonError("عاد المالك للتعاون")).toBeNull();
  });
});

describe("surveyFreezeLiftedText", () => {
  it("reads «رُفع التجميد بتاريخ … — السبب …»", () => {
    expect(
      surveyFreezeLiftedText(
        { surveyFreezeLiftedAt: "2026-10-02T08:00:00Z", surveyFreezeLiftReason: "عاد المالك للتعاون" },
        (day) => `D(${day})`,
      ),
    ).toBe("رُفع التجميد بتاريخ D(2026-10-02) — السبب: عاد المالك للتعاون");
  });
});
