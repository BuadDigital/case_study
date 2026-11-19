import { describe, expect, it } from "vitest";
import {
  canDeletePo,
  canEditAssignmentSpecialist,
  canEditPoHeader,
  canAdvanceIntake,
  canEditPropertyData,
  canAcceptPartyWork,
  canDistribute,
  canMergeTransactions,
  canRecordValuationDeposit,
  canRequestTransactionCancel,
  canReviewValuedDocuments,
  canRaisePropertyFailure,
  canReceivePo,
  canReopenTransaction,
  canRedistributeParties,
  canSkipEngineeringSurvey,
  canRevertTaskPhase,
  canFinishStudy,
  canReopenCaseStudyReport,
  canDecideAppraisalRecall,
  canHandOverToEnfaz,
  canLiftSurveyFreeze,
  canPrepareReportDraft,
  canReopenValuationReport,
} from "../po-roles";
import { staffAccessOf } from "@platform/app-shared/app-data/case-specialist-sub-roles";
import type { CaseSpecialistSubRole } from "@platform/types";
import type { StaffAccess } from "../po-roles";

describe("po-roles", () => {
  it("specialist can receive and edit property, not delete/header", () => {
    expect(canReceivePo(staffAccessOf("case-specialist"))).toBe(true);
    expect(canEditPropertyData("case-specialist")).toBe(true);
    expect(canRaisePropertyFailure("case-specialist")).toBe(true);
    expect(canEditPoHeader("case-specialist")).toBe(false);
    expect(canEditAssignmentSpecialist(staffAccessOf("case-specialist"))).toBe(true);
    expect(canDeletePo("case-specialist")).toBe(false);
  });

  it("supervisor can receive, edit header, delete; not property edit alone", () => {
    expect(canReceivePo(staffAccessOf("section-supervisor"))).toBe(true);
    expect(canEditPoHeader("section-supervisor")).toBe(true);
    expect(canEditAssignmentSpecialist(staffAccessOf("section-supervisor"))).toBe(true);
    expect(canDeletePo("section-supervisor")).toBe(true);
    expect(canRaisePropertyFailure("section-supervisor")).toBe(true);
    expect(canEditPropertyData("section-supervisor")).toBe(false);
  });

  it("CDO keeps header/delete/property-edit powers but cannot receive a PO", () => {
    expect(canReceivePo(staffAccessOf("cdo"))).toBe(false);
    expect(canEditPoHeader("cdo")).toBe(true);
    expect(canEditPropertyData("cdo")).toBe(true);
    expect(canDeletePo("cdo")).toBe(true);
    expect(canRaisePropertyFailure("cdo")).toBe(true);
  });

  it("initial data and bourse belong to the coordination sub-role and the system admin (CDO)", () => {
    expect(canAdvanceIntake(staffAccessOf("case-specialist"))).toBe(true);
    expect(canAdvanceIntake(staffAccessOf("case-specialist", ["study"]))).toBe(false);
    expect(canAdvanceIntake(staffAccessOf("section-supervisor"))).toBe(false);
    expect(canAdvanceIntake(staffAccessOf("general-manager"))).toBe(false);
    expect(canAdvanceIntake(staffAccessOf("cdo"))).toBe(true);
  });

  it("the specialist, the CDO and the supervisor revert a task phase", () => {
    expect(canRevertTaskPhase(staffAccessOf("section-supervisor"))).toBe(true);
    expect(canRevertTaskPhase(staffAccessOf("case-specialist"))).toBe(true);
    expect(canRevertTaskPhase(staffAccessOf("cdo"))).toBe(true);
    expect(canRevertTaskPhase(staffAccessOf("general-manager"))).toBe(false);
  });

  it("the specialist decisions on a study belong to the case specialist only", () => {
    for (const can of [
      canFinishStudy,
      canReopenCaseStudyReport,
      canDecideAppraisalRecall,
      canHandOverToEnfaz,
      canLiftSurveyFreeze,
      canPrepareReportDraft,
      canReopenValuationReport,
    ]) {
      expect(can(staffAccessOf("case-specialist"))).toBe(true);
      expect(can(staffAccessOf("section-supervisor"))).toBe(false);
      expect(can(staffAccessOf("general-manager"))).toBe(false);
      expect(can(staffAccessOf("cdo"))).toBe(false);
      expect(can(staffAccessOf("real-estate-appraiser"))).toBe(false);
    }
  });

  // Omar 2026-11-05: any specialist reopens (the «الرد على إنفاذ» step was removed 2026-11-08).
  it("any specialist, the supervisor and the CDO reopen a transaction", () => {
    for (const held of ["coordination", "study", "review"] as const) {
      expect(canReopenTransaction(staffAccessOf("case-specialist", [held]))).toBe(true);
    }
    expect(canReopenTransaction(staffAccessOf("section-supervisor"))).toBe(true);
    expect(canReopenTransaction(staffAccessOf("cdo"))).toBe(true);
    expect(canReopenTransaction(staffAccessOf("general-manager"))).toBe(false);
  });

  it("party roles cannot receive PO", () => {
    expect(canReceivePo(staffAccessOf("field-inspector"))).toBe(false);
    expect(canReceivePo(staffAccessOf("engineering-office"))).toBe(false);
    expect(canReceivePo(staffAccessOf("government-reviewer"))).toBe(false);
    expect(canReceivePo(staffAccessOf("general-manager"))).toBe(false);
  });

  it("case specialist, supervisor, general manager, and CDO can redistribute parties", () => {
    expect(canRedistributeParties(staffAccessOf("case-specialist"))).toBe(true);
    expect(canRedistributeParties(staffAccessOf("section-supervisor"))).toBe(true);
    expect(canRedistributeParties(staffAccessOf("general-manager"))).toBe(true);
    expect(canRedistributeParties(staffAccessOf("cdo"))).toBe(true);
  });

  it("party roles cannot redistribute parties", () => {
    expect(canRedistributeParties(staffAccessOf("field-inspector"))).toBe(false);
    expect(canRedistributeParties(staffAccessOf("real-estate-appraiser"))).toBe(false);
  });

  // Ruling 2026-11-02 — mirrors CaseSpecialistSubRolesTests on the server.
  const owners: [CaseSpecialistSubRole, (access: StaffAccess) => boolean][] = [
    ["coordination", canReceivePo],
    ["coordination", canEditAssignmentSpecialist],
    ["coordination", canAdvanceIntake],
    ["coordination", canRevertTaskPhase],
    ["coordination", canDistribute],
    ["coordination", canRequestTransactionCancel],
    ["coordination", canRedistributeParties],
    ["coordination", canLiftSurveyFreeze],
    ["study", canFinishStudy],
    ["study", canSkipEngineeringSurvey],
    ["study", canDecideAppraisalRecall],
    ["study", canPrepareReportDraft],
    ["study", canReviewValuedDocuments],
    ["review", canHandOverToEnfaz],
    ["review", canRecordValuationDeposit],
    ["review", canReopenValuationReport],
  ];

  it.each(owners)("a specialist decision belongs to the %s sub-role only", (owner, can) => {
    for (const held of ["coordination", "study", "review"] as const) {
      expect(can(staffAccessOf("case-specialist", [held]))).toBe(held === owner);
    }
  });

  // Omar 2026-11-08: the study takes its study back; review returns it to the study.
  it("the sent study is reopened by the study or by review", () => {
    expect(canReopenCaseStudyReport(staffAccessOf("case-specialist", ["coordination"]))).toBe(false);
    expect(canReopenCaseStudyReport(staffAccessOf("case-specialist", ["study"]))).toBe(true);
    expect(canReopenCaseStudyReport(staffAccessOf("case-specialist", ["review"]))).toBe(true);
  });

  // Omar 2026-11-08: the three sub-roles edit the transaction's data at the same level.
  it("party work is accepted and corrected by every case-specialist sub-role", () => {
    for (const held of ["coordination", "study", "review"] as const) {
      expect(canAcceptPartyWork(staffAccessOf("case-specialist", [held]))).toBe(true);
    }
    expect(canAcceptPartyWork(staffAccessOf("field-inspector"))).toBe(false);
  });

  it("merging is for coordination or study, and every sub-role edits property data", () => {
    expect(canMergeTransactions(staffAccessOf("case-specialist", ["coordination"]))).toBe(true);
    expect(canMergeTransactions(staffAccessOf("case-specialist", ["study"]))).toBe(true);
    expect(canMergeTransactions(staffAccessOf("case-specialist", ["review"]))).toBe(false);
    expect(canEditPropertyData("case-specialist")).toBe(true);
    expect(canEditPropertyData("field-inspector")).toBe(false);
  });
});
