import { describe, expect, it } from "vitest";
import {
  canDeletePo,
  canEditPoHeader,
  canEditProperty,
  canRaisePropertyFailure,
  canReceivePo,
  canRedistributeParties,
  canRevertTaskPhase,
  canIssueCaseStudyReport,
  canReopenCaseStudyReport,
  canDecideAppraisalRecall,
  canHandOverToEnfaz,
  canReturnFromEnfaz,
  canLiftSurveyFreeze,
  canPrepareReportDraft,
  canReopenValuationReport,
} from "../po-roles";

describe("po-roles", () => {
  it("specialist can receive and edit property, not delete/header", () => {
    expect(canReceivePo("case-specialist")).toBe(true);
    expect(canEditProperty("case-specialist")).toBe(true);
    expect(canRaisePropertyFailure("case-specialist")).toBe(true);
    expect(canEditPoHeader("case-specialist")).toBe(false);
    expect(canDeletePo("case-specialist")).toBe(false);
  });

  it("supervisor can receive, edit header, delete; not property edit alone", () => {
    expect(canReceivePo("section-supervisor")).toBe(true);
    expect(canEditPoHeader("section-supervisor")).toBe(true);
    expect(canDeletePo("section-supervisor")).toBe(true);
    expect(canRaisePropertyFailure("section-supervisor")).toBe(true);
    expect(canEditProperty("section-supervisor")).toBe(false);
  });

  it("CDO keeps header/delete/property-edit powers but cannot receive a PO", () => {
    expect(canReceivePo("cdo")).toBe(false);
    expect(canEditPoHeader("cdo")).toBe(true);
    expect(canEditProperty("cdo")).toBe(true);
    expect(canDeletePo("cdo")).toBe(true);
    expect(canRaisePropertyFailure("cdo")).toBe(true);
  });

  it("initial data and bourse belong to the case specialist and the system admin (CDO)", () => {
    expect(canEditProperty("case-specialist")).toBe(true);
    expect(canEditProperty("section-supervisor")).toBe(false);
    expect(canEditProperty("general-manager")).toBe(false);
    expect(canEditProperty("cdo")).toBe(true);
  });

  it("the specialist, the CDO and the supervisor revert a task phase", () => {
    expect(canRevertTaskPhase("section-supervisor")).toBe(true);
    expect(canRevertTaskPhase("case-specialist")).toBe(true);
    expect(canRevertTaskPhase("cdo")).toBe(true);
    expect(canRevertTaskPhase("general-manager")).toBe(false);
  });

  it("the specialist decisions on a study belong to the case specialist only", () => {
    for (const can of [
      canIssueCaseStudyReport,
      canReopenCaseStudyReport,
      canDecideAppraisalRecall,
      canHandOverToEnfaz,
      canReturnFromEnfaz,
      canLiftSurveyFreeze,
      canPrepareReportDraft,
      canReopenValuationReport,
    ]) {
      expect(can("case-specialist")).toBe(true);
      expect(can("section-supervisor")).toBe(false);
      expect(can("general-manager")).toBe(false);
      expect(can("cdo")).toBe(false);
      expect(can("real-estate-appraiser")).toBe(false);
    }
  });

  it("party roles cannot receive PO", () => {
    expect(canReceivePo("field-inspector")).toBe(false);
    expect(canReceivePo("engineering-office")).toBe(false);
    expect(canReceivePo("government-reviewer")).toBe(false);
    expect(canReceivePo("general-manager")).toBe(false);
  });

  it("case specialist, supervisor, general manager, and CDO can redistribute parties", () => {
    expect(canRedistributeParties("case-specialist")).toBe(true);
    expect(canRedistributeParties("section-supervisor")).toBe(true);
    expect(canRedistributeParties("general-manager")).toBe(true);
    expect(canRedistributeParties("cdo")).toBe(true);
  });

  it("party roles cannot redistribute parties", () => {
    expect(canRedistributeParties("field-inspector")).toBe(false);
    expect(canRedistributeParties("real-estate-appraiser")).toBe(false);
  });
});
