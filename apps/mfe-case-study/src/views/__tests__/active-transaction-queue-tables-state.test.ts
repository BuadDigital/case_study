import { describe, expect, it } from "vitest";
import {
  assignedDateLabel,
  buildAppraisalPartyDeps,
  distributionSkeletonCols,
  engSurveyRemainingMode,
  engSurveyStatusPillStyle,
  formatEngSurveyRemaining,
  isStudySlotLabel,
  joinCityDistrict,
  primarySkeletonCols,
  propertyTypeLabel,
  resolveEngSurveyContact,
} from "../active-transaction-queue-tables-state";

describe("engSurveyStatusPillStyle", () => {
  it("maps the prototype status classes to their pill colors", () => {
    expect(engSurveyStatusPillStyle("b-done")).toEqual({
      base: "#3f8f5f",
      fg: "#2f7a4d",
    });
    expect(engSurveyStatusPillStyle("b-fail")).toEqual({
      base: "#d9694f",
      fg: "#a5432e",
    });
    expect(engSurveyStatusPillStyle("b-returned")).toEqual(
      engSurveyStatusPillStyle("b-fail"),
    );
    expect(engSurveyStatusPillStyle("b-prog")).toEqual({
      base: "#d9a441",
      fg: "#8a5e14",
    });
    expect(engSurveyStatusPillStyle("b-gold")).toEqual({
      base: "#a4906f",
      fg: "#8c7857",
    });
    expect(engSurveyStatusPillStyle("b-navy")).toEqual({
      base: "#102B4E",
      fg: "#102B4E",
    });
  });

  it("falls back to the gray 'new' pill for unknown classes", () => {
    expect(engSurveyStatusPillStyle("b-new")).toEqual({
      base: "#6b7c8f",
      fg: "#4a5568",
    });
    expect(engSurveyStatusPillStyle("")).toEqual(engSurveyStatusPillStyle("b-new"));
  });
});

describe("formatEngSurveyRemaining", () => {
  const active = (days: number) =>
    ({ status: "active", days, hours: 0, minutes: 0, seconds: 0 }) as const;

  it("renders the placeholder, overdue and day-count forms", () => {
    expect(formatEngSurveyRemaining({ status: "missing" })).toEqual({
      text: "—",
      overdue: false,
    });
    expect(formatEngSurveyRemaining({ status: "overdue" })).toEqual({
      text: "متأخر",
      overdue: true,
    });
    expect(formatEngSurveyRemaining(active(0))).toEqual({
      text: "0 أيام",
      overdue: false,
    });
    expect(formatEngSurveyRemaining(active(1)).text).toBe("يوم");
    expect(formatEngSurveyRemaining(active(2)).text).toBe("يومان");
    expect(formatEngSurveyRemaining(active(5)).text).toBe("5 أيام");
  });
});

describe("engSurveyRemainingMode", () => {
  it("pauses without a phone, stops on failure/return, else counts down", () => {
    expect(engSurveyRemainingMode(true, "b-prog")).toBe("paused");
    expect(engSurveyRemainingMode(true, "b-fail")).toBe("paused");
    expect(engSurveyRemainingMode(false, "b-fail")).toBe("stopped");
    expect(engSurveyRemainingMode(false, "b-returned")).toBe("stopped");
    expect(engSurveyRemainingMode(false, "b-prog")).toBe("countdown");
    expect(engSurveyRemainingMode(false, "b-new")).toBe("countdown");
  });
});

describe("assignedDateLabel", () => {
  it("prefers the task creation date and pads month and day", () => {
    expect(
      assignedDateLabel(
        { createdAt: "2026-03-07T10:00:00" },
        { receivedFromEnfathAt: "2025-01-01T00:00:00" },
      ),
    ).toBe("2026/03/07");
  });

  it("falls back to the record's Enfath receipt date", () => {
    expect(
      assignedDateLabel(
        { createdAt: "" },
        { receivedFromEnfathAt: "2025-11-21T00:00:00" },
      ),
    ).toBe("2025/11/21");
  });

  it("returns the placeholder when no date or an invalid date is available", () => {
    expect(assignedDateLabel({ createdAt: "" }, undefined)).toBe("—");
    expect(assignedDateLabel({ createdAt: "not-a-date" }, undefined)).toBe("—");
  });
});

describe("joinCityDistrict", () => {
  it("joins the present parts and skips blanks and placeholders", () => {
    expect(joinCityDistrict("الرياض", "العليا")).toBe("الرياض — العليا");
    expect(joinCityDistrict("الرياض", "—")).toBe("الرياض");
    expect(joinCityDistrict("", "العليا")).toBe("العليا");
    expect(joinCityDistrict("—", "")).toBe("");
  });
});

describe("propertyTypeLabel", () => {
  it("uses the property type, then the classification, else empty", () => {
    expect(
      propertyTypeLabel({ propertyType: " فيلا ", classification: "سكني" }),
    ).toBe("فيلا");
    expect(propertyTypeLabel({ propertyType: "  ", classification: "سكني" })).toBe(
      "سكني",
    );
    expect(propertyTypeLabel({ propertyType: null, classification: null })).toBe("");
    expect(propertyTypeLabel(null)).toBe("");
    expect(propertyTypeLabel(undefined)).toBe("");
  });
});

describe("resolveEngSurveyContact", () => {
  it("picks the first contact with any filled field and trims it", () => {
    expect(
      resolveEngSurveyContact([
        { name: " ", phone: "", role: " " },
        { name: " أحمد ", phone: " 0500000000 ", role: " مالك " },
        { name: "خالد", phone: "0511111111", role: "" },
      ]),
    ).toEqual({
      name: "أحمد",
      phone: "0500000000",
      role: "مالك",
      missingPhone: false,
    });
  });

  it("flags a contact without a phone and falls back to the placeholder name", () => {
    expect(
      resolveEngSurveyContact([{ name: "أحمد", phone: " ", role: "" }]),
    ).toEqual({ name: "أحمد", phone: "", role: "", missingPhone: true });
    expect(resolveEngSurveyContact([])).toEqual({
      name: "—",
      phone: "",
      role: "",
      missingPhone: true,
    });
    expect(resolveEngSurveyContact(undefined).name).toBe("—");
  });
});

describe("buildAppraisalPartyDeps", () => {
  it("always lists the inspector and adds the engineering office only when a survey is needed", () => {
    const withoutSurvey = buildAppraisalPartyDeps({
      inspected: true,
      needsSurvey: false,
      surveyed: false,
    });
    expect(withoutSurvey).toHaveLength(1);
    expect(withoutSurvey[0]).toMatchObject({ letter: "م", ink: true, ok: true });

    const withSurvey = buildAppraisalPartyDeps({
      inspected: false,
      needsSurvey: true,
      surveyed: true,
    });
    expect(withSurvey.map((d) => [d.letter, d.ink, d.ok])).toEqual([
      ["م", true, false],
      ["هـ", false, true],
    ]);
  });
});

describe("skeleton column counts", () => {
  it("follow the visible columns of each table variant", () => {
    expect(distributionSkeletonCols(false)).toBe(8);
    expect(distributionSkeletonCols(true)).toBe(11);
    expect(primarySkeletonCols(true)).toBe(7);
    expect(primarySkeletonCols(false)).toBe(5);
  });
});

describe("isStudySlotLabel", () => {
  it("recognises the under-study placeholder slot", () => {
    expect(isStudySlotLabel("قيد الدراسة — 3")).toBe(true);
    expect(isStudySlotLabel("123456789")).toBe(false);
  });
});
