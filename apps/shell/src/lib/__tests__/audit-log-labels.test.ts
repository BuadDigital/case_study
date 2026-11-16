import { describe, expect, it } from "vitest";
import {
  auditActionLabel,
  auditActorLabel,
  auditDetailSummary,
  auditEntityTypeLabel,
} from "../audit-log-labels";

describe("auditDetailSummary", () => {
  it("describes party submission with kind and PO", () => {
    expect(
      auditDetailSummary(
        "case-study.party-submission.submitted",
        { status: "Draft" },
        {
          status: "Submitted",
          kind: "FieldInspection",
          poNumber: "PO-100",
        },
      ),
    ).toBe(
      "تسليم معاينة ميدانية للمراجعة — أمر العمل PO-100",
    );
  });

  it("describes party acceptance with reviewer name", () => {
    expect(
      auditDetailSummary(
        "case-study.party-submission.accepted",
        { status: "Submitted" },
        {
          status: "Accepted",
          kind: "FieldInspection",
          poNumber: "PO-100",
          acceptedBy: "أحمد",
        },
      ),
    ).toBe(
      "اعتماد معاينة ميدانية بعد المراجعة — أمر العمل PO-100 — بواسطة أحمد",
    );
  });

  it("describes distribution with child kinds", () => {
    expect(
      auditDetailSummary(
        "case-study.workflow-task.distribution-confirmed",
        { phase: "Distribution" },
        {
          phase: "CaseStudy",
          poNumber: "PO-9",
          childCount: 2,
          childKinds: ["FieldInspection", "PropertyAppraisal"],
        },
      ),
    ).toContain("معاينة ميدانية");
  });

  it("names changed organization settings sections", () => {
    expect(
      auditDetailSummary(
        "ORGANIZATION_SETTINGS_SAVED",
        { company: { nameAr: "أ" }, branding: { logoUrl: null } },
        { company: { nameAr: "ب" }, branding: { logoUrl: null } },
      ),
    ).toBe("تعديل إعدادات الشركة — القسم: بيانات المنشأة");
  });

  it("counts valuation alert overrides", () => {
    expect(
      auditDetailSummary(
        "valuation.alert-overrides.updated",
        {},
        { alert_a: true, alert_b: true },
      ),
    ).toBe("تخطّي 2 تنبيه على التقييم");
  });
});

describe("batch 2C audit codes", () => {
  it("labels every new action", () => {
    for (const code of [
      "case-study.enfaz-handover.cleared",
      "case-study.report.issued",
      "case-study.report.reopened",
      "case-study.party-submission.returned-with-impact",
      "failures.survey-freeze.lifted",
    ]) {
      expect(auditActionLabel(code)).not.toContain("إجراء غير معروف");
    }
  });

  it("describes clearing the Enfaz handover with what was reopened", () => {
    expect(
      auditDetailSummary(
        "case-study.enfaz-handover.cleared",
        { handedOver: true },
        { reason: "ملاحظة جديدة من إنفاذ", reopenedStudy: true, reopenedValuation: false },
      ),
    ).toBe(
      "إلغاء تسليم الملف لإنفاذ — أُعيد فتح: تقرير الدراسة — السبب: ملاحظة جديدة من إنفاذ",
    );
  });

  it("describes a return with its sections and affected parties", () => {
    expect(
      auditDetailSummary(
        "case-study.party-submission.returned-with-impact",
        { status: "Submitted" },
        {
          status: "Reopened",
          poNumber: "PO-7",
          returnNote: "تصحيح المساحة",
          sections: ["area", "components"],
          affected: [{ taskId: "t1" }],
        },
      ),
    ).toBe(
      "إرجاع المعاينة للمعاين — أمر العمل PO-7 — 2 قسم للتصحيح — 1 طرف متأثر — السبب: تصحيح المساحة",
    );
  });

  it("describes lifting the survey freeze with its reason", () => {
    expect(
      auditDetailSummary(
        "failures.survey-freeze.lifted",
        null,
        { poNumber: "PO-8", reason: "عاد المالك للتعاون" },
      ),
    ).toBe("رفع إيقاف الرفع المساحي — أمر العمل PO-8 — السبب: عاد المالك للتعاون");
  });
});

describe("return from the final failure", () => {
  it("labels the action and names the work order and the status change", () => {
    expect(auditActionLabel("failure.final-reverted")).toBe("الرجوع من التعذّر النهائي");
    const summary = auditDetailSummary(
      "failure.final-reverted",
      { status: "approved" },
      { status: "resolved", poNumber: "PO-9", reason: "رجعت في إنفاذ" },
    );
    expect(summary).toContain("الرجوع من التعذّر النهائي — أمر العمل PO-9");
  });
});

describe("auditActorLabel", () => {
  it("prefers API actorDisplayName over truncated ids", () => {
    expect(
      auditActorLabel(
        "001f71cb-aaaa-bbbb-cccc-dddddddddddd",
        undefined,
        "سليمان الصالحي",
      ),
    ).toBe("سليمان الصالحي");
  });
});

describe("auditEntityTypeLabel", () => {
  it("localizes ValuationReconciliation", () => {
    expect(auditEntityTypeLabel("ValuationReconciliation")).toBe(
      "الترجيح",
    );
  });
});

describe("events added since 2026-11 (Omar 2026-11-15)", () => {
  it("labels every event the backend writes today — none falls back to «إجراء غير مُعرَّف»", () => {
    for (const action of [
      "case-study.property.fields-changed",
      "case-study.billing-ready.marked",
      "case-study.report.study-approved",
      "case-study.transaction.received",
      "case-study.transaction.link-kind-changed",
      "case-study.transaction-cancellation.requested",
      "case-study.transaction-cancellation.approved",
      "case-study.transaction-cancellation.rejected",
      "case-study.transaction-cancellation.reactivated",
      "valuation.report-issuance.approval-withdrawn",
      "TRANSACTION_MERGED",
      "TRANSACTION_DEED_UNMERGED",
      "PROPERTY_GROUP_LINK_CONFIRMED",
      "PROPERTY_GROUP_UNLINKED",
    ]) {
      expect(auditActionLabel(action)).not.toContain("غير مُعرَّف");
    }
    expect(auditEntityTypeLabel("Transaction")).toBe("معاملة");
    expect(auditEntityTypeLabel("TransactionCancellation")).toBe("إلغاء معاملة");
  });

  it("names the changed property fields by their Arabic labels", () => {
    expect(
      auditDetailSummary(
        "case-study.property.fields-changed",
        { area: "500" },
        { fields: { area: "600" }, autosave: true },
      ),
    ).toBe("تعديل بيانات العقار — المساحة — حفظ تلقائي");
  });

  it("words a cancellation step with its reason and the step's note", () => {
    expect(
      auditDetailSummary("case-study.transaction-cancellation.rejected", null, {
        poNumber: "PO-7",
        reasonCode: "duplicate",
        note: "مكرر",
        decisionNote: "ليست مكررة",
      }),
    ).toBe("رفض إلغاء المعاملة — أمر العمل PO-7 — السبب: معاملة مكررة — ملاحظة القرار: ليست مكررة");
  });

  it("words a merge and a link-kind change", () => {
    expect(
      auditDetailSummary("TRANSACTION_MERGED", null, {
        deeds: [{ id: "d1" }],
        linkKind: "one_building",
        propertyNumber: "PR-26-00161-L",
        reason: "عمارة على قطعتين",
      }),
    ).toBe("دمج صكوك في معاملة واحدة — رقم العقار PR-26-00161-L — مبنى واحد — 1 صك مضاف — السبب: عمارة على قطعتين");
    expect(
      auditDetailSummary(
        "case-study.transaction.link-kind-changed",
        { linkKind: "one_building" },
        { linkKind: "contract", reason: "عقد واحد" },
      ),
    ).toBe("تغيير نوع ربط الصكوك: مبنى واحد ← أعيان بعقد — السبب: عقد واحد");
  });
});
