import { describe, expect, it } from "vitest";
import {
  createEngineeringSurveyDraft,
  surveyDeedBoundariesFromProperty,
} from "../src/lib/engineering-survey-data";

const draft = () => createEngineeringSurveyDraft({ taskId: "t", propertyId: "p", poNumber: "PO" });

const property = {
  northBoundary: "شارع عرض 15م",
  northBoundaryLengthM: "30",
  southBoundary: "جار",
  southBoundaryLengthM: "30",
  eastBoundary: "",
  eastBoundaryLengthM: "",
  westBoundary: "شارع عرض 12م",
  westBoundaryLengthM: "30",
};

describe("survey deed boundaries start from the property", () => {
  it("copies the recorded sides into an untouched draft", () => {
    expect(surveyDeedBoundariesFromProperty(draft(), property)).toEqual({
      northBoundary: "شارع عرض 15م",
      northBoundaryLengthM: "30",
      southBoundary: "جار",
      southBoundaryLengthM: "30",
      westBoundary: "شارع عرض 12م",
      westBoundaryLengthM: "30",
    });
  });

  it("never overwrites what the office typed, a submitted survey, or copies nothing", () => {
    expect(surveyDeedBoundariesFromProperty({ ...draft(), eastBoundaryLengthM: "28" }, property)).toBeNull();
    expect(surveyDeedBoundariesFromProperty({ ...draft(), status: "submitted" }, property)).toBeNull();
    expect(surveyDeedBoundariesFromProperty(draft(), { northBoundary: " " })).toBeNull();
    expect(surveyDeedBoundariesFromProperty(draft(), null)).toBeNull();
  });
});
